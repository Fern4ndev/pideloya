/**
 * Evaluación "¿el restaurante está atendiendo ahora?" basada en el flag del
 * dueño (is_open) y los horarios configurados (restaurant_hours).
 *
 * Convención de días usada en la BD (RestaurantHoursForm): day_of_week
 * 0 = Lunes … 6 = Domingo. OJO: JS Date.getUTCDay() usa 0 = Domingo, por eso
 * se convierte con (getUTCDay() + 6) % 7.
 *
 * Horario Lima = UTC-5 fijo (Perú no usa horario de verano), así que se puede
 * derivar con un offset seguro y determinista.
 */

export interface RestaurantHourInput {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

const LIMA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000

export function isRestaurantOpenNow(
  isOpen: boolean,
  hours: RestaurantHourInput[],
  now: Date = new Date()
): boolean {
  if (!isOpen) return false

  // Sin horarios registrados no hay restricción por horario: se asume abierto
  // (el restaurante nuevo aún no configuró su atención).
  if (hours.length === 0) return true

  const shifted = new Date(now.getTime() - LIMA_UTC_OFFSET_MS)
  const dbDay = (shifted.getUTCDay() + 6) % 7
  const currentMinutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()

  const schedule = hours.find((h) => h.day_of_week === dbDay)
  if (!schedule || schedule.is_closed) return false

  const [openH = -1, openM = 0] = schedule.open_time.split(':').map(Number)
  const [closeH = -1, closeM = 0] = schedule.close_time.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  // Rango normal (open < close). Si close < open, el turno cruza la medianoche
  // (ej. 18:00 – 02:00): abierto después de open y antes de close.
  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}