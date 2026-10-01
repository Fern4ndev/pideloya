/**
 * Incidencias de pago (Fase 8 del plan "Pagar al recibir").
 *
 * Los valores son EXACTAMENTE los del CHECK de `public.payment_incidents.kind`
 * (migración 20261002100500) y el contrato de `report_payment_incident`. La
 * whitelist vive en un solo lugar para que la UI, la validación Zod y el SQL no
 * puedan divergir: un valor nuevo se agrega acá, en la migración y en el RPC.
 *
 * Qué puede reportar cada parte lo decide la FUNCIÓN, no la UI (una Server
 * Action es un endpoint público): el repartidor no puede firmar un
 * RESTAURANT_NOT_PAID ni el restaurante un CUSTOMER_DID_NOT_PAY.
 */
export const PAYMENT_INCIDENT_KINDS = [
  'CUSTOMER_DID_NOT_PAY',
  'AMOUNT_MISMATCH',
  'OTHER',
  'RESTAURANT_NOT_PAID',
] as const

export type PaymentIncidentKind = (typeof PAYMENT_INCIDENT_KINDS)[number]

/** Tipos que puede reportar el repartidor (los tres del diálogo "No pude cobrar"). */
export const COURIER_INCIDENT_KINDS = [
  'CUSTOMER_DID_NOT_PAY',
  'AMOUNT_MISMATCH',
  'OTHER',
] as const satisfies readonly PaymentIncidentKind[]

export const PAYMENT_INCIDENT_KIND_COPY: Record<PaymentIncidentKind, string> = {
  CUSTOMER_DID_NOT_PAY: 'El cliente no está o no paga',
  AMOUNT_MISMATCH: 'El monto no coincide',
  OTHER: 'Otro',
  RESTAURANT_NOT_PAID: 'No registré el pago de la comida',
}

/** Rol que reporta, para los mensajes de la UI (el valor real lo fija el RPC). */
export const PAYMENT_INCIDENT_REPORTER_COPY: Record<string, string> = {
  DELIVERY: 'Repartidor',
  RESTAURANT: 'Restaurante',
  CUSTOMER: 'Cliente',
}
