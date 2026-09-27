-- ============================================================================
-- PideloYa — RLS y funciones para el flujo de oferta de envío
-- ============================================================================
-- Requiere 20260928100000 (enum AWAITING_PAYMENT) y 20260928100100 (columnas):
-- este archivo es el primero que PUEDE comparar contra 'AWAITING_PAYMENT',
-- porque el valor del enum ya quedó confirmado en una transacción anterior.
--
-- Criterio general (mismo que el resto del proyecto desde
-- 20260828044635_fix_orders_deliveries_rls_recursion.sql): las consultas
-- cruzadas entre tablas dentro de una policy pasan por funciones
-- SECURITY DEFINER, porque una subconsulta directa contra otra tabla
-- re-dispara su RLS y termina en recursión (error 42P17); y las operaciones
-- de negocio que tocan dos tablas o que no pueden restringirse a "fila
-- completa" pasan por funciones angostas del mismo tipo, en vez de ampliar
-- policies a fila completa que darían de más.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) El repartidor necesita ver la dirección de un pedido PENDING para poder
--    cotizar el envío ANTES de comprometerse.
--
--    Hoy solo ve la dirección de pedidos que YA tiene asignados
--    (addresses_select_assigned_delivery). Sin esto, el nuevo flujo es
--    imposible: no se puede poner precio a una entrega sin saber a dónde va.
--
--    Esta policy amplía la VISIBILIDAD, no agrega capacidad de escritura: el
--    repartidor sigue sin poder modificar ni borrar direcciones
--    (addresses_update_own / addresses_delete_own son solo del cliente).
--
--    Decisión de producto documentada en el plan (nota 3.2): se muestra la
--    dirección exacta a cualquier repartidor de "Disponibles", incluso antes
--    de comprometerse. Es más permisivo que Uber/Rappi (que muestran zona o
--    distancia hasta el compromiso); la alternativa ya está diseñada en la
--    Fase 5 del plan si algún día se quiere endurecer.
-- ----------------------------------------------------------------------------
create or replace function public.pending_order_address_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select address_id from public.orders where status = 'PENDING'
$$;

-- Nota deliberada sobre privilegios: esta función NO se "revoca" como las
-- funciones invocables del punto 4 y 5. Las expresiones de una policy RLS se
-- evalúan con los privilegios del rol que consulta, así que si un rol pierde
-- EXECUTE sobre una función usada en un USING, la consulta falla con
-- "permission denied for function" en vez de devolver cero filas. Es el mismo
-- motivo por el que current_role()/current_profile_id() y compañía tampoco se
-- revocan. Lo único que expone es el UUID de direcciones de pedidos PENDING —
-- un identificador no enumerable que no da acceso a la fila (addresses sigue
-- protegida por RLS) y que cualquier repartidor ya ve por diseño.
create policy "addresses_select_pending_delivery"
on public.addresses for select
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.pending_order_address_ids())
);


-- ----------------------------------------------------------------------------
-- 2) El repartidor pasa el pedido de PENDING a AWAITING_PAYMENT al enviar su
--    oferta (antes pasaba directo a ASSIGNED al aceptar).
--
--    El `using` no cambia: current_delivery_order_ids() ya cubre "pedidos con
--    una fila mía en deliveries", y esa fila existe desde el instante en que
--    se inserta la oferta (policy deliveries_insert_delivery_self).
--    Lo que cambia es el `with check`: la lista de estados destino válidos
--    gana AWAITING_PAYMENT — sin esto, la oferta insertaría la fila en
--    `deliveries` pero el UPDATE del pedido sería rechazado por RLS y el
--    repartidor quedaría con una oferta huérfana.
--
--    Sigue sin poder CANCELAR un pedido (CANCELLED no está en la lista): solo
--    avanza el flujo, esa restricción no se relaja.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_update_delivery_assigned" on public.orders;
create policy "orders_update_delivery_assigned"
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.current_delivery_order_ids())
)
with check (
  status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
);


-- ----------------------------------------------------------------------------
-- 3) El cliente puede cancelar mientras el pago AÚN no se confirmó
--    (PENDING o AWAITING_PAYMENT).
--
--    Hasta ahora solo podía cancelar en PENDING. Se amplía a AWAITING_PAYMENT
--    porque sigue siendo cierto lo que justificaba la policy original: dentro
--    de la plataforma todavía no cambió nada de manos (el pago del envío es
--    por Yape, fuera de la app, y todavía no se confirmó). Una vez ASSIGNED
--    (pago autoconfirmado por el cliente) el pedido deja de ser autoservicio,
--    igual que antes.
--
--    LÍMITE CONOCIDO Y DELIBERADO: esta policy solo cambia el estado del
--    pedido; NO borra la fila de `deliveries` de la oferta pendiente. Ese
--    saneamiento va en cancelOrder() (Fase 2 del plan) — es código de
--    servidor, donde además se puede avisar al repartidor. Se deja anotado
--    porque es el único punto donde la cancelación deja un residuo.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_update_own_customer_cancel" on public.orders;
create policy "orders_update_own_customer_cancel"
on public.orders for update
using (
  customer_id = public.current_profile_id()
  and status in ('PENDING', 'AWAITING_PAYMENT')
)
with check (
  status = 'CANCELLED'
);


-- ----------------------------------------------------------------------------
-- 4) confirm_delivery_payment: transición atómica AWAITING_PAYMENT -> ASSIGNED
--
-- ¿Por qué una función y no dos UPDATEs desde el cliente protegidos por RLS?
--   a) La operación toca DOS tablas (orders + deliveries) y debe ser atómica:
--      "el cliente confirmó" y "el pedido arrancó" no pueden quedar
--      desincronizados a medias.
--   b) Una policy de UPDATE directa sobre `deliveries` para el cliente sería a
--      nivel de FILA, no de columna: con esa policy, un cliente podría hacer
--      un PATCH manual y tocar delivery_person_id, delivered_at o picked_up_at,
--      no solo payment_confirmed_at. El proyecto ya tiene un hallazgo abierto
--      sobre la efectividad real de los REVOKE por columna
--      (docs/decisions-and-learnings.md), así que acá no se apuesta a eso.
--      Una función que SOLO hace esta transición es la superficie mínima.
--
-- Semántica de error: cada rechazo tiene un mensaje propio y distinto. El
-- orden de las validaciones importa y es deliberado:
--   - La comprobación de identidad usa `is distinct from` y no `<>`: con `<>`,
--     comparar contra un current_profile_id() NULL devuelve NULL y el IF no se
--     dispararía, dejando pasar la confirmación a un llamador sin sesión
--     (p. ej. service_role vía adminClient, que no tiene auth.uid()). Con
--     `is distinct from`, ese caso falla. Además se rechaza explícitamente
--     antes de tocar nada si no hay perfil.
--   - La idempotencia (ya confirmado) se evalúa ANTES del chequeo de estado,
--     para que un doble clic o un reintento de la Server Action reciba
--     "ya fue confirmado" y no el genérico "no hay oferta esperando".
--
-- Contrato para quien la invoque: depende de auth.uid() para saber quién es el
-- cliente, así que funciona desde Server Actions (cliente con cookies) y desde
-- la API v1 con createBearerClient(accessToken), pero NO desde adminClient()
-- (no hay usuario autenticado). Documentado también en el plan (Fase 2.6) para
-- que nadie lo "simplifique" a service_role y rompa la validación de dueño.
-- ----------------------------------------------------------------------------
create or replace function public.confirm_delivery_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_status public.order_status;
  v_delivery_id uuid;
  v_fee numeric(10,2);
  v_confirmed_at timestamptz;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- FOR UPDATE OF o: bloquea la fila del pedido durante la transición para que
  -- dos confirmaciones simultáneas no puedan intercalarse. `d` es el lado
  -- nullable del LEFT JOIN y Postgres no permite `for update` sobre él; la
  -- carrera sobre `deliveries` la cubre el `payment_confirmed_at is null` del
  -- UPDATE + el chequeo de FOUND.
  select o.customer_id, o.status, d.id, d.delivery_fee, d.payment_confirmed_at
    into v_customer_id, v_status, v_delivery_id, v_fee, v_confirmed_at
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id
  for update of o;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  if v_customer_id is distinct from public.current_profile_id() then
    raise exception 'No puedes confirmar el pago de un pedido que no es tuyo'
      using errcode = '42501';
  end if;

  if v_confirmed_at is not null then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  if v_status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'Este pedido no tiene una oferta de envío esperando confirmación'
      using errcode = '22000';
  end if;

  if v_delivery_id is null then
    raise exception 'No hay repartidor asociado a este pedido'
      using errcode = '22000';
  end if;

  if v_fee is null then
    raise exception 'El repartidor no definió una tarifa de envío'
      using errcode = '22000';
  end if;

  update public.deliveries
  set payment_confirmed_at = now(),
      accepted_at = now()
  where id = v_delivery_id
    and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  update public.orders
  set status = 'ASSIGNED',
      delivery_fee = v_fee
  where id = p_order_id
    and status = 'AWAITING_PAYMENT';

  -- Si el estado cambió entre el SELECT y el UPDATE (cancelación del cliente en
  -- paralelo), se levanta un error en vez de dejar el pedido sin avanzar: la
  -- excepción revierte TAMBIÉN el update de deliveries, así que "confirmado"
  -- y "arrancado" nunca quedan a medias.
  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
      using errcode = '40001';
  end if;
end;
$$;

-- Superficie mínima: en Supabase, `anon` recibe EXECUTE por privilegios por
-- defecto sobre funciones nuevas en el schema public, así que revocar de
-- `public` no alcanza — hay que revocar de `anon` explícitamente. Solo
-- `authenticated` puede invocarla (y service_role, que conserva su grant por
-- defecto; si alguien la llama sin sesión de usuario, la función lo rechaza
-- con 'No autenticado').
revoke all on function public.confirm_delivery_payment(uuid) from public, anon;
grant execute on function public.confirm_delivery_payment(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5) get_delivery_offer_profile: expone SOLO nombre, foto y QR del repartidor
--    asignado a un pedido PROPIO del cliente que llama — nunca teléfono,
--    documento ni ningún otro campo de `profiles`.
--
-- ¿Por qué una función y no una policy de SELECT sobre profiles? Porque RLS no
-- sabe restringir COLUMNAS: una policy "el cliente puede leer el perfil de su
-- repartidor asignado" le entregaría la fila completa (phone, document_number,
-- email). Hoy profiles solo se puede leer la propia fila o siendo ADMIN; esto
-- mantiene esa garantía y agrega exactamente los tres campos que el cliente
-- necesita para pagarle, más la tarifa ofertada.
--
-- `stable` porque es una lectura pura dentro de una transacción; el filtro por
-- customer_id = current_profile_id() hace que un cliente solo vea su propio
-- pedido — no hace falta validar de nuevo en la capa de aplicación, y si el
-- pedido no es suyo simplemente devuelve cero filas.
-- ----------------------------------------------------------------------------
create or replace function public.get_delivery_offer_profile(p_order_id uuid)
returns table (
  full_name text,
  avatar_url text,
  yape_qr_url text,
  delivery_fee numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.avatar_url, p.yape_qr_url, d.delivery_fee
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  join public.profiles p on p.id = d.delivery_person_id
  where o.id = p_order_id
    and o.customer_id = public.current_profile_id()
$$;

revoke all on function public.get_delivery_offer_profile(uuid) from public, anon;
grant execute on function public.get_delivery_offer_profile(uuid) to authenticated;
