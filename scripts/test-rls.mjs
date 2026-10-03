// ============================================================================
// scripts/test-rls.mjs — Regresión de RLS + RPCs (plan de optimización,
// sección "Pruebas de regresión" y Fase 5.4 "Tests de RLS en CI").
//
// Cada test es una fila automatizable de la tabla del plan:
//   - signUp con data.role='ADMIN'  → perfil CUSTOMER (C3: 20261003120200)
//   - CUSTOMER PATCH profiles {role}        → 42501 (guard_privileged_columns)
//   - CUSTOMER PATCH profiles de OTRA fila  → 0 filas
//   - RESTAURANT PATCH restaurants
//       {is_active/is_approved}             → 42501 (guard de restaurantes)
//   - control: RESTAURANT PATCH {is_open}   → OK (pausar sí es suyo)
//   - RESTAURANT select products de otro    → 0 filas
//   - anon select products de restaurante
//     no aprobado                           → 0 filas
//   - create_order control                  → devuelve uuid
//   - create_order producto no disponible   → 22000
//   - create_order idempotente (mismo
//     client_request_id)                    → 1 solo pedido
//   - cancel_order de pedido ajeno          → 42501
//   - cancel_order control (dueño PENDING)  → OK
//   - cancel_order sobre ASSIGNED           → 22000
//   - DELIVERY INSERT deliveries            → 42501 (contract 20261003121500;
//     si aún no está aplicada, el intento SUCCEDE ⇒ WARN, no FAIL)
//   - DELIVERY PATCH orders {total:0}       → 42501 (mismo criterio contract)
//
// NO necesita el servidor Next: todo va directo a Auth/PostgREST.
//
// Uso:
//   node --env-file=.env scripts/test-rls.mjs                          # local
//   ALLOW_REMOTE_E2E=1 node --env-file=.env scripts/test-rls.mjs       # remoto
// ============================================================================

// ---------------------------------------------------------------------------
// Fase 0.3 - Guard anti-produccion (igual que los e2e existentes).
// Por defecto SOLO corre contra Supabase local (127.0.0.1 / localhost).
// Para el proyecto remoto a sabiendas: ALLOW_REMOTE_E2E=1
// ---------------------------------------------------------------------------
if (
  !/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') &&
  process.env.ALLOW_REMOTE_E2E !== '1'
) {
  console.error(
    'Guard Fase 0: NEXT_PUBLIC_SUPABASE_URL no es local. Usa Supabase local o exporta ALLOW_REMOTE_E2E=1 para correr contra el proyecto remoto a sabiendas.'
  )
  process.exit(3)
}

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    'Faltan variables de Supabase. Ejecuta: node --env-file=.env scripts/test-rls.mjs'
  )
  process.exit(2)
}

const PASSWORD = 'RlsTest!2026'

const admin = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(SUPA_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ACCOUNTS = [
  { key: 'c1', email: 'rls-customer1@pideloya.test', role: 'CUSTOMER', fullName: 'RLS Customer 1' },
  { key: 'c2', email: 'rls-customer2@pideloya.test', role: 'CUSTOMER', fullName: 'RLS Customer 2' },
  { key: 'owner', email: 'rls-owner@pideloya.test', role: 'RESTAURANT', fullName: 'RLS Owner' },
  { key: 'delivery', email: 'rls-delivery@pideloya.test', role: 'DELIVERY', fullName: 'RLS Delivery' },
]

const results = []
let currentGroup = ''
const createdOrderIds = []
const cleanupFns = []

function group(name) {
  currentGroup = name
  console.log(`\n${name}`)
}

function expect(cond, message) {
  if (!cond) throw new Error(message)
}

async function step(name, fn) {
  try {
    const detail = await fn()
    results.push({ group: currentGroup, name, status: 'PASS', detail: detail ?? '' })
    console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    results.push({ group: currentGroup, name, status: 'FAIL', detail: message })
    console.log(`  [FAIL] ${name} — ${message}`)
    return false
  }
}

function warn(name, detail) {
  results.push({ group: currentGroup, name, status: 'WARN', detail })
  console.log(`  [WARN] ${name} — ${detail}`)
}

/**
 * Assert de error de RPC/policy: acepta el SQLSTATE esperado y, como
 * red de seguridad, un fragmento del mensaje (los raises del plan
 * documentan su texto: "Columna protegida", "cancelar", "disponible"…).
 */
function assertErrorCode(err, expectedCode, messageFragment) {
  if (!err) {
    throw new Error(
      `se esperaba error ${expectedCode} y la operación SUCEDIÓ (¿migración pendiente?)`
    )
  }
  const fragmentOk =
    !messageFragment || (err.message ?? '').includes(messageFragment)
  if (err.code !== expectedCode && !fragmentOk) {
    throw new Error(
      `esperaba ${expectedCode}${messageFragment ? ` / "${messageFragment}"` : ''}, llegó code=${err.code ?? '—'} message=${err.message}`
    )
  }
  return `${err.code} ${err.message}`
}

async function loginClient(account) {
  const client = createClient(SUPA_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password: PASSWORD,
  })
  if (error) throw new Error(`login ${account.email}: ${error.message}`)
  return client
}

async function findUserByEmail(email) {
  let page = 1
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (users.length < 200) return null
    page += 1
  }
  return null
}

async function ensureUser(account) {
  let authId
  const existing = await findUserByEmail(account.email)
  if (existing?.id) {
    authId = existing.id
    const { error } = await admin.auth.admin.updateUserById(authId, {
      password: PASSWORD,
      user_metadata: { full_name: account.fullName },
    })
    if (error) throw new Error(`actualizar ${account.email}: ${error.message}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      // OJO: el rol NO va en user_metadata ni aquí — handle_new_user (C3)
      // solo lee app_metadata. El rol del fixture se fija con service_role
      // más abajo, que es exactamente el camino de confianza permitido.
      user_metadata: { full_name: account.fullName },
    })
    if (error) throw new Error(`crear ${account.email}: ${error.message}`)
    authId = data.user.id
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('auth_id', authId)
    .single()
  if (profileError || !profile) {
    throw new Error(`perfil de ${account.email}: ${profileError?.message ?? 'no existe'}`)
  }
  if (profile.role !== account.role || !profile.is_active || profile.full_name !== account.fullName) {
    const { error } = await admin
      .from('profiles')
      .update({ role: account.role, is_active: true, full_name: account.fullName })
      .eq('id', profile.id)
    if (error) throw new Error(`perfil ${account.email}: ${error.message}`)
  }
  return { authId, profileId: profile.id }
}

async function ensureRestaurant({ slug, name, approved, memberProfileId, products }) {
  const { data: found, error: findError } = await admin
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (findError) throw new Error(`buscar restaurante ${slug}: ${findError.message}`)

  let restaurant = found
  if (!restaurant) {
    const { data, error } = await admin
      .from('restaurants')
      .insert({
        name,
        slug,
        description: 'Fixtures RLS',
        address_text: 'Av. RLS 123',
        latitude: -12.05,
        longitude: -77.04,
        is_approved: approved,
        is_active: true,
        is_open: true,
      })
      .select()
      .single()
    if (error) throw new Error(`crear restaurante ${slug}: ${error.message}`)
    restaurant = data
  } else if (restaurant.is_approved !== approved) {
    const { error } = await admin
      .from('restaurants')
      .update({ is_approved: approved })
      .eq('id', restaurant.id)
    if (error) throw new Error(`aprobar restaurante ${slug}: ${error.message}`)
  }

  if (memberProfileId) {
    const { data: member, error } = await admin
      .from('restaurant_members')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('user_id', memberProfileId)
      .maybeSingle()
    if (error) throw new Error(`miembro ${slug}: ${error.message}`)
    if (!member) {
      const { error: insertError } = await admin
        .from('restaurant_members')
        .insert({ restaurant_id: restaurant.id, user_id: memberProfileId })
      if (insertError) throw new Error(`crear miembro ${slug}: ${insertError.message}`)
    }
  }

  const productIds = {}
  for (const product of products) {
    const { data: existing, error } = await admin
      .from('products')
      .select('id, available')
      .eq('restaurant_id', restaurant.id)
      .eq('name', product.name)
      .maybeSingle()
    if (error) throw new Error(`buscar producto ${product.name}: ${error.message}`)
    if (existing) {
      if (existing.available !== product.available) {
        const { error: updateError } = await admin
          .from('products')
          .update({ available: product.available, price: product.price })
          .eq('id', existing.id)
        if (updateError) throw new Error(`resetear producto ${product.name}: ${updateError.message}`)
      }
      productIds[product.key] = existing.id
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('products')
        .insert({
          restaurant_id: restaurant.id,
          name: product.name,
          description: 'Producto RLS',
          price: product.price,
          available: product.available,
        })
        .select('id')
        .single()
      if (insertError) throw new Error(`crear producto ${product.name}: ${insertError.message}`)
      productIds[product.key] = inserted.id
    }
  }
  return { id: restaurant.id, products: productIds }
}

async function ensureAddress(customerProfileId) {
  const { data: existing, error: findError } = await admin
    .from('addresses')
    .select('id')
    .eq('customer_id', customerProfileId)
    .eq('label', 'RLS')
    .maybeSingle()
  if (findError) throw new Error(`buscar dirección: ${findError.message}`)
  if (existing) return existing.id

  const { data, error } = await admin
    .from('addresses')
    .insert({
      customer_id: customerProfileId,
      label: 'RLS',
      address_text: 'Av. El Sol 123, Abancay',
      latitude: -13.5167,
      longitude: -72.8784,
    })
    .select('id')
    .single()
  if (error) throw new Error(`crear dirección: ${error.message}`)
  return data.id
}

async function insertOrder({ customerId, addressId, status = 'PENDING', total = 30 }) {
  const { data, error } = await admin
    .from('orders')
    .insert({ customer_id: customerId, address_id: addressId, status, total })
    .select('id')
    .single()
  if (error) throw new Error(`insertar pedido fixture (${status}): ${error.message}`)
  createdOrderIds.push(data.id)
  return data.id
}

async function preflightClean(customerProfileIds) {
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, status')
    .in('customer_id', customerProfileIds)
  if (error) throw new Error(`preflight pedidos: ${error.message}`)
  const stale = (orders ?? []).filter(
    (o) => o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT'
  )
  for (const order of stale) {
    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', order.id)
    if (updateError) throw new Error(`preflight limpiar pedido: ${updateError.message}`)
  }
  return `${stale.length} pedidos activos normalizados (anti-abuso create_order exige < 3)`
}

function printReport() {
  const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 }
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1

  console.log('\n================ RESUMEN ================')
  let lastGroup = ''
  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log(`\n${r.group}`)
      lastGroup = r.group
    }
    console.log(`  [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  console.log(
    `\nTOTAL: ${counts.PASS} PASS · ${counts.FAIL} FAIL · ${counts.WARN} WARN · ${counts.SKIP} SKIP`
  )
  return counts
}

async function main() {
  const ctx = {}

  group('SETUP (fixtures idempotentes)')
  for (const account of ACCOUNTS) {
    await step(`Cuenta ${account.role} ${account.email}`, async () => {
      const ids = await ensureUser(account)
      ctx[account.key] = ids
      return ids.profileId
    })
  }

  await step('Restaurantes A (aprobado) / B (aprobado, ajeno) / C (no aprobado)', async () => {
    const a = await ensureRestaurant({
      slug: 'rls-test-rest-a',
      name: 'RLS Restaurante A',
      approved: true,
      memberProfileId: ctx.owner.profileId,
      products: [
        { key: 'ok', name: 'RLS Producto OK', price: 15, available: true },
        { key: 'blocked', name: 'RLS Producto Bloqueado', price: 20, available: false },
      ],
    })
    // B y C SIN miembros: los productos de B deben ser invisibles para el
    // dueño de A, y los de C invisibles para anon.
    const b = await ensureRestaurant({
      slug: 'rls-test-rest-b',
      name: 'RLS Restaurante B',
      approved: true,
      products: [{ key: 'b', name: 'RLS Producto B', price: 25, available: true }],
    })
    const c = await ensureRestaurant({
      slug: 'rls-test-rest-c',
      name: 'RLS Restaurante C',
      approved: false,
      products: [{ key: 'c', name: 'RLS Producto C', price: 30, available: true }],
    })
    ctx.restA = a
    ctx.restB = b
    ctx.restC = c
    return `A=${a.id.slice(0, 8)} B=${b.id.slice(0, 8)} C=${c.id.slice(0, 8)}`
  })

  await step('Dirección del cliente 1', async () => {
    ctx.addressId = await ensureAddress(ctx.c1.profileId)
    return ctx.addressId
  })

  await step('Preflight: normalizar pedidos activos', async () => {
    return preflightClean([ctx.c1.profileId, ctx.c2.profileId])
  })

  // Si el setup falló a mitad no hay contexto para los tests.
  const setupOk = ctx.c1 && ctx.c2 && ctx.owner && ctx.delivery && ctx.restA && ctx.addressId
  if (!setupOk) {
    warn('Setup incompleto', 'se omite la suite: revisa los FAIL de SETUP')
    printReport()
    process.exit(1)
  }

  const c1 = await loginClient(ACCOUNTS[0])
  const c2 = await loginClient(ACCOUNTS[1])
  const owner = await loginClient(ACCOUNTS[2])
  const delivery = await loginClient(ACCOUNTS[3])

  // -------------------------------------------------------------------------
  group('Escalación de rol en el registro (C3 / 20261003120200)')
  await step("signUp con data.role='ADMIN' crea perfil CUSTOMER", async () => {
    const email = `rls-escalate-${Date.now()}@pideloya.test`
    const { data, error } = await anon.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { role: 'ADMIN', full_name: 'RLS Escalada' } },
    })
    expect(!error, `signUp falló: ${error.message}`)
    expect(data.user, 'signUp no devolvió usuario')
    cleanupFns.push(async () => {
      await admin.auth.admin.deleteUser(data.user.id)
    })

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('auth_id', data.user.id)
      .single()
    expect(!profileError, `perfil no creado: ${profileError?.message}`)
    expect(
      profile.role === 'CUSTOMER',
      `role=${profile.role} — el rol viene de user_metadata; falta 20261003120200_role_from_app_metadata`
    )
    return `role=${profile.role}, is_active=${profile.is_active}`
  })

  // -------------------------------------------------------------------------
  group('profiles: escalada bloqueada')
  await step('CUSTOMER PATCH profiles {role:ADMIN} → 42501', async () => {
    const { error } = await c1
      .from('profiles')
      .update({ role: 'ADMIN' })
      .eq('id', ctx.c1.profileId)
    const detail = assertErrorCode(error, '42501', 'Columna protegida')

    const { data: after } = await admin
      .from('profiles')
      .select('role')
      .eq('id', ctx.c1.profileId)
      .single()
    expect(after?.role === 'CUSTOMER', `el rol SÍ cambió a ${after?.role}`)
    return detail
  })

  await step('CUSTOMER PATCH profiles {is_active:false} de OTRO perfil → 0 filas', async () => {
    const { data, error } = await c1
      .from('profiles')
      .update({ is_active: false })
      .eq('id', ctx.c2.profileId)
      .select()
    expect(!error || error.code === '42501', `error inesperado: ${error?.message}`)
    expect((data ?? []).length === 0, `actualizó ${data.length} fila(s) ajenas(s)`)

    const { data: after } = await admin
      .from('profiles')
      .select('is_active')
      .eq('id', ctx.c2.profileId)
      .single()
    expect(after?.is_active === true, 'is_active del otro perfil quedó en false')
    return '0 filas'
  })

  // -------------------------------------------------------------------------
  group('restaurants: auto-aprobación bloqueada')
  await step('RESTAURANT PATCH restaurants {is_active:false} (suyo) → 42501', async () => {
    const { error } = await owner
      .from('restaurants')
      .update({ is_active: false })
      .eq('id', ctx.restA.id)
    return assertErrorCode(error, '42501', 'Columna protegida')
  })

  await step('RESTAURANT PATCH restaurants {is_approved:false} (suyo) → 42501', async () => {
    const { error } = await owner
      .from('restaurants')
      .update({ is_approved: false })
      .eq('id', ctx.restA.id)
    return assertErrorCode(error, '42501', 'Columna protegida')
  })

  await step('control: RESTAURANT PATCH restaurants {is_open} → OK', async () => {
    const { error } = await owner
      .from('restaurants')
      .update({ is_open: false })
      .eq('id', ctx.restA.id)
    expect(!error, `is_open debía ser editable: ${error?.message}`)
    const { error: backError } = await owner
      .from('restaurants')
      .update({ is_open: true })
      .eq('id', ctx.restA.id)
    expect(!backError, `restaurar is_open: ${backError?.message}`)
    return 'is_open:false → true'
  })

  await step('RESTAURANT no ve productos de OTRO restaurante → 0 filas', async () => {
    const { data, error } = await owner
      .from('products')
      .select('id, restaurant_id')
      .eq('restaurant_id', ctx.restB.id)
    expect(!error, `select: ${error?.message}`)
    expect((data ?? []).length === 0, `vio ${data.length} producto(s) del restaurante B`)
    return '0 filas'
  })

  await step('anon no ve productos de restaurante NO aprobado → 0 filas', async () => {
    const { data, error } = await anon
      .from('products')
      .select('id')
      .eq('restaurant_id', ctx.restC.id)
    expect(!error, `select: ${error?.message}`)
    expect((data ?? []).length === 0, `anon vio ${data.length} producto(s) de C`)
    return '0 filas'
  })

  // -------------------------------------------------------------------------
  group('RPC create_order (20261003120700)')
  await step('create_order control → devuelve uuid', async () => {
    const { data, error } = await c1.rpc('create_order', {
      p_address_id: ctx.addressId,
      p_notes: 'test-rls control',
      p_items: [{ product_id: ctx.restA.products.ok, quantity: 1 }],
      p_client_request_id: randomUUID(),
    })
    expect(!error, `error: ${error?.code} ${error?.message}`)
    expect(typeof data === 'string' && data.length === 36, `devolvió ${JSON.stringify(data)}`)
    createdOrderIds.push(data)
    return data
  })

  await step('create_order con producto NO disponible → 22000', async () => {
    const { data, error } = await c1.rpc('create_order', {
      p_address_id: ctx.addressId,
      p_notes: null,
      p_items: [{ product_id: ctx.restA.products.blocked, quantity: 1 }],
      p_client_request_id: randomUUID(),
    })
    expect(data === null, 'devolvió un pedido con producto no disponible')
    return assertErrorCode(error, '22000', 'disponible')
  })

  await step('create_order idempotente: mismo client_request_id → 1 pedido', async () => {
    const requestId = randomUUID()
    const args = {
      p_address_id: ctx.addressId,
      p_notes: 'test-rls idempotencia',
      p_items: [{ product_id: ctx.restA.products.ok, quantity: 2 }],
      p_client_request_id: requestId,
    }
    const first = await c1.rpc('create_order', args)
    expect(!first.error, `1ª llamada: ${first.error?.code} ${first.error?.message}`)
    const second = await c1.rpc('create_order', args)
    expect(!second.error, `2ª llamada: ${second.error?.code} ${second.error?.message}`)
    expect(first.data === second.data, `ids distintos: ${first.data} vs ${second.data}`)
    createdOrderIds.push(first.data)

    const { count, error: countError } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', ctx.c1.profileId)
      .eq('client_request_id', requestId)
    expect(!countError, `conteo: ${countError?.message}`)
    expect(count === 1, `hay ${count} pedidos con el mismo client_request_id`)
    return `1 pedido ${first.data.slice(0, 8)}…`
  })

  // -------------------------------------------------------------------------
  group('RPC cancel_order (20261003120100)')
  await step('control: dueño cancela su pedido PENDING → OK', async () => {
    const orderId = await insertOrder({
      customerId: ctx.c1.profileId,
      addressId: ctx.addressId,
    })
    const { error } = await c1.rpc('cancel_order', { p_order_id: orderId })
    expect(!error, `cancel propio falló: ${error?.code} ${error?.message}`)
    const { data: after } = await admin
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
    expect(after?.status === 'CANCELLED', `status=${after?.status}`)
    return 'CANCELLED'
  })

  await step('cancel_order de pedido AJENO → 42501', async () => {
    const orderId = await insertOrder({
      customerId: ctx.c1.profileId,
      addressId: ctx.addressId,
    })
    const { error } = await c2.rpc('cancel_order', { p_order_id: orderId })
    return assertErrorCode(error, '42501', 'cancelar')
  })

  await step('cancel_order sobre pedido ASSIGNED → 22000', async () => {
    const orderId = await insertOrder({
      customerId: ctx.c1.profileId,
      addressId: ctx.addressId,
      status: 'ASSIGNED',
    })
    const { error } = await c1.rpc('cancel_order', { p_order_id: orderId })
    return assertErrorCode(error, '22000', 'cancelar')
  })

  // -------------------------------------------------------------------------
  group('Escritura directa: contract 20261003121500 (WARN si no aplicada)')
  const contractTarget = await insertOrder({
    customerId: ctx.c1.profileId,
    addressId: ctx.addressId,
  })

  await step('DELIVERY INSERT deliveries (directo) → 42501', async () => {
    const { error } = await delivery.from('deliveries').insert({
      order_id: contractTarget,
      delivery_person_id: ctx.delivery.profileId,
      accepted_at: new Date().toISOString(),
    })
    if (!error) {
      // Sin la contract, la policy deliveries_insert_delivery_self lo permite.
      await admin.from('deliveries').delete().eq('order_id', contractTarget)
      warn(
        'DELIVERY INSERT deliveries',
        'aún permite INSERT directo — aplica la contract 20261003121500 y re-ejecuta'
      )
      return
    }
    return assertErrorCode(error, '42501', 'permission denied')
  })

  await step('DELIVERY PATCH orders {total:0} (directo) → 42501', async () => {
    const { data, error } = await delivery
      .from('orders')
      .update({ total: 0 })
      .eq('id', contractTarget)
      .select()
    if (error) return assertErrorCode(error, '42501', 'permission denied')
    if ((data ?? []).length === 0) {
      warn(
        'DELIVERY PATCH orders {total:0}',
        'RLS devolvió 0 filas (bien por fila) pero el grant UPDATE sigue abierto — aplica la contract 20261003121500'
      )
      return
    }
    // Peor caso: el update SÍ modificó la fila. Restaurar y fallar.
    await admin.from('orders').update({ total: 30 }).eq('id', contractTarget)
    throw new Error('el repartidor modificó total de un pedido ajeno')
  })

  // -------------------------------------------------------------------------
  // Limpieza best-effort: pedidos de esta corrida a CANCELLED y usuarios
  // temporales de escalada fuera.
  group('LIMPIEZA (best-effort)')
  await step(`${createdOrderIds.length} pedidos de la corrida → CANCELLED`, async () => {
    const { error } = await admin
      .from('orders')
      .update({ status: 'CANCELLED' })
      .in('id', createdOrderIds)
      .in('status', ['PENDING', 'AWAITING_PAYMENT', 'ASSIGNED'])
    if (error) throw new Error(error.message)
    return 'ok'
  })
  for (const [index, fn] of cleanupFns.entries()) {
    await step(`borrar usuario temporal #${index + 1}`, async () => {
      try {
        await fn()
        return 'ok'
      } catch (err) {
        // Un FK pendiente no debe ensuciar el reporte: se avisa y ya.
        warn('borrar usuario temporal', err.message)
      }
    })
  }

  const counts = printReport()
  process.exit(counts.FAIL > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('\nError fatal:', err)
  printReport()
  process.exit(1)
})
