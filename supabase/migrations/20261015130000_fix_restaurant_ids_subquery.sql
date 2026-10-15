-- ============================================================================
-- PideloYa — Fix: `select id from current_restaurant_ids()` no existe
-- ============================================================================
-- Las migraciones 20261003120600 (aggregate_rpcs) y 20261003120900 (policies
-- initplan) usan en 5 lugares la forma:
--
--     ... in (select id from public.current_restaurant_ids() as rid)
--
-- `current_restaurant_ids()` devuelve SETOF uuid (un escalar, no una fila con
-- columna `id`): en el FROM su única columna se llama `current_restaurant_ids`
-- y pedir `id` falla con 42703 "column id does not exist". El alias `as rid`
-- renombra la TABLA, no la columna (para eso haría falta `as rid(id)`).
--
-- La forma original —la que estas migraciones reemplazaron— era la correcta:
--
--     ... in (select public.current_restaurant_ids())
--
-- Consecuencia: TODO lo que lee el rol RESTAURANT fallaba — sus productos
-- (products_select_owner: el panel mostraba "no se pudo cargar" aunque el
-- cliente veía el catálogo), sus pedidos (orders_select_restaurant_readonly,
-- order_items_select_restaurant) y sus tarjetas/gráficas (restaurant_stats,
-- restaurant_chart_items). Esta migración devuelve las 5 a la forma correcta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Policies (DROP + CREATE: Postgres no tiene OR REPLACE para policies)
-- ----------------------------------------------------------------------------
drop policy if exists "products_select_owner" on public.products;
create policy "products_select_owner"
on public.products for select
using (restaurant_id in (select public.current_restaurant_ids()));

drop policy if exists "order_items_select_restaurant" on public.order_items;
create policy "order_items_select_restaurant"
on public.order_items for select
using (restaurant_id in (select public.current_restaurant_ids()));

drop policy if exists "orders_select_restaurant_readonly" on public.orders;
create policy "orders_select_restaurant_readonly"
on public.orders for select
using (
  id in (
    select oi.order_id
    from public.order_items oi
    where oi.restaurant_id in (select public.current_restaurant_ids())
  )
);

-- ----------------------------------------------------------------------------
-- 2) restaurant_stats() — el CTE nombraba una columna inexistente
-- ----------------------------------------------------------------------------
-- `with rid as (select public.current_restaurant_ids() as id)`: el alias va
-- en la LISTA del select (ahí sí renombra la columna) y el resto del cuerpo
-- (`select id from rid`) queda intacto.
create or replace function public.restaurant_stats()
returns table (total_products bigint, available_products bigint, total_categories bigint, orders_this_week bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with rid as (select public.current_restaurant_ids() as id)
  select
    (select count(*) from public.products p where p.restaurant_id in (select id from rid)),
    (select count(*) from public.products p where p.restaurant_id in (select id from rid) and p.available),
    (select count(*) from public.categories c where c.restaurant_id in (select id from rid)),
    (select count(*) from public.order_items oi
      where oi.restaurant_id in (select id from rid)
        and oi.created_at >= (date_trunc('week', (now() at time zone 'America/Lima')::date) at time zone 'America/Lima'))
$$;

-- ----------------------------------------------------------------------------
-- 3) restaurant_chart_items() — misma corrección en el WHERE
-- ----------------------------------------------------------------------------
create or replace function public.restaurant_chart_items(p_days int default 366)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'order_id',    oi.order_id,
           'product_name',oi.product_name,
           'quantity',    oi.quantity,
           'unit_price',  oi.unit_price,
           'created_at',  oi.created_at
         ) order by oi.created_at desc), '[]'::json)
  from (
    select oi.order_id, oi.product_name, oi.quantity, oi.unit_price, oi.created_at
    from public.order_items oi
    where oi.restaurant_id in (select public.current_restaurant_ids())
      and oi.created_at >= (now() at time zone 'utc') - make_interval(days => greatest(p_days, 1))
    order by oi.created_at desc
    limit 20000
  ) oi;
$$;
