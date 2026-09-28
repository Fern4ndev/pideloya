/**
 * Formatea un celular peruano para mostrarlo: '987654321' → '987 654 321'.
 *
 * Por qué agrupar y no mostrar los 9 dígitos pegados: el número se lee y se
 * dicta en voz alta ("nueve ocho siete, seis cinco cuatro..."), y en bloques de
 * 3 es donde el ojo y la voz se detienen solos. Lo que se COPIA al portapapeles
 * son los 9 dígitos sin espacios (lo que Yape acepta al pegar) — el formato es
 * solo de presentación, así que el usuario nunca ve la diferencia.
 *
 * Cualquier cosa que no sean exactamente 9 dígitos se devuelve tal cual: es un
 * dato que ya se validó al registrar (^9\d{8}$), y preferimos mostrar algo raro
 * a inventar una agrupación sobre un formato desconocido.
 */
export function formatPePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 9
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : raw
}
