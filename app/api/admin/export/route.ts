import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import {
  applyCustomerFilters,
  applyDeliveryFilters,
  applyRestaurantFilters,
  fetchCustomerIdsWithOrders,
  fetchDeliveryPersonIdsOnRoute,
  parseStatusFilter,
  RESTAURANT_STATUS_FILTERS,
  CUSTOMER_STATUS_FILTERS,
  DELIVERY_STATUS_FILTERS,
} from '@/lib/admin/query-builders'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/export?entity=restaurants|customers|deliveries[&q=&status=]
 *
 * Exportación CSV de las tablas admin (Fase 7) reutilizando EXACTAMENTE
 * los mismos appliers de filtros que las páginas — así el CSV refleja
 * los filtros visibles en pantalla al momento de exportar.
 *
 * Autenticación: cookie de sesión + rol ADMIN (mismo gate que el layout
 * de /admin). Este endpoint NO usa Bearer como el resto de /api/v1:
 * el botón "Exportar CSV" es un enlace <a download> del navegador, que
 * viaja con las cookies de sesión. El rol se revalida AQUÍ también por
 * defensa en profundidad: el link no es la autorización, la sesión sí.
 *
 * Cumplimiento (Ley 29733 / retención SUNAT): el export incluye PII
 * (teléfono, documento, email) SOLO para rol ADMIN — garantizado por la
 * verificación de arriba y documentado aquí como recordatorio explícito.
 *
 * Pedidos (si se agregan en el futuro) DEBEN exportarse desde los
 * snapshots (customer_name, customer_phone, product_name en order_items),
 * NO desde joins a profiles/products: una cuenta anonimizada o un
 * producto eliminado romperían el join, y el snapshot es el registro
 * histórico intencional "al momento del pedido".
 */

const EXPORT_ROW_LIMIT = 10_000

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Si contiene comillas, comas o saltos de línea: entrecomillar y
  // duplicar las comillas internas (RFC 4180).
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','))
  }
  // BOM para que Excel respete UTF-8 (nombres con acentos/ñ).
  return '\uFEFF' + lines.join('\r\n')
}

type ExportEntity = 'restaurants' | 'customers' | 'deliveries'

function parseEntity(value: string | null): ExportEntity | undefined {
  return value === 'restaurants' ||
    value === 'customers' ||
    value === 'deliveries'
    ? value
    : undefined
}

function filenameFor(entity: ExportEntity): string {
  const names: Record<ExportEntity, string> = {
    restaurants: 'restaurantes',
    customers: 'clientes',
    deliveries: 'repartidores',
  }
  return `${names[entity]}-${new Date().toISOString().slice(0, 10)}.csv`
}

export async function GET(request: Request) {
  // 1) Gate de sesión + rol ADMIN (mismo modelo que app/admin/layout).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 2) Params con las MISMAS whitelists que las páginas.
  const url = new URL(request.url)
  const entity = parseEntity(url.searchParams.get('entity'))
  if (!entity) {
    return NextResponse.json(
      { error: 'entity debe ser restaurants, customers o deliveries' },
      { status: 400 }
    )
  }
  const query = (url.searchParams.get('q') ?? '').trim()
  const status = url.searchParams.get('status') ?? undefined

  // El export corre con service role porque las páginas admin también
  // cruzan datos de todos los usuarios (flags hasOrders/hasDeliveries);
  // el gate de rol de arriba es el que autoriza, igual que en las páginas.
  const adminClient = createServiceRoleClient()

  let csv: string

  if (entity === 'restaurants') {
    const statusFilter = parseStatusFilter(RESTAURANT_STATUS_FILTERS, status)
    const base = adminClient
      .from('restaurants')
      .select(
        'id, name, address_text, whatsapp, food_type, is_approved, is_active, created_at, restaurant_members(profiles(full_name))'
      )
      .order('created_at', { ascending: false })
    const filtered = applyRestaurantFilters(base, { query, status: statusFilter })
    const { data, error } = await filtered.limit(EXPORT_ROW_LIMIT)
    if (error) {
      console.error('[export] error restaurants:', error.message)
      return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
    }

    csv = toCsv(
      ['ID', 'Nombre', 'Dirección', 'WhatsApp', 'Tipo', 'Aprobado', 'Activo', 'Dueño', 'Registro'],
      (data ?? []).map((r) => [
        r.id,
        r.name,
        r.address_text,
        r.whatsapp,
        r.food_type,
        r.is_approved ? 'sí' : 'no',
        r.is_active ? 'sí' : 'no',
        r.restaurant_members?.[0]?.profiles?.full_name ?? '',
        new Date(r.created_at).toISOString(),
      ])
    )
  } else if (entity === 'customers') {
    const statusFilter = parseStatusFilter(CUSTOMER_STATUS_FILTERS, status)
    // El filtro con/sin pedidos necesita el set ANTES de consultar.
    const idsWithOrders =
      statusFilter === 'with_orders' || statusFilter === 'without_orders'
        ? await fetchCustomerIdsWithOrders(adminClient)
        : null

    const base = adminClient
      .from('profiles')
      .select('id, full_name, email, phone, document_type, document_number, is_active, anonymized_at, created_at')
      .eq('role', 'CUSTOMER')
      .order('created_at', { ascending: false })
    const filtered = applyCustomerFilters(base, {
      query,
      status: statusFilter,
      idsWithOrders,
    })
    const { data, error } = await filtered.limit(EXPORT_ROW_LIMIT)
    if (error) {
      console.error('[export] error customers:', error.message)
      return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
    }

    // PII (email/phone/document): solo llega aquí un ADMIN (gate arriba).
    // La columna anonymized_at evidencia cuándo se atendió cada baja.
    csv = toCsv(
      ['ID', 'Nombre', 'Email', 'Teléfono', 'Documento', 'Nº Doc', 'Activo', 'Anonimizado', 'Registro'],
      (data ?? []).map((r) => [
        r.id,
        r.full_name,
        r.email,
        r.phone,
        r.document_type,
        r.document_number,
        r.is_active ? 'sí' : 'no',
        r.anonymized_at ? new Date(r.anonymized_at).toISOString() : '',
        new Date(r.created_at).toISOString(),
      ])
    )
  } else {
    const statusFilter = parseStatusFilter(DELIVERY_STATUS_FILTERS, status)
    const onRouteIds =
      statusFilter === 'on_route'
        ? await fetchDeliveryPersonIdsOnRoute(adminClient)
        : null

    const base = adminClient
      .from('profiles')
      .select('id, full_name, phone, document_type, document_number, vehicle_type, is_active, anonymized_at, created_at')
      .eq('role', 'DELIVERY')
      .order('created_at', { ascending: false })
    const filtered = applyDeliveryFilters(base, {
      query,
      status: statusFilter,
      onRouteIds,
    })
    const { data, error } = await filtered.limit(EXPORT_ROW_LIMIT)
    if (error) {
      console.error('[export] error deliveries:', error.message)
      return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
    }

    csv = toCsv(
      ['ID', 'Nombre', 'Teléfono', 'Documento', 'Nº Doc', 'Vehículo', 'Activo', 'Anonimizado', 'Registro'],
      (data ?? []).map((r) => [
        r.id,
        r.full_name,
        r.phone,
        r.document_type,
        r.document_number,
        r.vehicle_type,
        r.is_active ? 'sí' : 'no',
        r.anonymized_at ? new Date(r.anonymized_at).toISOString() : '',
        new Date(r.created_at).toISOString(),
      ])
    )
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameFor(entity)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
