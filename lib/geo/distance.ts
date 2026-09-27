/**
 * Distancia en línea recta entre dos puntos — fórmula de Haversine.
 *
 * ¿Por qué Haversine a mano y no una librería? Porque la única pregunta que el
 * producto responde con esto es "¿este envío es corto, medio o largo?" para
 * sugerir una tarifa. Para eso, la diferencia entre la distancia real por
 * calles y la distancia en línea recta es irrelevante (y cualquier API de
 * ruteo agregaría una dependencia, una clave y una latencia en el camino
 * crítico de un repartidor parado en la calle).
 *
 * Vive en `lib/geo` y no dentro de un componente porque es matemática pura:
 * no sabe nada de PideloYa, no toca la base y se puede razonar (y verificar)
 * por separado.
 */

const EARTH_RADIUS_KM = 6371

export type Coordinates = {
  latitude: number | null
  longitude: number | null
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Kilómetros entre dos puntos, o `null` si a alguno le falta la ubicación.
 * Devolver `null` (y no 0) es deliberado: "no sé la distancia" y "están en el
 * mismo punto" son cosas distintas, y el llamador decide qué mostrar en cada
 * caso. `restaurants.latitude/longitude` son nullable en la base, así que el
 * caso es real y no teórico.
 */
export function haversineDistanceKm(from: Coordinates, to: Coordinates): number | null {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null
  ) {
    return null
  }

  const deltaLat = toRadians(to.latitude - from.latitude)
  const deltaLon = toRadians(to.longitude - from.longitude)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/**
 * Distancia lista para mostrar: metros cuando es menos de un kilómetro (700 m
 * se lee mejor que 0.7 km) y un decimal en el resto. Se usa punto decimal, no
 * coma, para no ser el único número del producto formateado distinto al resto
 * (`S/ 5.00`, `2.5 km`).
 */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
