import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/db/server'
import { fetchPendingApprovalCounts } from '@/lib/admin/query-builders'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const role = h.get('x-user-role')
  const isActive = h.get('x-user-active')
  const fullName = h.get('x-user-name') || 'Admin'

  if (role !== 'ADMIN' || isActive !== 'true') redirect('/login')

  // Pendientes de aprobación para los badges del sidebar (Fase 10 del plan
  // del panel admin): dos `count` (sin traer filas) en paralelo, con los
  // MISMOS filtros que las listas a las que enlazan.
  //
  // Best-effort a propósito: si el conteo falla, se registra y el panel se
  // muestra sin badges — un adorno no puede tumbar todas las páginas de
  // admin. El rol ya se validó arriba contra las cabeceras del middleware.
  let pending = { restaurants: 0, deliveries: 0 }
  try {
    pending = await fetchPendingApprovalCounts(await createClient())
  } catch (err) {
    console.error('No se pudieron contar los pendientes del sidebar:', err)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Realtime a nivel de LAYOUT, no de página: el badge debe
       * actualizarse en cualquier pantalla del panel, no solo en las dos
       * listas. Como `router.refresh()` re-ejecuta también los server
       * components de la página actual, estos dos canales cubren además el
       * refresco de las listas — por eso ya no se montan en ellas (serían
       * suscripciones duplicadas que dispararían dos refrescos por evento).
       * INSERT + filtro server-side: las ediciones de filas existentes
       * (toggle de is_open, edición de un negocio ya aprobado) no cuentan
       * como alta pendiente y no refrescan nada. */}
      <RealtimeRefresh
        channelName="admin-pendientes-restaurantes"
        table="restaurants"
        event="INSERT"
        filter="is_approved=eq.false"
      />
      <RealtimeRefresh
        channelName="admin-pendientes-repartidores"
        table="profiles"
        event="INSERT"
        filter="role=eq.DELIVERY"
      />
      <AdminSidebar
        fullName={fullName}
        pendingRestaurants={pending.restaurants}
        pendingDeliveries={pending.deliveries}
      />
      <main className="flex-1 overflow-y-auto px-8 pt-16 pb-6 lg:py-6">{children}</main>
    </div>
  )
}