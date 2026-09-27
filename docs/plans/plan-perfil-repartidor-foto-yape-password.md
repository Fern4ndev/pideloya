# Plan de Implementación — Perfil de Repartidor: Foto de perfil, QR de Yape y reorganización de Seguridad

**Proyecto:** PideloYa
**Módulo:** Panel de Repartidor → `/repartidor/perfil`
**Autor del plan:** Revisión técnica estilo senior (+20 años), sobre el código real del repo.
**Alcance:** (1) Subida de foto de perfil del repartidor, (2) Subida de foto del QR de Yape del repartidor, (3) Reorganización y mejora de UX del cambio de contraseña, (4) Nuevos atributos en base de datos y su ciclo de vida completo (creación, reemplazo, borrado, anonimización).

> **Nota sobre las skills solicitadas (`ui-ux-pro-max`, `supabase-postgres-best-practices`, `vercel-react-best-practices`):** la ruta `C:\Users\ferna\.agents\skills` vive en tu máquina local, no en el entorno donde yo ejecuto (sandbox aislado sin acceso a tu filesystem), así que no pude leer esos `SKILL.md` directamente. Este plan aplica los mismos principios que normalmente encapsulan esas skills — Server Components por defecto, mutaciones vía Server Actions, `revalidatePath` quirúrgico, migraciones aditivas y no bloqueantes, RLS como fuente de verdad + defensa en profundidad en cliente, reutilización de componentes (DRY) en vez de duplicarlos, jerarquía visual clara, estados vacíos/carga/error consistentes, accesibilidad de formularios — y los cito explícitamente en cada fase para que los verifiques contra tus skills si difieren en algún detalle.

---

## Índice de fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 0 | Diagnóstico del estado actual | Lectura | — |
| 1 | Modelo de datos: nuevas columnas (aclaración de dónde viven) | Migración SQL | Alta |
| 2 | Estrategia de almacenamiento (ImageKit) y componente base reutilizable | Infra + refactor | Alta |
| 3 | Server Actions: subir/reemplazar/borrar foto y QR | Backend | Alta |
| 4 | Componentes de UI nuevos y extracción de la contraseña | Frontend | Alta |
| 5 | Reorganización de `/repartidor/perfil` (el pedido central) | Frontend/UX | Alta |
| 6 | Ciclo de vida de datos y cumplimiento (Ley 29733) | Backend + legal | Alta |
| 7 | Bug fix relacionado: `vehicleType` no era editable | Frontend | Media (recomendado) |
| 8 | QA — checklist de pruebas manuales | QA | Obligatoria |
| 9 | Orden de despliegue | DevOps | Obligatoria |

Orden recomendado de ejecución: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9**. Las fases 1-3 son invisibles para el usuario final y de bajo riesgo (aditivas); la Fase 5 es la entrega visible que el usuario está pidiendo.

---

## Fase 0 — Diagnóstico del estado actual

Antes de tocar código, esto es lo que ya existe y sobre lo que vamos a construir (todo verificado contra el repo):

### 0.1 — Dónde vive hoy el perfil del repartidor

- `app/repartidor/perfil/page.tsx` (Server Component) trae `full_name, phone, document_type, document_number, vehicle_type` de `profiles` y los pasa a `<ProfileForm />` con `showDeliveryFields` y `showPasswordChange`.
- `components/features/profile/ProfileForm.tsx` es un componente **genérico compartido** por Cliente, Restaurante, Repartidor y Admin (`app/cliente/perfil`, `app/restaurante/perfil`, `app/repartidor/perfil`, `app/admin/perfil`). Dentro del mismo archivo define, **anidado**, un segundo componente `PasswordChangeForm` que se renderiza solo si `showPasswordChange` es `true`.
- `lib/actions/profile.ts` expone `updateProfile()` (nombre, teléfono, datos de repartidor) y `changePassword()` (solo valida longitud ≥ 8, sin reglas de complejidad ni feedback visual de fortaleza).

**Gaps encontrados que este plan corrige de paso:**

1. **`vehicle_type` no es editable por el repartidor.** `ProfileFormData` lo declara, `updateProfile()` ya sabe guardarlo, `app/repartidor/perfil/page.tsx` ya lo trae y se lo pasa a `ProfileForm` como `initialData` — pero **no existe ningún `<input>`/`<Select>` en el JSX de `ProfileForm` que lo muestre**. Hoy solo el admin puede cambiarlo, vía `EditDeliveryDialog.tsx`. Ver Fase 7.
2. **El cambio de contraseña no tiene mostrar/ocultar contraseña.** El formulario de registro (`components/features/registration/shared/PasswordField.tsx`) sí lo tiene (ícono de ojo), pero `PasswordChangeForm` (dentro de `ProfileForm.tsx`) usa un `<Input type="password">` plano — inconsistencia de UX entre dos flujos del mismo producto.
3. **El cambio de contraseña está "escondido" al final del formulario de datos personales**, separado solo por un `border-t`, sin jerarquía visual propia (sin tarjeta, sin título, sin ícono) — exactamente lo que el pedido de "mejora la organización" apunta a resolver.

### 0.2 — Cómo sube imágenes hoy el proyecto (patrón a reutilizar, no a duplicar)

- **ImageKit** (no Supabase Storage) es el proveedor de imágenes de usuario: `lib/imagekit-server.ts` (cliente admin + `deleteImageKitFileSafe`, borrado "best effort" que nunca lanza) y `lib/actions/imagekit.ts` (`getImageKitAuthParams`, token de subida de un solo uso).
- **`components/features/restaurants/ImageUploader.tsx`** es el componente genérico de subida (drag & drop, preview inmediata, barra de progreso, validación de tipo/tamaño ≤3MB, botón "Quitar"). Ya lo usan `LogoUploader.tsx` (logo del negocio) y `ProductForm.tsx` (foto de producto).
- **Patrón de guardado con limpieza del archivo anterior:** `lib/actions/restaurants.ts::saveRestaurantLogo()` es la referencia exacta a replicar: guarda la nueva URL/fileId y **después** llama a `deleteImageKitFileSafe(fileIdAnterior)` para no dejar huérfanos en la cuenta de ImageKit (documentado en `docs/decisions-and-learnings.md`, Fase 4 del plan de eliminación de cuentas).
- Existe también una migración `20260912135915_restaurant_logos_storage.sql` que crea un **bucket de Supabase Storage** — es un vestigio de una implementación anterior a la migración a ImageKit (la migración `20260912132932_imagekit_file_ids.sql` que agrega `logo_file_id`/`image_file_id` es la que quedó vigente, según `LogoUploader.tsx`/`ImageUploader.tsx` actuales). **Este plan sigue el patrón vigente (ImageKit) y no crea ningún bucket ni política de Storage nueva** — cero migraciones de RLS de Storage, cero superficie de ataque nueva.

### 0.3 — Aclaración importante sobre "la tabla de Deliverys"

En el pedido se menciona aumentar atributos a "la tabla de Deliverys". En el esquema del proyecto existen dos conceptos con nombre parecido y **no hay que confundirlos**:

| Tabla | Qué guarda | Ejemplo de columnas |
|---|---|---|
| `public.deliveries` | El **ciclo de vida de UN pedido** asignado a un repartidor | `order_id`, `delivery_person_id`, `accepted_at`, `picked_up_at`, `delivered_at` |
| `public.profiles` (rol `DELIVERY`) | **La identidad y el perfil** del repartidor como persona/usuario | `full_name`, `phone`, `document_type`, `document_number`, `vehicle_type` |

La foto de perfil y el QR de Yape son datos del **repartidor como persona**, no de un pedido puntual — por lo tanto **van en `profiles`**, exactamente junto a `vehicle_type`/`document_number`, que ya siguen ese mismo criterio. Añadirlos a `deliveries` los duplicaría por cada pedido (un desastre de normalización: la misma foto repetida en cientos de filas) y los perdería en cuanto el pedido se archive. El resto de este plan usa `profiles`.

---

## Fase 1 — Modelo de datos

**Objetivo:** agregar los campos necesarios de forma aditiva, sin romper nada existente y sin bloquear la tabla.

### 1.1 — Migración SQL

Archivo nuevo: `supabase/migrations/20260928000000_profiles_delivery_media.sql`

```sql
-- ============================================================================
-- PideloYa — Foto de perfil y QR de Yape para repartidores
-- ============================================================================
-- Estas columnas viven en `profiles`, NO en `deliveries`: `deliveries`
-- registra el ciclo de vida de UN pedido asignado a un repartidor
-- (accepted_at, picked_up_at, delivered_at); la identidad y los datos
-- propios del repartidor (full_name, phone, document_*, vehicle_type) ya
-- viven en `profiles` — exactamente donde deben ir avatar_url y
-- yape_qr_url.
--
-- Mismo patrón que logo_file_id/image_file_id en restaurants/products
-- (migración 20260912132932_imagekit_file_ids.sql): junto a la URL pública
-- se guarda el fileId interno de ImageKit, indispensable para poder
-- borrar el archivo anterior cuando el repartidor sube uno nuevo (ver
-- lib/imagekit-server.ts::deleteImageKitFileSafe) y para limpiar ImageKit
-- al anonimizar la cuenta (lib/admin/anonymize-profile.ts, Fase 6).
--
-- Ambas parejas de columnas son NULLABLE y genéricas para cualquier rol
-- (avatar_url podría reutilizarse a futuro para cliente/restaurante); la
-- regla "yape_qr solo tiene sentido para DELIVERY" se aplica en la capa
-- de aplicación (server actions, Fase 3), no como constraint de base de
-- datos — mismo criterio que document_type/vehicle_type, que también son
-- columnas genéricas de `profiles` usadas hoy solo por un rol.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_file_id text,
  add column if not exists yape_qr_url text,
  add column if not exists yape_qr_file_id text;

comment on column public.profiles.avatar_url is
  'Foto de perfil (ImageKit). Columna genérica; hoy solo la UI de repartidor la expone.';
comment on column public.profiles.avatar_file_id is
  'fileId de ImageKit de avatar_url — necesario para borrar el archivo anterior al reemplazar o anonimizar.';
comment on column public.profiles.yape_qr_url is
  'QR de Yape del repartidor para que el cliente le pague directamente. Opcional, solo rol DELIVERY.';
comment on column public.profiles.yape_qr_file_id is
  'fileId de ImageKit de yape_qr_url — mismo motivo que avatar_file_id.';
```

**Por qué no hace falta tocar RLS:** `20260830062645_profile_column_security.sql` usa una **lista negra** (`revoke update (role, is_active) on public.profiles from authenticated`), no una lista blanca. Las columnas nuevas quedan editables por el propio usuario bajo la policy `profiles_update_own` ya existente, exactamente igual que `full_name`/`phone`/`document_type`/`vehicle_type` hoy. **No se necesita ninguna migración de RLS adicional** para que el repartidor pueda guardar su propia foto.

### 1.2 — Actualizar tipos de TypeScript

Editar `types/database.ts`, tabla `profiles`, agregar a `Row`/`Insert`/`Update`:

```ts
avatar_url: string | null
avatar_file_id: string | null
yape_qr_url: string | null
yape_qr_file_id: string | null
```

(Si el proyecto usa `supabase gen types` contra el proyecto vinculado, regenerar en vez de editar a mano — pero el patrón del repo hasta ahora ha sido edición manual coordinada con la migración, ver `docs/decisions-and-learnings.md`, Fase 1.)

### 1.3 — Backfill

Ninguno. Ambas parejas de columnas son `NULL` por defecto — no hay dato previo que migrar, y `NULL` es exactamente el estado correcto para "todavía no subió nada".

---

## Fase 2 — Estrategia de almacenamiento y componente base reutilizable

**Principio (DRY / Vercel best practices):** no se crea un segundo sistema de subida de imágenes. Se extiende el componente genérico ya probado (`ImageUploader`) en vez de duplicar ~200 líneas de lógica de drag&drop/progreso/validación.

### 2.1 — Convención de carpetas en ImageKit

Siguiendo el patrón `/restaurants/{restaurantId}/logo` y `/restaurants/{restaurantId}/products`:

| Recurso | Carpeta |
|---|---|
| Foto de perfil del repartidor | `/repartidores/{profileId}/avatar` |
| QR de Yape del repartidor | `/repartidores/{profileId}/yape-qr` |

Recordatorio (ya documentado en `lib/actions/imagekit.ts`): el folder es **solo organización**, no una frontera de seguridad — la barrera real es que el token de subida solo se emite a un usuario autenticado (`getImageKitAuthParams` ya lo garantiza, sin cambios necesarios ahí).

### 2.2 — Extender `ImageUploader.tsx` con una prop `shape`

Hoy el preview siempre es `rounded-2xl` (cuadrado redondeado). Una foto de perfil se ve mejor circular. En vez de crear `AvatarImageUploader.tsx` como copia completa, se agrega una prop opcional:

```ts
// components/features/restaurants/ImageUploader.tsx
export function ImageUploader({
  // ...props existentes
  shape = 'square',
}: {
  // ...
  shape?: 'square' | 'circle'
}) {
  // ...
  className={cn(
    'group/uploader relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden border-2 bg-muted/40 transition-colors',
    SIZE_CLASSES[size],
    shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
    preview ? 'border-solid border-transparent' : 'border-dashed',
    // ...resto igual
  )}
```

El botón "Quitar" (`XIcon` en `right-1.5 top-1.5`) y el overlay "Cambiar" no necesitan cambios: funcionan igual sobre un círculo. Esta es la única edición al componente compartido — **cero riesgo de regresión** para `LogoUploader`/`ProductForm`, que simplemente no pasan `shape` y siguen viendo `square` (el default).

> **Nota de mejora opcional (no bloqueante):** `next.config.ts` ya declara `ik.imagekit.io` como `remotePattern`, así que el preview podría usar `next/image` en vez de `<img>` (hoy con `eslint-disable @next/next/no-img-element`) para aprovechar optimización automática. Se documenta aquí para no perderlo de vista, pero se deja fuera del alcance mínimo porque toca un componente muy compartido y no es lo que se pidió.

---

## Fase 3 — Server Actions

**Objetivo:** cuatro mutaciones nuevas en `lib/actions/profile.ts`, siguiendo exactamente el patrón ya validado de `saveRestaurantLogo()`.

```ts
// lib/actions/profile.ts
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

async function getCurrentAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, authId: user.id }
}

/**
 * Guarda/reemplaza la foto de perfil del usuario autenticado. Genérico por
 * diseño (cualquier rol podría tener avatar a futuro); hoy solo la UI de
 * repartidor llama a esta acción.
 */
export async function saveAvatar(image: { url: string; fileId: string }) {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: image.url, avatar_file_id: image.fileId })
    .eq('auth_id', authId)
  if (error) throw new Error(error.message)

  // Limpieza del archivo anterior DESPUÉS de guardar el nuevo con éxito —
  // mismo orden y misma razón que saveRestaurantLogo().
  await deleteImageKitFileSafe(current?.avatar_file_id)

  revalidatePath('/repartidor/perfil')
  return { success: true }
}

export async function removeAvatar() {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, avatar_file_id: null })
    .eq('auth_id', authId)
  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(current?.avatar_file_id)
  revalidatePath('/repartidor/perfil')
  return { success: true }
}

/**
 * Guarda/reemplaza el QR de Yape. A diferencia de saveAvatar, SÍ valida rol:
 * solo tiene sentido de negocio para repartidores (cobran directo al
 * cliente). La policy RLS no distingue por columna, así que la guarda vive
 * aquí — mismo criterio que otras reglas de negocio del proyecto que no son
 * expresables en RLS (ver lib/actions/deliveries.ts::acceptOrder).
 */
export async function saveYapeQr(image: { url: string; fileId: string }) {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, yape_qr_file_id')
    .eq('auth_id', authId)
    .single()

  if (profile?.role !== 'DELIVERY') {
    throw new Error('Solo los repartidores pueden subir un QR de Yape')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ yape_qr_url: image.url, yape_qr_file_id: image.fileId })
    .eq('auth_id', authId)
  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(profile.yape_qr_file_id)
  revalidatePath('/repartidor/perfil')
  return { success: true }
}

export async function removeYapeQr() {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('yape_qr_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ yape_qr_url: null, yape_qr_file_id: null })
    .eq('auth_id', authId)
  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(profile?.yape_qr_file_id)
  revalidatePath('/repartidor/perfil')
  return { success: true }
}
```

**Decisiones de diseño explícitas:**
- Se usa el cliente normal (`createClient()`, respeta RLS), no `service_role` — el propio usuario editando su propia fila es exactamente el caso que `profiles_update_own` cubre. No hace falta `adminClient()` aquí.
- `saveYapeQr` valida el rol en servidor (nunca confiar en que el botón "no se muestre" en el cliente sea suficiente — un usuario CUSTOMER no debería poder invocar la Server Action directamente con curl/DevTools y guardar un `yape_qr_url`).
- El orden guardar-primero-borrar-después es el mismo que ya usa `saveRestaurantLogo`: si el borrado en ImageKit falla, el usuario igual se queda con su foto nueva guardada (falla "hacia adelante", nunca deja al usuario sin foto por un error de limpieza).

---

## Fase 4 — Componentes de UI nuevos

### 4.1 — `AvatarUploader.tsx`

`components/features/profile/AvatarUploader.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { ImageUploader, type UploadedImage } from '@/components/features/restaurants/ImageUploader'
import { saveAvatar, removeAvatar } from '@/lib/actions/profile'
import { useToast } from '@/components/ui/toast'

export function AvatarUploader({
  profileId,
  currentAvatarUrl,
}: {
  profileId: string
  currentAvatarUrl: string | null
}) {
  const [, startTransition] = useTransition()
  const { error } = useToast()

  function handleUploaded(image: UploadedImage) {
    startTransition(async () => {
      try {
        await saveAvatar(image)
      } catch (err) {
        error('No se pudo guardar la foto', err instanceof Error ? err.message : undefined)
      }
    })
  }

  function handleRemove() {
    startTransition(() => removeAvatar())
  }

  return (
    <ImageUploader
      label="Foto de perfil"
      currentUrl={currentAvatarUrl}
      folder={`/repartidores/${profileId}/avatar`}
      shape="circle"
      onUploaded={handleUploaded}
      onRemove={handleRemove}
      size="lg"
      align="center"
      helpText="Se muestra en tu perfil. JPG, PNG o WEBP, máx. 3MB."
    />
  )
}
```

### 4.2 — `YapeQrUploader.tsx`

`components/features/profile/YapeQrUploader.tsx` — mismo esqueleto que `AvatarUploader`, con estas diferencias intencionales:

```tsx
'use client'

import { useTransition } from 'react'
import { ImageUploader, type UploadedImage } from '@/components/features/restaurants/ImageUploader'
import { saveYapeQr, removeYapeQr } from '@/lib/actions/profile'
import { useToast } from '@/components/ui/toast'

export function YapeQrUploader({
  profileId,
  currentYapeQrUrl,
}: {
  profileId: string
  currentYapeQrUrl: string | null
}) {
  const [, startTransition] = useTransition()
  const { error } = useToast()

  function handleUploaded(image: UploadedImage) {
    startTransition(async () => {
      try {
        await saveYapeQr(image)
      } catch (err) {
        error('No se pudo guardar el QR', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Los clientes podrán escanear este código para pagarte directamente
        por Yape cuando entregues su pedido. Es opcional.
      </p>
      <ImageUploader
        label="QR de Yape"
        currentUrl={currentYapeQrUrl}
        folder={`/repartidores/${profileId}/yape-qr`}
        shape="square"
        onUploaded={handleUploaded}
        onRemove={() => startTransition(() => removeYapeQr())}
        size="lg"
        align="center"
        helpText="Sube una foto nítida de tu QR de Yape · JPG, PNG o WEBP, máx. 3MB."
      />
    </div>
  )
}
```

`shape="square"` a propósito: un QR recortado en círculo puede volverse ilegible en las esquinas al escanearlo.

### 4.3 — Extraer `PasswordChangeForm` a su propio archivo

Hoy vive **anidado dentro** de `ProfileForm.tsx`. Se extrae a `components/features/profile/PasswordChangeForm.tsx` por responsabilidad única (un archivo, un componente) y para poder usarlo en su propia tarjeta en la página de repartidor sin arrastrar el resto del formulario de datos personales.

Primero, un componente genérico de input de contraseña con mostrar/ocultar — el registro ya tiene esta UX (`PasswordField.tsx`) y el cambio de contraseña debe sentirse igual de cuidado:

`components/ui/password-input.tsx` (nuevo, genérico, sin acoplarse a la carpeta de `registration`):

```tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  )
}
```

Ahora `components/features/profile/PasswordChangeForm.tsx`:

```tsx
'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { changePassword } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { CheckCircle2Icon } from 'lucide-react'

export function PasswordChangeForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    startTransition(async () => {
      try {
        await changePassword(password)
        setPassword('')
        setConfirm('')
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <PasswordInput
          id="newPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <PasswordInput
          id="confirmPassword"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!error}
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2Icon className="h-4 w-4" /> Contraseña actualizada.
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}
```

**Compatibilidad hacia atrás:** en `ProfileForm.tsx`, la función `PasswordChangeForm` definida inline se reemplaza por `import { PasswordChangeForm } from './PasswordChangeForm'`, y el bloque `{showPasswordChange && <PasswordChangeForm />}` sigue funcionando exactamente igual para Cliente, Restaurante y Admin (cero cambios en esas tres páginas). Solo la página de Repartidor deja de pasar `showPasswordChange` y en su lugar monta `<PasswordChangeForm />` en su propia tarjeta (Fase 5).

> **Nota de consistencia (opcional, fuera del alcance mínimo):** `PasswordField.tsx` del formulario de registro podría migrar a usar internamente `<PasswordInput>` en vez de reimplementar el ícono de ojo, para no tener dos implementaciones del mismo control. Se deja como mejora futura para no tocar el flujo de registro sin que se haya pedido.

---

## Fase 5 — Reorganización de `/repartidor/perfil` (el pedido central)

**Objetivo de UX:** pasar de "un formulario largo con la contraseña escondida al final" a **cuatro tarjetas con responsabilidad clara**, cada una con su título e ícono, siguiendo el mismo patrón visual que ya usa `app/restaurante/negocio/page.tsx` (que combina `LogoUploader` + `BusinessInfoForm` + `BusinessStatusSwitch` en tarjetas separadas dentro de la misma página).

### 5.1 — Nuevo `app/repartidor/perfil/page.tsx`

```tsx
import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { AvatarUploader } from '@/components/features/profile/AvatarUploader'
import { YapeQrUploader } from '@/components/features/profile/YapeQrUploader'
import { PasswordChangeForm } from '@/components/features/profile/PasswordChangeForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserIcon, QrCodeIcon, ShieldCheckIcon, ImageIcon } from 'lucide-react'

export default async function RepartidorProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, document_type, document_number, vehicle_type, avatar_url, yape_qr_url'
    )
    .eq('auth_id', user!.id)
    .single()

  return (
    <PageContainer size="sm">
      <PageHeader
        title="Mi perfil"
        description="Tus datos personales, tu foto y cómo te pagan tus clientes."
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Foto de perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUploader
              profileId={profile!.id}
              currentAvatarUrl={profile?.avatar_url ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              Datos personales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={user!.email ?? ''}
              initialData={{
                fullName: profile?.full_name ?? '',
                phone: profile?.phone ?? '',
                documentType: profile?.document_type ?? '',
                documentNumber: profile?.document_number ?? '',
                vehicleType: profile?.vehicle_type ?? '',
              }}
              showDeliveryFields
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCodeIcon className="h-4 w-4 text-muted-foreground" />
              Cobro por Yape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <YapeQrUploader
              profileId={profile!.id}
              currentYapeQrUrl={profile?.yape_qr_url ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
```

**Cambios respecto a la versión actual:**
- `PageContainer` pasa de `size="sm"` (ya era `sm` — se mantiene, el ancho angosto sigue siendo el correcto para un formulario de perfil).
- Ya **no** se pasa `showPasswordChange` a `<ProfileForm>` — la contraseña vive en su propia tarjeta.
- `ProfileForm` recibe los mismos `initialData` de siempre; internamente ahora también renderiza el selector de vehículo (Fase 7).
- Cuatro tarjetas con ícono + título consistente (mismo patrón `flex items-center gap-2 text-base` que ya usan `RecentOrdersTable`/`AdminDashboardCharts` para sus `CardTitle`).

### 5.2 — Checklist de UX de esta fase

- [ ] Cada tarjeta cabe sin scroll horizontal en 375px (mobile).
- [ ] El estado de carga de cada subida (barra de progreso del `ImageUploader`) es independiente entre avatar y QR — subir uno no bloquea el otro.
- [ ] Los toasts de éxito/error (`useToast`) dan feedback inmediato sin recargar la página (los Server Actions ya usan `revalidatePath`, así que el Server Component se re-renderiza solo).
- [ ] El foco de teclado sigue un orden lógico: foto → nombre → teléfono → vehículo → QR → contraseña.
- [ ] `aria-label` en los botones de mostrar/ocultar contraseña y en el botón "Quitar" del uploader (ya existen en `ImageUploader`, verificar que se conserven).

---

## Fase 6 — Ciclo de vida de datos y cumplimiento (Ley 29733)

Esta fase es la que un desarrollador con experiencia no se puede saltar: **una foto de rostro es un dato personal más sensible que un nombre**, y el proyecto ya tiene un patrón maduro de anonimización (`lib/admin/anonymize-profile.ts`) que hoy **no sabe que estas columnas van a existir**.

### 6.1 — Actualizar `lib/admin/anonymize-profile.ts`

```ts
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

export async function anonymizeProfile(
  client: AdminClient,
  profileId: string
): Promise<void> {
  // Se leen los fileId ANTES de anonimizar, para poder borrarlos de
  // ImageKit — mismo orden que remove-restaurant.ts (leer fileIds, borrar
  // de ImageKit, luego limpiar la fila). Si no se limpian aquí, la foto y
  // el QR de un repartidor "eliminado" seguirían siendo públicamente
  // accesibles por su URL de ImageKit para siempre.
  const { data: current } = await client
    .from('profiles')
    .select('avatar_file_id, yape_qr_file_id')
    .eq('id', profileId)
    .maybeSingle()

  const { error: profileError } = await client
    .from('profiles')
    .update({
      full_name: ANONYMOUS_NAME,
      phone: null,
      email: null,
      document_type: null,
      document_number: null,
      avatar_url: null,
      avatar_file_id: null,
      yape_qr_url: null,
      yape_qr_file_id: null,
      anonymized_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (profileError) throw new Error(profileError.message)

  await Promise.all([
    deleteImageKitFileSafe(current?.avatar_file_id),
    deleteImageKitFileSafe(current?.yape_qr_file_id),
  ])

  const { error: addressError } = await client
    .from('addresses')
    .update({ address_text: ANONYMOUS_ADDRESS_TEXT, reference: null })
    .eq('customer_id', profileId)
  if (addressError) throw new Error(addressError.message)
}
```

`deleteImageKitFileSafe` nunca lanza (es "mejor esfuerzo", ver `lib/imagekit-server.ts`), así que un fallo de red hacia ImageKit no bloquea la anonimización de la cuenta — igual que ya ocurre hoy con `deleteRestaurant`.

### 6.2 — Actualizar la Política de Privacidad

`app/(public)/privacidad/page.tsx`, Sección 2 ("Datos que recopilamos") — agregar una línea a la lista existente:

```tsx
<li>
  Foto de perfil y código QR de pagos por Yape — opcional, solo repartidores.
</li>
```

Y en la Sección 6 ("Conservación de datos"), donde ya se documenta qué pasa con `full_name`/`phone`/`document_*` al eliminar una cuenta con historial, agregar que la foto de perfil y el QR **también se anonimizan/borran** junto con el resto de la identificación (ya cubierto por el texto genérico "tus datos de identificación... se anonimizan", pero vale la pena ser explícito dado que son las primeras imágenes de PII que recoge la plataforma).

### 6.3 — (Opcional, recomendado) Mostrar el avatar en el panel de Admin

Ya que el admin gestiona repartidores (`DeliveryTable.tsx`, `EditDeliveryDialog.tsx`), es una mejora de bajo esfuerzo y alto valor operativo mostrar una miniatura del avatar junto al nombre en la tabla, y el avatar/QR en modo solo-lectura dentro de `EditDeliveryDialog`. **No se incluye en el CSV de exportación** (`app/api/admin/export/route.ts`): una URL de imagen no aporta valor a un reporte contable/tributario y agregarla sería ruido, no dato.

---

## Fase 7 — Bug fix relacionado: `vehicleType` editable (recomendado, bajo riesgo)

Diagnosticado en la Fase 0.1. Cambio acotado a `ProfileForm.tsx`, dentro del bloque `showDeliveryFields`:

```tsx
{showDeliveryFields ? (
  <div className="grid grid-cols-2 gap-2">
    <div className="space-y-1">
      <Label htmlFor="phone">Celular</Label>
      <Input
        id="phone"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        placeholder="987654321"
      />
    </div>
    <div className="space-y-1">
      <Label htmlFor="documentNumber">N° de documento</Label>
      <Input id="documentNumber" value={form.documentNumber ?? ''} disabled />
    </div>
    <div className="col-span-2 space-y-1">
      <Label htmlFor="vehicleType">Vehículo</Label>
      <Select
        value={form.vehicleType || undefined}
        onValueChange={(value) =>
          setForm((f) => ({ ...f, vehicleType: value ?? '' }))
        }
      >
        <SelectTrigger id="vehicleType" className="w-full">
          <SelectValue placeholder="Selecciona tu vehículo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Moto">Moto</SelectItem>
          <SelectItem value="Bicicleta">Bicicleta</SelectItem>
          <SelectItem value="Auto">Auto</SelectItem>
          <SelectItem value="A pie">A pie</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
) : (
  // ...bloque de cliente/restaurante sin cambios
)}
```

No requiere cambios en `lib/actions/profile.ts::updateProfile()` ni en `lib/validations/profile.ts` — ambos **ya** aceptan y persisten `vehicleType`. Es puramente una pieza de UI que faltaba.

> Nota aparte (fuera de alcance, solo para que quede registrado): el registro público de repartidor (`registrationConfig.tsx::deliveryConfig`) hoy **hardcodea** `vehicleType: 'Moto'` sin preguntarlo — con este fix el repartidor al menos puede corregirlo después desde su perfil, pero preguntarlo en el registro sería lo ideal a futuro.

---

## Fase 8 — QA: checklist de pruebas manuales

- [ ] Subir foto de perfil por primera vez: se guarda `avatar_url`/`avatar_file_id`, se ve el preview circular, toast de éxito.
- [ ] Reemplazar la foto de perfil: el archivo **anterior** desaparece de la cuenta de ImageKit (verificar en el dashboard de ImageKit), el nuevo queda activo.
- [ ] Quitar la foto de perfil: `avatar_url`/`avatar_file_id` quedan `NULL`, el archivo se borra de ImageKit, el uploader vuelve al estado "Subir foto".
- [ ] Repetir los tres casos anteriores para el QR de Yape.
- [ ] Un usuario con rol `CUSTOMER` o `RESTAURANT` **no puede** invocar `saveYapeQr` con éxito (probar llamando la Server Action fuera de la UI, ej. con una sesión de cliente — debe lanzar "Solo los repartidores pueden subir un QR de Yape").
- [ ] Cambiar contraseña: mostrar/ocultar funciona en ambos campos, error si <8 caracteres, error si no coinciden, éxito limpia el formulario.
- [ ] `pnpm run typecheck` y `pnpm run lint` sin errores nuevos en los archivos tocados.
- [ ] Anonimizar (eliminar) una cuenta de repartidor con historial de entregas que tenga avatar y QR cargados: ambos desaparecen de `profiles` **y** de ImageKit; la cuenta ya no puede iniciar sesión (comportamiento ya cubierto por `deleteUser()`, solo se agrega la limpieza de imágenes).
- [ ] Verificar en mobile (375px) que las cuatro tarjetas no generan scroll horizontal y que el uploader circular se ve bien recortado.
- [ ] Verificar que `/restaurante/perfil`, `/cliente/perfil` y `/admin/perfil` (que siguen usando `ProfileForm` con `showPasswordChange`) **no cambiaron visualmente** — regresión cero para esos tres roles.

---

## Fase 9 — Orden de despliegue

1. **Migración de la Fase 1** — aditiva, sin bloqueos, sin backfill. Aplicar con `supabase db push` antes que cualquier código que la use.
2. **Regenerar/editar `types/database.ts`** en el mismo commit que la migración.
3. **Fase 2 (extensión de `ImageUploader`)** — cambio de bajo riesgo, se puede desplegar independientemente; verificar que `LogoUploader`/`ProductForm` siguen viéndose iguales.
4. **Fases 3 y 4 (Server Actions + componentes nuevos)** — no tienen efecto hasta que algo los monte; se pueden mergear antes que la Fase 5 sin riesgo.
5. **Fase 5 (reorganización de la página)** — el entregable visible; desplegar junto con las Fases 6 y 7 en el mismo release, ya que todas tocan el mismo módulo y conviene probarlas juntas.
6. **Fase 6 (anonimización + privacidad)** — crítico desplegarla **en el mismo release** que la Fase 5, nunca después: si un admin anonimiza una cuenta entre que se despliega la subida de fotos y el fix de `anonymize-profile.ts`, esa cuenta quedaría con una foto huérfana sin limpiar.
7. **Fase 8 (QA)** antes de cerrar el ciclo.

---

## Consideraciones futuras (fuera de alcance de este plan)

- **Mostrar el avatar del repartidor al cliente durante el seguimiento en vivo** (`OrderStatusSection.tsx`/`DeliveryOrderCard.tsx`): hoy el cliente no tiene ninguna policy de `SELECT` sobre el perfil del repartidor asignado. Requeriría una nueva policy RLS acotada (columnas `full_name`/`avatar_url` únicamente, solo mientras el pedido está en curso) — es una feature de confianza/UX valiosa, pero es un cambio de superficie de datos que merece su propio plan y su propia revisión de privacidad.
- **Selector de vehículo en el registro público** (`RegistrationForm`/`deliveryConfig`), hoy hardcodeado a `"Moto"`.
- **Unificar `PasswordField.tsx` (registro) con `PasswordInput.tsx` (nuevo)** para no mantener dos implementaciones del mismo control.
- **Migrar el preview de `ImageUploader` a `next/image`** (el dominio `ik.imagekit.io` ya está permitido en `next.config.ts`).

---

## Resumen de archivos nuevos y modificados

**Nuevos:**
- `supabase/migrations/20260928000000_profiles_delivery_media.sql`
- `components/features/profile/AvatarUploader.tsx`
- `components/features/profile/YapeQrUploader.tsx`
- `components/features/profile/PasswordChangeForm.tsx`
- `components/ui/password-input.tsx`

**Modificados:**
- `types/database.ts` — columnas nuevas en `profiles`.
- `components/features/restaurants/ImageUploader.tsx` — prop `shape` (`'square' | 'circle'`).
- `lib/actions/profile.ts` — `saveAvatar`, `removeAvatar`, `saveYapeQr`, `removeYapeQr`.
- `components/features/profile/ProfileForm.tsx` — usa `PasswordChangeForm` extraído; agrega `<Select>` de `vehicleType` (Fase 7).
- `app/repartidor/perfil/page.tsx` — reorganizado en cuatro tarjetas.
- `lib/admin/anonymize-profile.ts` — limpia avatar/QR de ImageKit al anonimizar.
- `app/(public)/privacidad/page.tsx` — menciona la nueva foto/QR en "Datos que recopilamos".
- *(Opcional, Fase 6.3)* `components/features/admin/DeliveryTable.tsx`, `components/features/admin/EditDeliveryDialog.tsx` — miniatura de avatar en el panel de admin.

Ningún otro archivo del repo necesita tocarse para cumplir lo pedido.
