-- ============================================================================
-- PideloYa — create_order transaccional (H5 + Fase 3 del plan de optimización)
-- ============================================================================
-- Motivo:
--   createOrder() hoy hace INSERT en orders y luego INSERT en order_items en
--   DOS peticiones: si la segunda falla, borra el pedido a mano (no atómico) y
--   un doble clic puede crear dos pedidos. Esta RPC SECURITY DEFINER crea
--   pedido + ítems en UNA transacción, recalcula SIEMPRE el total en servidor
--   (nunca confía en el precio del navegador), exige restaurante aprobado y
--   activo, dirección propia, un solo restaurante por pedido y añade:
--
--   - Idempotencia: p_client_request_id (uuid que genera el navegador al
--     confirmar). Un reintento de red o doble clic devuelve el MISMO pedido
--     (índice único (customer_id, client_request_id)).
--   - Anti-abuso: máximo 3 pedidos activos (PENDING/AWAITING_PAYMENT) por
--     cliente.
--
--   La validación de HORARIO (isRestaurantOpenNow, zona Lima) se queda en
--   TypeScript y se documenta la duplicación con el check de restaurante
--   aprobado/activo (misma decisión del plan; portarla a SQL es Fase 5).
--
--   ⚠️ El REVOKE INSERT en orders/order_items va en la migración CONTRACT
--   (20261003121500) DESPUÉS de desplegar el código que llama a esta RPC.
--
-- Rollback (comentado, verbatim del estado anterior):
--   drop function if exists public.create_order(uuid, text, jsonb, uuid);
--   drop index if exists public.orders_customer_request_id_uq;
--   alter table public.orders drop column if exists client_request_id;
-- ============================================================================
begin;

alter table public.orders add column if not exists client_request_id uuid;

-- Un pedido por (cliente, client_request_id). Los NULL (pedidos legacy y
-- integraciones sin idempotencia) no colisionan: Postgres ignora NULLs en
-- índices únicos.
create unique index if not exists orders_customer_request_id_uq
  on public.orders (customer_id, client_request_id);

create or replace function public.create_order(
  p_address_id uuid,
  p_notes text,
  p_items jsonb,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   public.profiles%rowtype;
  v_order     uuid;
  v_total     numeric(10,2);
  v_rest      uuid[];
  v_prod_count int;
begin
  -- Idempotencia: si ya existe un pedido con este client_request_id del MISMO
  -- cliente, devolverlo (el reintento no crea un segundo pedido).
  if p_client_request_id is not null then
    select id into v_order
    from public.orders
    where customer_id = (select public.current_profile_id())
      and client_request_id = p_client_request_id
    limit 1;
    if v_order is not null then
      return v_order;
    end if;
  end if;

  select * into v_profile from public.profiles where id = public.current_profile_id();
  if not found or v_profile.role <> 'CUSTOMER' or not v_profile.is_active then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Anti-abuso: máx. 3 pedidos activos (esperando repartidor o pago).
  if (select count(*) from public.orders
      where customer_id = v_profile.id
        and status in ('PENDING', 'AWAITING_PAYMENT')) >= 3 then
    raise exception 'Tienes demasiados pedidos activos. Espera a que se completen o cancelen.'
      using errcode = '22000';
  end if;

  perform 1 from public.addresses where id = p_address_id and customer_id = v_profile.id;
  if not found then
    raise exception 'Dirección inválida' using errcode = '22000';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Items inválidos' using errcode = '22000';
  end if;

  -- Productos REALES: disponibles, de restaurante aprobado y activo, cantidad
  -- positiva. El precio SIEMPRE del servidor.
  with req as (
    select (i->>'product_id')::uuid as pid, (i->>'quantity')::int as qty
    from jsonb_array_elements(p_items) i
  ), prod as (
    select p.id, p.price, p.restaurant_id, req.qty
    from req
    join public.products p on p.id = req.pid
    join public.restaurants r on r.id = p.restaurant_id
    where p.available and r.is_approved and r.is_active and req.qty > 0
  )
  select count(*), array_agg(distinct restaurant_id), sum(price * qty)
  into v_prod_count, v_rest, v_total
  from prod;

  -- TODOS los productos pedidos deben haber sobrevivido al filtro (existir,
  -- estar disponibles y con cantidad válida); si alguno no, rechazar todo.
  if v_total is null
     or v_prod_count <> (select count(*) from jsonb_array_elements(p_items)) then
    raise exception 'Alguno de los productos ya no está disponible' using errcode = '22000';
  end if;

  if v_rest is null or array_length(v_rest, 1) > 1 then
    raise exception 'No puedes pedir de más de un restaurante a la vez' using errcode = '22000';
  end if;

  -- El snapshot del cliente (nombre/teléfono) se congela al crear el pedido,
  -- igual que product_name en order_items.
  insert into public.orders
    (customer_id, customer_name, customer_phone, address_id, status, total, notes, client_request_id)
  values
    (v_profile.id, v_profile.full_name, v_profile.phone, p_address_id,
     'PENDING', v_total, nullif(p_notes, ''), p_client_request_id)
  returning id into v_order;

  insert into public.order_items
    (order_id, product_id, product_name, image_url, restaurant_id, restaurant_name, quantity, unit_price)
  select
    v_order, p.id, p.name, p.image_url, p.restaurant_id, r.name,
    (i->>'quantity')::int, p.price
  from jsonb_array_elements(p_items) i
  join public.products p on p.id = (i->>'product_id')::uuid
  join public.restaurants r on r.id = p.restaurant_id;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.create_order(uuid, text, jsonb, uuid) to authenticated;

commit;
