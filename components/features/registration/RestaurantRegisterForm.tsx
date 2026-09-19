import { RegistrationForm } from './shared/RegistrationForm'
import { restaurantConfig } from './shared/registrationConfig'

export function RestaurantRegisterForm() {
  return <RegistrationForm config={restaurantConfig} />
}
