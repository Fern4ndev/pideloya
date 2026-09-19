'use client'

import dynamic from 'next/dynamic'

const DeliveryRegisterForm = dynamic(
  () =>
    import('@/components/features/registration/DeliveryRegisterForm').then(
      (m) => ({ default: m.DeliveryRegisterForm })
    ),
  { ssr: false }
)

const RestaurantRegisterForm = dynamic(
  () =>
    import('@/components/features/registration/RestaurantRegisterForm').then(
      (m) => ({ default: m.RestaurantRegisterForm })
    ),
  { ssr: false }
)

export function RegistrationForms({ tipo }: { tipo: string }) {
  return tipo === 'repartidor' ? (
    <DeliveryRegisterForm />
  ) : (
    <RestaurantRegisterForm />
  )
}
