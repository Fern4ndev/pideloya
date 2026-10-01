-- ============================================================================
-- 20261002100600_drop_legacy_payment_columns.sql  (FASE 12 — CONTRACT)
--
-- ⚠️  NO ESTÁ EN supabase/migrations/ A PROPÓSITO ⚠️
--
-- Este archivo vive en docs/db-contract/ y NO debe moverse a
-- supabase/migrations/ hasta que la app nueva esté DESPLEGADA y estable.
-- El próximo `npx supabase db push` aplicaría cualquier archivo que esté en
-- supabase/migrations/: si esta migración se aplica antes del deploy, la app
-- desplegada deja de leer cash_collected_at y la UI del repartidor muestra
-- "sin cobro" en entregas que sí fueron cobradas (mismo criterio que la
-- migración contract del ciclo anterior,
-- 20260930100400_drop_legacy_offer_functions.sql, que sí se aplicó porque su
-- deploy ya había ocurrido).
--
-- Qué quita (todo legado del ciclo "método de pago", 20261001):
--   1. complete_delivery(uuid, boolean) — firma vieja de UN flag. La vigente
--      es complete_delivery(uuid, boolean, text) (20261002100200). Postgres
--      resuelve por firma: el drop del (uuid, boolean) NO toca la de 3 args.
--      Mientras exista, un llamador viejo puede seguir mandando solo el flag:
--      correcto durante la transición, sobrante después.
--   2. deliveries_cash_collected_requires_cash_check — YA FUE reemplazado por
--      deliveries_collected_check en 20261002100000 (drop + add en la misma
--      migración). Este drop es idempotente y documenta el cierre.
--   3. deliveries.cash_collected_at — columna del dual-write. Desde la Fase 1
--      tiene su par genérico collected_at (backfill en 20261002100000) y la
--      app ya no la lee (grep verificado: solo quedaba en el select del
--      detalle del repartidor, retirado en este mismo ciclo).
--   4. El parámetro p_cash_collected de complete_delivery v2 (renombrado a
--      "solo cobre efectivo" en el ciclo anterior) se RETIRA de la firma:
--      pasa a complete_delivery(p_order_id uuid, p_collected_method text).
--      Server Action y API v1 siguen mandando p_cash_collected HOY; el
--      acompañante de código de esta fase los actualiza al mismo tiempo
--      (lib/actions/deliveries.ts + app/api/v1/*/advance). Como Postgres
--      resuelve por posición y los llamadores mandan (uuid, boolean, text),
--      la firma (uuid, text) NO es alcanzable por ellos — por eso el cambio
--      de firma va en el MISMO commit que los llamadores.
--
-- REQUISITOS (checklist antes de moverlo a supabase/migrations/ y hacer push):
--   [ ] Deploy de la app con `collected`/`collected_method` hecho y estable
--       (Fases 3–9 desplegadas).
--   [ ] grep de la app sin cash_collected_at / p_cash_collected /
--       cashAmountDue (los tres se retiran en el mismo cambio).
--   [ ] Suite completa en verde contra staging con esta migración aplicada.
--
-- ORDEN DE DESPLIEGUE (plan, Fase 12.1): migraciones 1.1–1.4 + 7 + 8 (solo
-- agregan; firmas compatibles) → tipos → UI repartidor → toggle → UI cliente
-- → visibilidad/incidencias/legales → QA → ESTA migración al final.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Firma legacy de complete_delivery (2 args, flag booleano).
--    Con firma explícita: drop function complete_delivery sería ambiguo
--    ("function is not unique") con la sobrecarga de 3 args si ambas vivieran
--    — por eso el drop del (uuid, text) del paso 4 va DESPUÉS de recrear la
--    función unificada.
-- ----------------------------------------------------------------------------
drop function if exists public.complete_delivery(uuid, boolean);

-- ----------------------------------------------------------------------------
-- 2) CHECK viejo (idempotente: ya no existe desde 20261002100000).
-- ----------------------------------------------------------------------------
alter table public.deliveries
  drop constraint if exists deliveries_cash_collected_requires_cash_check;

-- ----------------------------------------------------------------------------
-- 3) Columna del dual-write. `collected_at`/`collected_method` ya tienen el
--    histórico completo (backfill dual-write de 20261002100000). NO se dropea
--    payment_timing/collected_at/collected_method/restaurant_paid_at: son el
--    registro de quién cobró qué (plan 12.2: se perdería la evidencia).
-- ----------------------------------------------------------------------------
comment on column public.deliveries.cash_collected_at is
  'DEPRECATED (Fase 12): reemplazada por collected_at. Se elimina en la siguiente migración una vez desplegada la app que ya no la lee.';
alter table public.deliveries drop column if exists cash_collected_at;

-- ----------------------------------------------------------------------------
-- 4) Firma unificada de complete_delivery: (uuid, text). Sin flag booleano:
--    el medio del cobro se DECLARA ('YAPE'|'CASH'), no se adivina de un flag.
--    Recrea la función con el cuerpo v2 (20261002100200) menos el dual-write
--    (la columna ya no existe) y menos la rama del flag legacy.
-- ----------------------------------------------------------------------------
drop function if exists public.complete_delivery(uuid, boolean, text);

create function public.complete_delivery(
  p_order_id uuid,
  p_collected_method text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_status public.order_status;
  v_delivery_id uuid;
  v_timing text;
  v_collected_method text;
begin
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- Orden de locks: `orders` primero, `deliveries` después — el mismo de
  -- select_delivery_payment, retract_delivery_offer y
  -- expire_stale_delivery_offers (evita el deadlock AB-BA).
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  if v_status <> 'ON_THE_WAY' then
    raise exception 'El pedido no está en camino'
      using errcode = '22000';
  end if;

  select d.id, d.payment_timing
    into v_delivery_id, v_timing
  from public.deliveries d
  where d.order_id = p_order_id
    and d.delivery_person_id = v_profile_id
  for update;

  if not found then
    -- El override de ADMIN es la única puerta alternativa (soporte).
    if public.current_role() = 'ADMIN' then
      select d.id, d.payment_timing
        into v_delivery_id, v_timing
      from public.deliveries d
      where d.order_id = p_order_id
      for update;
    end if;
    if v_delivery_id is null then
      raise exception 'No puedes entregar un pedido que no asignaron a ti'
        using errcode = '42501';
    end if;
  end if;

  -- Dentro de ON_DELIVERY el medio se DECLARA y se valida; fuera de
  -- ON_DELIVERY no hay cobro que registrar (el dinero ya se movió).
  if v_timing = 'ON_DELIVERY' then
    if p_collected_method is not null
       and p_collected_method not in ('YAPE', 'CASH') then
      raise exception 'Medio de cobro inválido'
        using errcode = '22000';
    end if;
    v_collected_method := p_collected_method;
  else
    v_collected_method := null;
  end if;

  -- La guarda REAL del cobro (D4/D8): un pedido que se paga al recibir no se
  -- cierra sin declarar el medio.
  if v_timing = 'ON_DELIVERY' and v_collected_method is null then
    raise exception 'Confirma que cobraste antes de marcar la entrega'
      using errcode = '22000';
  end if;

  update public.deliveries
     set delivered_at = now(),
         collected_at = case when v_collected_method is not null then now() end,
         collected_method = v_collected_method
   where id = v_delivery_id;

  update public.orders
     set status = 'DELIVERED'
   where id = p_order_id
     and status = 'ON_THE_WAY';

  -- Si el estado cambió entre el SELECT y el UPDATE, la excepción revierte
  -- también el update de deliveries: nunca queda una entrega "a medias".
  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo entregado'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.complete_delivery(uuid, text) from public, anon;
grant execute on function public.complete_delivery(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) (Opcional del plan 12.1.9) Endurecer orders_update_delivery_assigned:
--    quita DELIVERED del `with check` — la única puerta a DELIVERED pasa a ser
--    complete_delivery(). PICKED_UP se conserva porque pickup_delivery() es
--    SECURITY DEFINER y no atraviesa esta policy (verificado: RPC con search_path
--    público y definer = propietario), pero DELIVERED sí se alcanzaba por RLS
--    con un UPDATE crudo de la app vieja.
--    La policy se re-crea (drop if exists + create): Postgres no soporta
--    "alter policy ... with check".
-- ----------------------------------------------------------------------------
drop policy if exists orders_update_delivery_assigned on public.orders;
create policy orders_update_delivery_assigned
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (
    select order_id from public.deliveries
    where delivery_person_id = public.current_profile_id()
  )
)
with check (
  status in ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')
);

-- ============================================================================
-- ROLLBACK (solo si hay que revertir el despliegue después de aplicar esto).
-- Reproduce el estado de 20261002100200 VERBATIM (cuerpo v2 con dual-write).
--
-- begin;
--
-- drop function if exists public.complete_delivery(uuid, text);
--
-- create function public.complete_delivery(
--   p_order_id uuid,
--   p_cash_collected boolean default false,
--   p_collected_method text default null
-- )
-- returns void
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_profile_id uuid := public.current_profile_id();
--   v_status public.order_status;
--   v_delivery_id uuid;
--   v_method text;
--   v_timing text;
--   v_collected_method text;
-- begin
--   if v_profile_id is null then
--     raise exception 'No autenticado' using errcode = '42501';
--   end if;
--   select status into v_status from public.orders
--     where id = p_order_id for update;
--   if not found then
--     raise exception 'Pedido no encontrado' using errcode = 'P0002';
--   end if;
--   if v_status <> 'ON_THE_WAY' then
--     raise exception 'El pedido no está en camino' using errcode = '22000';
--   end if;
--   select d.id, d.payment_timing into v_delivery_id, v_timing
--   from public.deliveries d
--   where d.order_id = p_order_id and d.delivery_person_id = v_profile_id
--   for update;
--   if not found then
--     if public.current_role() = 'ADMIN' then
--       select d.id, d.payment_timing into v_delivery_id, v_timing
--       from public.deliveries d where d.order_id = p_order_id for update;
--     end if;
--     if v_delivery_id is null then
--       raise exception 'No puedes entregar un pedido que no asignaron a ti'
--         using errcode = '42501';
--     end if;
--   end if;
--   if v_timing = 'ON_DELIVERY' then
--     if p_collected_method is not null then
--       if p_collected_method not in ('YAPE', 'CASH') then
--         raise exception 'Medio de cobro inválido' using errcode = '22000';
--       end if;
--       v_collected_method := p_collected_method;
--     elsif p_cash_collected is true then
--       v_collected_method := 'CASH';
--     end if;
--   else
--     v_collected_method := null;
--   end if;
--   if v_timing = 'ON_DELIVERY' and v_collected_method is null then
--     raise exception 'Confirma que cobraste antes de marcar la entrega'
--       using errcode = '22000';
--   end if;
--   update public.deliveries
--      set delivered_at = now(),
--          collected_at = case when v_collected_method is not null then now() end,
--          collected_method = v_collected_method,
--          cash_collected_at = case when v_collected_method = 'CASH' then now() end
--    where id = v_delivery_id;
--   update public.orders set status = 'DELIVERED'
--    where id = p_order_id and status = 'ON_THE_WAY';
--   if not found then
--     raise exception 'El pedido cambió de estado antes de marcarlo entregado'
--       using errcode = '40001';
--   end if;
-- end;
-- $$;
--
-- revoke all on function public.complete_delivery(uuid, boolean, text) from public, anon;
-- grant execute on function public.complete_delivery(uuid, boolean, text) to authenticated;
--
-- -- Columna del dual-write de vuelta (vacía: se re-backfillea desde collected_at).
-- alter table public.deliveries add column if not exists cash_collected_at timestamptz;
-- update public.deliveries
--    set cash_collected_at = collected_at
--  where collected_at is not null and collected_method = 'CASH';
-- comment on column public.deliveries.cash_collected_at is
--   'Cuándo el repartidor confirmó el cobro EN EFECTIVO (legado, dual-write de collected_at).';
--
-- -- CHECK legacy de vuelta (misma definición que creó 20261001100000).
-- alter table public.deliveries
--   drop constraint if exists deliveries_cash_collected_requires_cash_check;
-- alter table public.deliveries add constraint deliveries_cash_collected_requires_cash_check
--   check (cash_collected_at is null or payment_method = 'CASH');
--
-- -- Policy con DELIVERED de vuelta (estado del ciclo anterior).
-- drop policy if exists orders_update_delivery_assigned on public.orders;
-- create policy orders_update_delivery_assigned
-- on public.orders for update
-- using (
--   public.current_role() = 'DELIVERY'
--   and id in (
--     select order_id from public.deliveries
--     where delivery_person_id = public.current_profile_id()
--   )
-- )
-- with check (
--   status in ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
-- );
--
-- commit;
-- ============================================================================
