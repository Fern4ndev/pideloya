'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PasswordChangeForm } from './PasswordChangeForm'
import { KeyRoundIcon } from 'lucide-react'

/**
 * Botón "Cambiar contraseña" + modal que monta `PasswordChangeForm`.
 *
 * En el panel del repartidor el formulario dejó de vivir en su propia
 * tarjeta ("Seguridad") y pasó a abrirse desde la card de datos
 * personales: menos tarjetas para el mismo responsable y el modal no
 * empuja el resto del contenido. Mismo patrón de diálogo controlado que
 * `AddressFormDialog` (estado `open` local, trigger con `render`).
 */
export function PasswordChangeDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-1.5">
            <KeyRoundIcon className="size-4" />
            Cambiar contraseña
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Define una contraseña nueva para tu cuenta. Mínimo 8 caracteres.
          </DialogDescription>
        </DialogHeader>
        <PasswordChangeForm />
      </DialogContent>
    </Dialog>
  )
}
