'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/toast'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/constants/order-status'

/**
 * Avisa al cliente cuando el estado del pedido cambia por algo que NO hizo él
 * (plan-realtime-oferta-telefono-y-voucher-yape.md, Fase 1.3).
 *
 * Por qué existe, teniendo ya el timeline: la tarjeta de pago ahora aparece
 * sola (Fase 1.2), y una tarjeta que "aparece sola" puede pasar desapercibida
 * si el cliente está mirando el timeline o tiene el teléfono en la mano. Aquí
 * viven las dos transiciones que el cliente no provocó y que cambian lo que
 * tiene que hacer:
 *
 * - alguien le ofrece un envío (hay una decisión de pago pendiente) → info;
 * - la oferta se retiró o expiró (volvió a PENDING) → warning, porque el
 *   cliente ya había visto un monto y un repartidor con nombre y ahora no hay
 *   ninguno. Sin aviso, la desaparición de la tarjeta parece un fallo de la
 *   app, no una noticia.
 *
 * No dibuja nada visible: sólo el toast y una región viva para lectores de
 * pantalla. Se compara contra el estado ANTERIOR (no contra el inicial), así
 * que abrir un pedido que ya estaba en AWAITING_PAYMENT no dispara ningún
 * aviso: no hubo transición estando el cliente en la pantalla.
 */
export function OrderStatusAnnouncer({ status }: { status: OrderStatus }) {
  const prevStatus = useRef(status)
  const { info, warning } = useToast()

  useEffect(() => {
    const before = prevStatus.current
    prevStatus.current = status
    if (before === status) return

    if (status === 'AWAITING_PAYMENT') {
      // Una línea, sin repetir el monto: la tarjeta de pago que acaba de
      // aparecer ya lo muestra en cada opción, y el toast no compite con ella.
      info('Tu repartidor envió su oferta', 'Elige cómo pagar.')
      return
    }
    if (before === 'AWAITING_PAYMENT' && status === 'PENDING') {
      warning('El repartidor retiró su oferta', 'Seguimos buscando otro repartidor.')
    }
  }, [status, info, warning])

  // El cambio de estado se anuncia también sin toast (el toast de Sonner ya
  // vive en su propio contenedor con aria-label "Notificaciones", pero no está
  // garantizado que el lector de pantalla lo anuncie). `role="status"`
  // implica aria-live="polite"; se declara explícito por claridad.
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {ORDER_STATUS_LABELS[status]}
    </p>
  )
}
