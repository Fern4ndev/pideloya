'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * Miniatura de un repartidor para el panel de admin: su foto de perfil y,
 * si no tiene (o la URL falla), su inicial sobre el degradado de marca —
 * el mismo avatar de identidad que ya usan el header y el sidebar.
 *
 * Se apoya en `Avatar` de Base UI, que cambia él solo al `AvatarFallback`
 * cuando la imagen no carga: una URL muerta no deja el ícono de imagen
 * rota en la tabla. El `alt` va vacío a propósito — la miniatura es
 * decorativa, el nombre del repartidor está siempre al lado.
 */
export function DeliveryAvatar({
  url,
  name,
  size = 'sm',
}: {
  url: string | null
  name: string
  size?: 'sm' | 'default' | 'lg'
}) {
  return (
    <Avatar size={size}>
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 font-semibold text-white">
        {name.charAt(0).toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  )
}
