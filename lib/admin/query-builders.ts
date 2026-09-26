import type { createClient } from '@/lib/db/server'

// createClient es async (lee cookies): el tipo del cliente YA esperado.
type DbClient = Awaited<ReturnType<typeof createClient>>

/**
 * Constructores de query compartidos entre las páginas admin y el export
 * CSV (Fase 7 del plan): la MISMA definición de búsqueda/filtro/orden se
 * aplica al conteo de la página, a sus datos y a las filas exportadas.
 * Antes cada página duplicaba su lógica; el export reutilizarla aquí
 * garantiza que "el CSV refleja exactamente los filtros visibles".
 *
 * Sanitización de búsqueda (mismo patrón que /buscar y /admin/usuarios):
 * % _ , ( ) tienen significado especial en el or() de PostgREST y en
 * ilike — un usuario puede romper el filtro con ellos.
 */
export function sanitizeSearchTerm(query: string): string {
  return query.replace(/[%_,()]/g, ' ')
}

// ============================================================================
// WHITELISTS
// ============================================================================

export const RESTAURANT_STATUS_FILTERS = [
  'pending',
  'active',
  'suspended',
] as const
export type RestaurantStatusFilter = (typeof RESTAURANT_STATUS_FILTERS)[number]

export const CUSTOMER_STATUS_FILTERS = [
  'with_orders',
  'without_orders',
  'anonymized',
] as const
export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number]

export const DELIVERY_STATUS_FILTERS = ['active', 'pending', 'on_route'] as const
export type DeliveryStatusFilter = (typeof DELIVERY_STATUS_FILTERS)[number]

export const SORTABLE_RESTAURANTS = ['name', 'food_type', 'created_at'] as const
export type RestaurantSortColumn = (typeof SORTABLE_RESTAURANTS)[number]

export const SORTABLE_CUSTOMERS = ['full_name', 'email', 'created_at'] as const
export type CustomerSortColumn = (typeof SORTABLE_CUSTOMERS)[number]

export const SORTABLE_DELIVERIES = [
  'full_name',
  'document_number',
  'created_at',
] as const
export type DeliverySortColumn = (typeof SORTABLE_DELIVERIES)[number]

export type SortDir = 'asc' | 'desc'

/** Normaliza el filtro de estado contra su whitelist ('' → undefined). */
export function parseStatusFilter<T extends string>(
  allowed: readonly T[],
  value: string | undefined
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/** Normaliza la columna de orden contra su whitelist (undefined → default). */
export function parseSortColumn<T extends string>(
  allowed: readonly T[],
  value: string | undefined
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/** Normaliza la dirección de orden (default 'desc', como venía el panel). */
export function parseSortDir(value: string | undefined): SortDir {
  return value === 'asc' ? 'asc' : 'desc'
}

// ============================================================================
// RESTAURANTES
// ============================================================================

export function applyRestaurantFilters<
  T extends {
    or: (cols: string) => T
    eq: (col: string, val: boolean) => T
  },
>(
  builder: T,
  options: {
    query: string
    status?: RestaurantStatusFilter
  }
): T {
  const { query, status } = options
  if (query) {
    // El dueño no es columna de restaurants: se busca por la relación
    // embebida restaurant_members.profiles (sintaxis de filtros de embed).
    const safe = sanitizeSearchTerm(query)
    builder = builder.or(
      `name.ilike.%${safe}%,food_type.ilike.%${safe}%,address_text.ilike.%${safe}%,restaurant_members.profiles.full_name.ilike.%${safe}%`
    )
  }
  if (status === 'pending') builder = builder.eq('is_approved', false)
  if (status === 'active')
    builder = builder.eq('is_approved', true).eq('is_active', true)
  if (status === 'suspended')
    builder = builder.eq('is_approved', true).eq('is_active', false)
  return builder
}

// ============================================================================
// CLIENTES (profiles rol CUSTOMER)
// ============================================================================

/**
 * Set de customer_id con pedidos — necesario ANTES de paginar para
 * filtrar por hasOrders (el flag se calcula después de traer la página).
 * El caller decide el vaciado (in/not.in) según el filtro.
 */
export async function fetchCustomerIdsWithOrders(
  client: DbClient
): Promise<string[]> {
  const { data, error } = await client
    .from('orders')
    .select('customer_id')
    .not('customer_id', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((row) => row.customer_id as string))]
}

export function applyCustomerFilters<
  T extends {
    or: (cols: string) => T
    in: (col: string, vals: string[]) => T
    not: (col: string, op: string, val: string) => T
  },
>(
  builder: T,
  options: {
    query: string
    status?: CustomerStatusFilter
    idsWithOrders: string[] | null // null = filtro no requiere el set
  }
): T {
  const { query, status, idsWithOrders } = options
  if (query) {
    const safe = sanitizeSearchTerm(query)
    builder = builder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
  }
  if (status === 'with_orders' && idsWithOrders) {
    builder = idsWithOrders.length
      ? builder.in('id', idsWithOrders)
      : // Nadie tiene pedidos: el filtro debe devolver cero filas.
        builder.in('id', ['00000000-0000-0000-0000-000000000000'])
  }
  if (status === 'without_orders' && idsWithOrders) {
    builder = idsWithOrders.length
      ? // not.in() con lista vacía NO es válido en PostgREST:
        // se resuelve como "todos menos el set encontrado".
        builder.not('id', 'in', `(${idsWithOrders.join(',')})`)
      : builder
  }
  if (status === 'anonymized') {
    builder = builder.not('anonymized_at', 'is', 'null')
  }
  return builder
}

// ============================================================================
// REPARTIDORES (profiles rol DELIVERY)
// ============================================================================

/**
 * Set de delivery_person_id con entrega activa AHORA MISMO
 * (ASSIGNED/PICKED_UP/ON_THE_WAY — mismos estados que la guarda de
 * deactivateUser en delivery-lifecycle.ts). Solo se consulta cuando el
 * filtro on_route está activo.
 */
export async function fetchDeliveryPersonIdsOnRoute(
  client: DbClient
): Promise<string[]> {
  const { data } = await client
    .from('deliveries')
    .select('delivery_person_id')
    .in('orders.status', ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
    .not('delivery_person_id', 'is', null)
  return [
    ...new Set((data ?? []).map((row) => row.delivery_person_id as string)),
  ]
}

export function applyDeliveryFilters<
  T extends {
    or: (cols: string) => T
    eq: (col: string, val: boolean) => T
    in: (col: string, vals: string[]) => T
  },
>(
  builder: T,
  options: {
    query: string
    status?: DeliveryStatusFilter
    onRouteIds: string[] | null // null = filtro no requiere el set
  }
): T {
  const { query, status, onRouteIds } = options
  if (query) {
    const safe = sanitizeSearchTerm(query)
    builder = builder.or(
      `full_name.ilike.%${safe}%,document_number.ilike.%${safe}%,phone.ilike.%${safe}%`
    )
  }
  if (status === 'active') builder = builder.eq('is_active', true)
  // Pendiente de aprobar = is_active false (el alta nace desactivada).
  if (status === 'pending') builder = builder.eq('is_active', false)
  if (status === 'on_route' && onRouteIds) {
    builder = builder.in(
      'id',
      // En ruta AHORA MISMO. Si nadie está en ruta: cero filas.
      onRouteIds.length ? onRouteIds : ['00000000-0000-0000-0000-000000000000']
    )
  }
  return builder
}
