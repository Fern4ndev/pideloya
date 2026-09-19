import { RegistrationForm } from './shared/RegistrationForm'
import { deliveryConfig } from './shared/registrationConfig'

export function DeliveryRegisterForm() {
  return <RegistrationForm config={deliveryConfig} />
}
