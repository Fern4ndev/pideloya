'use client'

import { useId, useState, useTransition, type SubmitEvent } from 'react'
import { CheckCircle2Icon } from 'lucide-react'
import { changePassword } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'

/**
 * Cambio de contraseña del usuario autenticado.
 *
 * Vivía anidado dentro de `ProfileForm` (que es un formulario de datos
 * personales); ahora es su propio componente para poder montarlo en una
 * tarjeta independiente — mismo patrón de "una tarjeta, una
 * responsabilidad" que usa el panel del restaurante.
 *
 * El espaciado es el mismo que tenía anidado (`space-y-3` / `space-y-1`)
 * para que las páginas de cliente, restaurante y admin —que lo siguen
 * renderizando dentro de `ProfileForm`— no cambien de aspecto.
 */
export function PasswordChangeForm() {
  // `useId` en vez de ids fijos: si el componente se montara dos veces en
  // la misma página, dos `<input>` con el mismo id harían que la `<Label>`
  // apunte al campo equivocado. Mismo criterio que `ImageUploader`.
  const passwordId = useId()
  const confirmId = useId()

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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={passwordId}>Nueva contraseña</Label>
        <PasswordInput
          id={passwordId}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          // Le dice al gestor de contraseñas que genere y guarde una nueva,
          // en vez de ofrecer autocompletar la actual.
          autoComplete="new-password"
          aria-invalid={!!error}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={confirmId}>Confirmar contraseña</Label>
        <PasswordInput
          id={confirmId}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={!!error}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2Icon className="size-4" aria-hidden="true" />
          Contraseña actualizada.
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}
