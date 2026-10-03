-- ============================================================================
-- PideloYa — RPCs agregadas por pantalla (Fase 3 del plan de optimización)
-- ============================================================================
-- Motivo (H4 + "una pantalla = 1 consulta"):
--   Los dashboards hoy disparan 4-6 consultas por render y traen TODAS las
--   filas para agregarlas en JS (admin/page.tsx no tiene límite: PostgREST
--   trunca silenciosamente a max_rows=1000 y las gráficas mienten al crecer).
--
--   Estas funciones son SECURITY INVOKER: corren con la sesión del usuario y
--   la RLS sigue aplicando (el admin ve todo; un rol sin permisos obtiene
--   conteos en cero — fail-closed). Las funciones de datos devuelven json, que
--   NO pasa por el límite max_rows de PostgREST.
--
--   Corrige también el bug de zona horaria de DeliveryDashboardCards: "hoy"
--   se calculaba con el reloj del navegador; aquí siempre es Lima.
--
-- Rollback (comentado, verbatim — antes estas funciones no existían):
--   drop function if exists public.delivery_stats();
--   drop function if exists public.restaurant_stats();
--   drop function if exists public.my_order_counts();
--   drop function if exists public.admin_counts();
--   drop function if exists public.admin_dashboard(int);
--   drop function if exists public.restaurant_chart_items(int);
--   drop function if exists public.delivery_chart_rows(int);
-- ============================================================================
begin;

-- 4 conteos del panel de repartidor en UNA consulta (antes: 6 requests —
-- getUser + profiles + 4 counts — con reloj del navegador para "hoy").
create or replace function public.delivery_stats()
returns table (available_orders int, active_deliveries int, delivered_today int, delivered_total int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.orders o
      where o.status = 'PENDING')::int,
    (select count(*) from public.deliveries d
      where d.delivery_person_id = (select public.current_profile_id())
        and d.delivered_at is null)::int,
    (select count(*) from public.deliveries d
      where d.delivery_person_id = (select public.current_profile_id())
        and d.delivered_at >= (date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima'))::int,
    (select count(*) from public.deliveries d
      where d.delivery_person_id = (select public.current_profile_id())
        and d.delivered_at is not null)::int
$$;

-- 4 conteos del panel de restaurante en UNA consulta (antes: getUser +
-- profiles + members + 4 counts). "Esta semana" = lunes 00:00 Lima, igual que
-- weekStartIso() en RestaurantDashboardCards.
create or replace function public.restaurant_stats()
returns table (total_products bigint, available_products bigint, total_categories bigint, orders_this_week bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with rid as (select id from public.current_restaurant_ids() as id)
  select
    (select count(*) from public.products p where p.restaurant_id in (select id from rid)),
    (select count(*) from public.products p where p.restaurant_id in (select id from rid) and p.available),
    (select count(*) from public.categories c where c.restaurant_id in (select id from rid)),
    (select count(*) from public.order_items oi
      where oi.restaurant_id in (select id from rid)
        and oi.created_at >= (date_trunc('week', (now() at time zone 'America/Lima')::date) at time zone 'America/Lima'))
$$;

-- 5 conteos de GET /api/v1/orders (CUSTOMER) en UNA consulta (antes: 5
-- consultas count en Promise.all + la página = 6).
create or replace function public.my_order_counts()
returns table (all_orders bigint, active bigint, delivered bigint, cancelled bigint, pending bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.orders o where o.customer_id = (select public.current_profile_id())),
    (select count(*) from public.orders o
      where o.customer_id = (select public.current_profile_id())
        and o.status in ('PENDING','AWAITING_PAYMENT','ASSIGNED','PICKED_UP','ON_THE_WAY')),
    (select count(*) from public.orders o
      where o.customer_id = (select public.current_profile_id()) and o.status = 'DELIVERED'),
    (select count(*) from public.orders o
      where o.customer_id = (select public.current_profile_id()) and o.status = 'CANCELLED'),
    (select count(*) from public.orders o
      where o.customer_id = (select public.current_profile_id()) and o.status = 'PENDING')
$$;

-- Badges del sidebar admin (3) + tarjetas del dashboard (6) en UNA consulta.
create or replace function public.admin_counts()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'total_users',          (select count(*) from public.profiles),
    'restaurants_pending',  (select count(*) from public.restaurants where is_approved = false),
    'restaurants_active',   (select count(*) from public.restaurants where is_approved = true),
    'deliveries_pending',   (select count(*) from public.profiles where role = 'DELIVERY' and is_active = false),
    'deliveries_active',    (select count(*) from public.profiles where role = 'DELIVERY' and is_active = true),
    'orders_today',         (select count(*) from public.orders
                              where created_at >= (date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima')),
    'payment_incidents_open', (select count(*) from public.payment_incidents where resolved_at is null)
  );
$$;

-- Datos de las gráficas de /admin, PRE-agregados por día de Lima:
--   sales_daily            → ventas (nº de pedidos) por día (filtro "Todos")
--   sales_by_restaurant    → ídem, por restaurante (filtro del selector)
--   delivered_by_person    → entregas por día y repartidor (filtro del selector)
--   restaurants / delivery_persons → opciones de los selects
-- El cliente re-bucketea día→semana/mes en memoria (cambiar rango/granularidad
-- no dispara consultas, igual que hoy) y ya no depende de traer todas las
-- filas (H4: truncado silencioso a max_rows).
create or replace function public.admin_dashboard(p_days int default 366)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  with lima_orders as (
    select o.id,
           o.status,
           ((o.created_at at time zone 'utc') at time zone 'America/Lima')::date as day
    from public.orders o
    where o.created_at >= (now() at time zone 'utc') - make_interval(days => greatest(p_days, 1))
  )
  select json_build_object(
    'generated_at', now(),
    'restaurants', (
      select coalesce(json_agg(json_build_object('id', r.id, 'name', r.name) order by r.name), '[]'::json)
      from public.restaurants r where r.is_approved = true
    ),
    'delivery_persons', (
      select coalesce(json_agg(json_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name), '[]'::json)
      from public.profiles p where p.role = 'DELIVERY'
    ),
    'sales_daily', (
      select coalesce(json_agg(json_build_object('day', day, 'n', n) order by day), '[]'::json)
      from (select day, count(*)::int as n from lima_orders group by day) t
    ),
    'sales_by_restaurant', (
      select coalesce(json_agg(json_build_object('day', day, 'restaurant_id', restaurant_id, 'n', n) order by day), '[]'::json)
      from (
        select lo.day, oi.restaurant_id, count(distinct lo.id)::int as n
        from lima_orders lo
        join public.order_items oi on oi.order_id = lo.id
        group by lo.day, oi.restaurant_id
      ) t
    ),
    'delivered_by_person', (
      select coalesce(json_agg(json_build_object('day', day, 'delivery_person_id', delivery_person_id, 'n', n) order by day), '[]'::json)
      from (
        select lo.day, d.delivery_person_id, count(*)::int as n
        from lima_orders lo
        join public.deliveries d on d.order_id = lo.id
        where lo.status = 'DELIVERED' and d.delivery_person_id is not null
        group by lo.day, d.delivery_person_id
      ) t
    )
  );
$$;

-- Líneas de order_items del restaurante del usuario (para las gráficas del
-- panel). json NO pasa por max_rows: el tope interno de 20000 reemplaza el
-- límite PostgREST de 5000 que hoy se truncaba a 1000 (H4).
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
    where oi.restaurant_id in (select id from public.current_restaurant_ids() as id)
      and oi.created_at >= (now() at time zone 'utc') - make_interval(days => greatest(p_days, 1))
    order by oi.created_at desc
    limit 20000
  ) oi;
$$;

-- Entregas completadas del repartidor (para las gráficas del panel), con el
-- estado del pedido para descartar las no completadas. `delivery_fee` (lo que
-- GANÓ el repartidor), no orders.total.
create or replace function public.delivery_chart_rows(p_days int default 366)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'delivered_at', d.delivered_at,
           'delivery_fee', d.delivery_fee,
           'status',       o.status
         ) order by d.delivered_at desc), '[]'::json)
  from (
    select d.delivered_at, d.delivery_fee, d.order_id
    from public.deliveries d
    where d.delivery_person_id = (select public.current_profile_id())
      and d.delivered_at >= (now() at time zone 'utc') - make_interval(days => greatest(p_days, 1))
    order by d.delivered_at desc
    limit 20000
  ) d
  left join public.orders o on o.id = d.order_id;
$$;

-- Ejecutables por usuarios autenticados (RLS de cada tabla es el enforcement;
-- con otro rol los conteos devuelven cero, nunca error).
revoke all on function public.delivery_stats()          from public, anon;
revoke all on function public.restaurant_stats()        from public, anon;
revoke all on function public.my_order_counts()         from public, anon;
revoke all on function public.admin_counts()            from public, anon;
revoke all on function public.admin_dashboard(int)      from public, anon;
revoke all on function public.restaurant_chart_items(int) from public, anon;
revoke all on function public.delivery_chart_rows(int)  from public, anon;
grant execute on function public.delivery_stats()          to authenticated;
grant execute on function public.restaurant_stats()        to authenticated;
grant execute on function public.my_order_counts()         to authenticated;
grant execute on function public.admin_counts()            to authenticated;
grant execute on function public.admin_dashboard(int)      to authenticated;
grant execute on function public.restaurant_chart_items(int) to authenticated;
grant execute on function public.delivery_chart_rows(int)  to authenticated;

commit;
