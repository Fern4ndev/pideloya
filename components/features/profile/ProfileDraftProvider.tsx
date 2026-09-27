'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { upload } from '@imagekit/next'
import { getImageKitAuthParams } from '@/lib/actions/imagekit'
import {
  removeAvatar,
  removeYapeQr,
  saveAvatar,
  saveYapeQr,
} from '@/lib/actions/profile'
import type { UploadedImage } from '@/components/features/restaurants/ImageUploader'

/**
 * Borradores de medios (foto de perfil / QR de Yape) del repartidor.
 *
 * Elegir o quitar una imagen NO toca ImageKit ni la base: solo deja un
 * draft en memoria. La subida y el guardado ocurren cuando "Guardar
 * cambios" ejecuta `commitMedia()` — así un cancel antes de guardar no
 * deja archivos huérfanos ni filas modificadas.
 *
 * `folder` viaja dentro del draft (no en el provider) porque lo conoce
 * cada uploader: `/repartidores/{id}/avatar`, `/repartidores/{id}/yape-qr`.
 */

export type MediaKind = 'avatar' | 'yape'

export type MediaDraft =
  | { type: 'file'; file: File; folder: string }
  | { type: 'remove' }

interface ProfileDraftContextValue {
  getDraft: (kind: MediaKind) => MediaDraft | null
  setDraft: (kind: MediaKind, draft: MediaDraft | null) => void
  /** true si hay algo pendiente de guardar (archivo nuevo o borrado marcado). */
  hasMediaChanges: boolean
  /** true mientras `commitMedia()` está en curso — los uploaders se bloquean. */
  isCommitting: boolean
  /**
   * Sube/borra todo lo pendiente. Lanza Error con mensaje amigable ante
   * el primer fallo; lo que ya se guardó NO se revierte (el draft exitoso
   * se limpia), así que reintentar solo repite lo pendiente.
   */
  commitMedia: () => Promise<void>
}

const ProfileDraftContext = createContext<ProfileDraftContextValue | null>(null)

/**
 * Hook obligatorio: solo para componentes que DEBEN vivir dentro del
 * provider (AvatarUploader / YapeQrUploader, que no tienen sentido sin
 * draft). Falla ruidosamente si el árbol no está envuelto.
 */
export function useProfileDraft(): ProfileDraftContextValue {
  const ctx = useContext(ProfileDraftContext)
  if (!ctx) {
    throw new Error(
      'useProfileDraft requiere un <ProfileDraftProvider> en el árbol'
    )
  }
  return ctx
}

/**
 * Hook opcional: para componentes compartidos entre paneles (ProfileForm)
 * que solo tienen drafts dentro del perfil del repartidor. Devuelve null
 * donde no hay provider y el consumidor se comporta como antes.
 */
export function useOptionalProfileDraft(): ProfileDraftContextValue | null {
  return useContext(ProfileDraftContext)
}

export function ProfileDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<MediaKind, MediaDraft | null>>({
    avatar: null,
    yape: null,
  })
  const [isCommitting, setIsCommitting] = useState(false)

  const getDraft = useCallback(
    (kind: MediaKind) => drafts[kind],
    [drafts]
  )

  const setDraft = useCallback(
    (kind: MediaKind, draft: MediaDraft | null) => {
      setDrafts((prev) => ({ ...prev, [kind]: draft }))
    },
    []
  )

  const hasMediaChanges = drafts.avatar !== null || drafts.yape !== null

  const commitMedia = useCallback(async () => {
    const pending = (
      Object.entries(drafts) as [MediaKind, MediaDraft | null][]
    ).filter(([, draft]) => draft !== null)
    if (pending.length === 0) return

    setIsCommitting(true)
    try {
      for (const [kind, draft] of pending) {
        if (!draft) continue

        if (draft.type === 'remove') {
          if (kind === 'avatar') await removeAvatar()
          else await removeYapeQr()
        } else {
          let image: UploadedImage
          try {
            const authParams = await getImageKitAuthParams()
            const result = await upload({
              ...authParams,
              file: draft.file,
              fileName: draft.file.name,
              folder: draft.folder,
            })
            if (!result.url || !result.fileId) {
              throw new Error('ImageKit no devolvió la URL esperada')
            }
            image = { url: result.url, fileId: result.fileId }
          } catch (err) {
            throw new Error(
              err instanceof Error ? err.message : 'No se pudo subir la imagen'
            )
          }

          if (kind === 'avatar') await saveAvatar(image)
          else await saveYapeQr(image)
        }

        // Solo se limpia el draft que acaba de guardarse: si el fallo
        // ocurre en el segundo, el primero queda limpio y el segundo
        // pendiente para el reintento.
        setDraft(kind, null)
      }
    } finally {
      setIsCommitting(false)
    }
  }, [drafts, setDraft])

  const value = useMemo<ProfileDraftContextValue>(
    () => ({
      getDraft,
      setDraft,
      hasMediaChanges,
      isCommitting,
      commitMedia,
    }),
    [getDraft, setDraft, hasMediaChanges, isCommitting, commitMedia]
  )

  return (
    <ProfileDraftContext.Provider value={value}>
      {children}
    </ProfileDraftContext.Provider>
  )
}
