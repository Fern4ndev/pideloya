'use client'

import { useState } from 'react'
import Image from 'next/image'
import { QrCodeIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPePhone } from '@/lib/format/phone'

/**
 * QR de Yape del repartidor A PANTALLA CASI COMPLETA, con el monto al lado.
 *
 * Es el momento de mayor fricción de toda la entrega: el repartidor está en la
 * puerta del cliente, con una mano ocupada y el teléfono del cliente apuntando
 * al suyo. Tres decisiones que no son cosméticas:
 *
 * 1. **Fondo blanco FIJO (`bg-white`)**, no `bg-popover`: el QR tiene que
 *    escanearse también con el teléfono del cliente en modo oscuro. Un QR con
 *    fondo oscuro no lo lee ninguna app de Yape.
 * 2. **Sin animación propia**: hereda la del Dialog del proyecto (100 ms
 *    fade + zoom, que la regla global de `prefers-reduced-motion` ya apaga)
 *    pero no agrega ninguna; en la puerta cada décima cuenta.
 * 3. **El monto, el nombre y el número acompañan al QR**: el cliente necesita
 *    las tres cosas para completar la transferencia (cuánto, a quién, a qué
 *    número) sin cerrar el diálogo.
 *
 * `prefers-reduced-motion`: no agrega ninguna animación propia (la regla global
 * del proyecto ya cubre la de Dialog; acá simplemente no la usamos).
 */
/**
 * Botón "Mostrar mi QR" + diálogo, autocontenidos: la página del detalle es un
 * Server Component y el estado de abrir/cerrar vive acá, que es el único lugar
 * que lo necesita. `DialogTrigger` monta el diálogo solo al abrirlo.
 */
export function CourierQrDialogButton({
  qrUrl,
  fullName,
  phone,
  amount,
}: {
  /** URL firmada del QR (o null: el diálogo muestra el número como vía). */
  qrUrl: string | null
  fullName: string
  phone: string | null
  amount: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <CourierQrDialog
      open={open}
      onOpenChange={setOpen}
      qrUrl={qrUrl}
      fullName={fullName}
      phone={phone}
      amount={amount}
      trigger
    />
  )
}

export function CourierQrDialog({
  open,
  onOpenChange,
  qrUrl,
  fullName,
  phone,
  amount,
  trigger = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** URL firmada del QR de Yape del repartidor (o null si no cargó uno). */
  qrUrl: string | null
  fullName: string
  /** Celular crudo (9 dígitos) o null; la fila solo se muestra si existe. */
  phone: string | null
  /** Monto ya formateado con dos decimales (ej. "27.50"). */
  amount: string
  /** Renderiza el botón disparador dentro del diálogo (uso en el detalle). */
  trigger?: boolean
}) {
  const digits = phone?.replace(/\D/g, '') ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* El disparador existe también SIN QR: el número de Yape es la otra vía
          para cobrar, y esconder el botón cuando el QR falta dejaría al
          repartidor sin nada que mostrar en la puerta. La etiqueta dice la
          verdad de lo que va a encontrar adentro. */}
      {trigger && (
        <DialogTrigger
          render={
            <Button type="button" variant="default" className="w-full rounded-full">
              <QrCodeIcon className="h-4 w-4" aria-hidden />
              {qrUrl ? 'Mostrar mi QR' : 'Mostrar mi número de Yape'}
            </Button>
          }
        />
      )}
      <DialogContent
        // Pantalla casi completa y SIN animación de entrada: es una pantalla de
        // cobro, no una tarjeta decorativa. `sm:max-w-sm` mantiene el QR legible
        // sin estirarlo en desktop.
        className="flex w-[min(100%-2rem,24rem)] flex-col items-center gap-4 rounded-3xl bg-white text-neutral-900 sm:max-w-sm"
        showCloseButton
      >
        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <DialogTitle className="text-base font-semibold">
            Escanéalo y transfiere S/ {amount}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600 *:[a]:underline">
            {fullName} · Yape
          </DialogDescription>
        </div>

        {qrUrl ? (
          // 288 px (w-72) con object-contain: el tamaño mínimo con el que una
          // cámara de media gama lee un QR de Yape a 30 cm. `aspect-square` +
          // `max-w-full` en el envoltorio: a 360 px el QR se encoge en vez de
          // desbordar el diálogo.
          <div className="max-w-full rounded-2xl bg-white p-2 ring-1 ring-neutral-200">
            <div className="relative aspect-square w-72 max-w-full">
              <Image
                src={qrUrl}
                alt={`QR de Yape de ${fullName}`}
                fill
                sizes="288px"
                className="object-contain"
                priority
              />
            </div>
          </div>
        ) : (
          // Degradación: sin QR, el número es la vía (mismo criterio que el
          // panel del cliente). No bloquea el cobro: se explica, no se impide.
          // Sin QR **ni** número el mensaje es otro: prometer "el número de
          // abajo" cuando no hay ninguno sería mentir en la puerta.
          <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-600">
            {digits
              ? 'No cargaste tu QR de Yape. Tu cliente puede yapearte al número de abajo.'
              : 'No cargaste tu QR de Yape ni registraste un celular. Coordina el cobro con tu cliente.'}
          </p>
        )}

        {digits && (
          <p className="select-all text-lg font-semibold tabular-nums tracking-wide">
            {formatPePhone(digits)}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
