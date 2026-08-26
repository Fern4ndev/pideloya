'use client'

import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Arregla un bug conocido: los íconos por defecto de Leaflet apuntan a
// rutas que los bundlers modernos (Webpack/Turbopack) rompen. Sin esto,
// el pin del mapa simplemente no se ve.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: (markerIcon2x as unknown as { src: string }).src ?? markerIcon2x,
  iconUrl: (markerIcon as unknown as { src: string }).src ?? markerIcon,
  shadowUrl: (markerShadow as unknown as { src: string }).src ?? markerShadow,
})

// Centro por defecto: Plaza de Armas de Abancay
const ABANCAY_CENTER: [number, number] = [-13.6339, -72.8814]

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Recentra el mapa cuando las coordenadas cambian desde AFUERA del mapa
 * (ej. al presionar "Usar mi ubicación") — react-leaflet no hace esto
 * automáticamente después del render inicial. */
function RecenterOnChange({
  latitude,
  longitude,
}: {
  latitude: number | null
  longitude: number | null
}) {
  const map = useMap()
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      map.setView([latitude, longitude])
    }
  }, [latitude, longitude, map])
  return null
}

export default function AddressMapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
}) {
  const initialPosition: [number, number] =
    latitude !== null && longitude !== null
      ? [latitude, longitude]
      : ABANCAY_CENTER

  return (
    <div className="h-64 w-full overflow-hidden rounded-lg border">
      <MapContainer
        center={initialPosition}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        <RecenterOnChange latitude={latitude} longitude={longitude} />
        {latitude !== null && longitude !== null && (
          <Marker
            position={[latitude, longitude]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onChange(lat, lng)
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}