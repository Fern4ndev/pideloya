/**
 * Helpers de fecha del dashboard de admin. El día "hoy" se define SIEMPRE en
 * el servidor (componente de página) y se pasa como prop a los componentes
 * cliente, para que el snapshot del HTML coincida con la hidratación y no
 * falle (hydration mismatch por `new Date()` distinto entre server y browser).
 */

export const DAY_MS = 86_400_000

export const RANGE_MAX_DAYS = 366

export const WEEKDAYS_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export const MONTHS_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Clave YYYY-MM-DD del día en horario de Lima (aunque el server corra en UTC). */
export function limaDayKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })
}

export function dayParts(key: string): { month: number; day: number; weekday: number } {
  const [year, month, day] = key.split('-').map(Number)
  // Hora fija (17h UTC) evita saltos de día por zona horaria. weekday:
  // getUTCDay() 0=Domingo → se convierte a 0=Lunes … 6=Domingo.
  const weekday = (new Date(Date.UTC(year, month - 1, day, 17)).getUTCDay() + 6) % 7
  return { month, day, weekday }
}

export function addDays(key: string, days: number): string {
  return limaDayKey(new Date(new Date(`${key}T12:00:00-05:00`).getTime() + days * DAY_MS))
}

export function formatFullDate(key: string): string {
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}