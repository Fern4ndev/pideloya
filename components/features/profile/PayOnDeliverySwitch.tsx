'use client'

import { useState, useTransition } from 'react'
import { setAcceptsPayOnDelivery } from '@/lib/actions/profile'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'

/**
 * Interruptor D7 (Fase 7): el repartidor decide si acepta pedidos donde el
 * cliente paga al recibir — modalidad en la que él adelanta el importe de la
 * comida al restaurante y cobra al entregar.
 *
 * Guardado inmediato con toast (patrón `BusinessStatusSwitch`), no diferido
 * con "Guardar cambios": es una sola preferencia, no un formulario, y al
 * apagarla conviene que el repartidor sepa al instante que las ofertas
 * siguientes ya no ofrecerán pago al recibir.
 *
 * El estado local se revierte si el servidor rechaza; sin eso, el interruptor
 * quedaría mintiendo sobre lo que hay en la base.
 */
export function PayOnDeliverySwitch({ initialAccepts }: { initialAccepts: boolean }) {
  const [accepts, setAccepts] = useState(initialAccepts)
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  function handleToggle(checked: boolean) {
    setAccepts(checked)
    startTransition(async () => {
      try {
        await setAcceptsPayOnDelivery(checked)
        success(
          checked ? 'Aceptas pago al recibir' : 'Solo cobras por adelantado',
          checked
            ? 'En tus próximas ofertas el cliente podrá elegir pagarte al recibir.'
            : 'En tus próximas ofertas el cliente solo podrá pagar por adelantado.'
        )
      } catch (err) {
        setAccepts(!checked)
        error('No se pudo guardar la preferencia', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3">
        <Switch
          checked={accepts}
          onCheckedChange={handleToggle}
          disabled={isPending}
          aria-label="Acepto que el cliente pague al recibir"
          className="mt-0.5"
        />
        <span>
          <span className="text-sm font-medium">
            Acepto que el cliente pague al recibir
          </span>
          <span className="block text-sm text-muted-foreground">
            Adelanto la comida de mi dinero y cobro al entregar.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Si lo apagas, tus ofertas nuevas solo permitirán pago por adelantado; las
        que ya enviaste no cambian. Si el cliente no te paga al recibir, reclamas
        la plata con soporte desde la incidencia del pedido.
      </p>
    </div>
  )
}
