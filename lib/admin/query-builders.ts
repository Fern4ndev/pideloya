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
    is: (col: string, val: null) => T
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
  // Pendiente de aprobar = is_active false (el alta nace desactivada) y
  // NUNCA anonimizada: una cuenta anonimizada está de baja permanente (su
  // fila no ofrece ni aprobar ni reactivar), así que listarla como
  // "pendiente" era un pendiente fantasma que nunca se podía cerrar.
  if (status === 'pending')
    builder = builder.eq('is_active', false).is('anonymized_at', null)
  if (status === 'on_route' && onRouteIds) {
    builder = builder.in(
      'id',
      // En ruta AHORA MISMO. Si nadie está en ruta: cero filas.
      onRouteIds.length ? onRouteIds : ['00000000-0000-0000-0000-000000000000']
    )
  }
  return builder
}

// ============================================================================
// BADGES DEL SIDEBAR (Fase 10 del plan del panel admin)
// ============================================================================

/**
 * Pendientes de aprobación de restaurantes y repartidores, para los
 * badges del sidebar.
 *
 * Usa los MISMOS appliers que las listas (`status: 'pending'`) en lugar de
 * repetir el `eq(...)` a mano: así el badge no puede divergir del filtro
 * "Pendientes de aprobar" al que enlaza. Si mañana cambia la definición
 * de "pendiente", el badge cambia con ella.
 *
 * Son dos `count` con `head: true` (Postgres cuenta, no se traen filas) y
 * salen en paralelo. Quien llama decide qué hacer si esto falla — el
 * layout lo trata como best-effort, porque un adorno no puede tumbar todo
 * el panel.
 */
export async function fetchPendingApprovalCounts(
  client: DbClient
): Promise<{ restaurants: number; deliveries: number; paymentIncidents: number }> {
  const [restaurants, deliveries, paymentIncidents] = await Promise.all([
    applyRestaurantFilters(
      client.from('restaurants').select('id', { count: 'exact', head: true }),
      { query: '', status: 'pending' }
    ),
    applyDeliveryFilters(
      client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'DELIVERY'),
      { query: '', status: 'pending', onRouteIds: null }
    ),
    // Incidencias de pago ABIERTAS (Fase 8 del plan "Pagar al recibir"):
    // `resolved_at is null` es exactamente la definición de "abierta" que usa
    // el índice parcial de la tabla y el filtro por defecto de /admin/pagos.
    client
      .from('payment_incidents')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null),
  ])

  return {
    restaurants: restaurants.count ?? 0,
    deliveries: deliveries.count ?? 0,
    paymentIncidents: paymentIncidents.count ?? 0,
  }
}

// ============================================================================
// PAGOS: incidencias y conciliación (Fase 8 del plan "Pagar al recibir")
// ============================================================================

/**
 * Vista única de /admin/pagos. Se filtra por `?status=` (el MISMO parámetro que
 * usan las otras tablas admin) para reutilizar `AdminTableShell`,
 * `StatusFilterSelect` y el export CSV sin inventar un eje nuevo.
 */
export const PAYMENT_REVIEW_FILTERS = ['open', 'unpaid', 'integrity'] as const
export type PaymentReviewFilter = (typeof PAYMENT_REVIEW_FILTERS)[number]

/** Filtros de conciliación (todo menos la bandeja de incidencias). */
export type PaymentReconciliationFilter = Exclude<PaymentReviewFilter, 'open'>

/** Etiquetas de la vista (única fuente: el `<select>` y el encabezado de la página). */
export const PAYMENT_REVIEW_LABELS: Record<PaymentReviewFilter, string> = {
  open: 'Incidencias abiertas',
  unpaid: 'Entregados sin constancia de pago',
  integrity: 'ON_DELIVERY sin cobro registrado',
}

/**
 * Opciones del filtro, en el formato de `StatusFilterSelect`. Ojo: el PRIMER
 * valor es el que `StatusFilterSelect` muestra cuando no hay `?status=`, así que
 * "open" queda como vista por defecto por construcción, no por casualidad.
 */
export const PAYMENT_REVIEW_STATUS_OPTIONS = PAYMENT_REVIEW_FILTERS.map((value) => ({
  value,
  label: PAYMENT_REVIEW_LABELS[value],
}))

/**
 * Tope de filas de la bandeja de conciliación. Es una cola de trabajo de
 * soporte, no un reporte histórico: si algún día supera esto, la respuesta
 * correcta es paginar en el servidor caso por caso (y sobre todo, que haya
 * 200 incidencias abiertas es el problema, no la tabla). Documentado porque el
 * límite es visible en la UI (la tabla dice cuántas filas muestra).
 */
export const PAYMENT_REVIEW_LIMIT = 200

export type PaymentIncidentRow = {
  id: string
  orderId: string
  kind: string
  reporterName: string | null
  reporterRole: string
  note: string | null
  createdAt: string
}

/**
 * Incidencias ABIERTAS, más nuevas primero. Es la consulta de la que dependen
 * la página, el badge del sidebar y el export CSV: una sola definición de
 * "abierta" (`resolved_at is null`).
 */
export async function fetchOpenPaymentIncidents(
  client: DbClient
): Promise<PaymentIncidentRow[]> {
  const { data, error } = await client
    .from('payment_incidents')
    .select(
      'id, order_id, kind, note, reporter_role, created_at, profiles!payment_incidents_reported_by_fkey(full_name)'
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(PAYMENT_REVIEW_LIMIT)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    reporterName: row.profiles?.full_name ?? null,
    reporterRole: row.reporter_role,
    note: row.note,
    createdAt: row.created_at,
  }))
}

export type PaymentReconciliationRow = {
  /** id de la fila revisada (pedido o entrega, según el filtro). */
  id: string
  orderId: string
  /** Qué se encontró, en texto: es lo que lee el admin. */
  issue: string
  amount: number | null
  driverName: string | null
  createdAt: string
}

/**
 * Filas de conciliación (los filtros que NO son la bandeja de incidencias).
 *
 * La vista `mismatch` ("cobro distinto a lo anunciado") SE ELIMINÓ con el pago
 * al recibir sin método: ya no hay "anunciado vs cobrado" que comparar, porque
 * el medio del cobro dejó de preguntarse (migración 20261003100000). Una alerta
 * que siempre va a estar vacía no se deja en la UI "por si acaso": enseña a
 * ignorar la pantalla.
 *
 * Desde entonces cada filtro es UNA consulta con su propio `where` (PostgREST
 * filtra todo), así que la paginación en memoria que existe en la página es solo
 * por comodidad de la tabla, no porque haya filas descartadas en JS.
 */
export async function fetchPaymentReconciliationRows(
  client: DbClient,
  filter: PaymentReconciliationFilter
): Promise<PaymentReconciliationRow[]> {
  if (filter === 'unpaid') {
    const { data, error } = await client
      .from('orders')
      .select(
        'id, total, created_at, deliveries(delivery_person_id, delivered_at, profiles(full_name))'
      )
      .eq('status', 'DELIVERED')
      .is('restaurant_paid_at', null)
      .order('created_at', { ascending: false })
      .limit(PAYMENT_REVIEW_LIMIT)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      orderId: row.id,
      issue: 'Entregado sin constancia de pago al restaurante',
      amount: row.total,
      driverName: row.deliveries?.profiles?.full_name ?? null,
      createdAt: row.created_at,
    }))
  }

  // `integrity`: la única alerta que NO puede estar vacía por diseño — una
  // entrega ON_DELIVERY sin `collected_at` significa que algo se saltó
  // complete_delivery.
  if (filter === 'integrity') {
    const { data, error } = await client
      .from('deliveries')
      .select(
        'id, order_id, created_at, orders!inner(status, total, customer_name)'
      )
      .eq('payment_timing', 'ON_DELIVERY')
      .is('collected_at', null)
      .eq('orders.status', 'DELIVERED')
      .order('created_at', { ascending: false })
      .limit(PAYMENT_REVIEW_LIMIT)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      issue: 'Pedido entregado sin cobro registrado (alerta de integridad)',
      amount: row.orders?.total ?? null,
      driverName: null,
      createdAt: row.created_at,
    }))
  }

  // Sin rama final: la whitelist de filtros solo tiene 'open', 'unpaid' e
  // 'integrity', y 'open' no llega hasta acá. Si mañana se agrega un filtro sin
  // su consulta, conviene que esto no compile antes que devolver filas de otro
  // filtro en silencio.
  const exhaustive: never = filter
  throw new Error(`Filtro de conciliación sin consulta: ${String(exhaustive)}`)
}
