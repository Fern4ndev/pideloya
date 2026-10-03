-- ============================================================================
-- 20261002100600_drop_legacy_payment_columns.sql  (CONTRACT)
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
-- Qué quita (todo legado de los ciclos "método de pago" y "cobro declarado"):
--   1. deliveries.cash_collected_at — columna del dual-write. Desde
--      20261002100000 tiene su par genérico collected_at (con backfill) y
--      20261003100000 dejó de escribirla (complete_delivery ya no registra
--      medio). Nadie la lee en la app nueva.
--   2. La firma legacy complete_delivery(uuid, boolean) — el camino viejo de
--      un solo flag. La vigente es complete_delivery(uuid, boolean, text)
--      (20261003100000), que acepta los parámetros de cobro y los IGNORA.
--   3. Los DOS parámetros de cobro de la firma vigente: la función pasa a
--      complete_delivery(p_order_id uuid). Sin flag y sin medio: finalizar la
--      entrega es un toque, y la constancia es `collected_at` = "se finalizó
--      con cobro" (se elimina la guarda 22000 "Confirma que cobraste…").
--   4. Los CHECK del modelo anterior, reemplazados en 20261003100000:
--      deliveries_method_timing_pair_check (idempotente: ya no existe) y
--      deliveries_collected_pair_check.
--   5. (Opcional del plan) Endurecer orders_update_delivery_assigned: quitar
--      DELIVERED del `with check` — la única puerta a DELIVERED pasa a ser
--      complete_delivery().
--
-- LO QUE NO TOCA: payment_timing, collected_at, collected_method,
-- restaurant_paid_at. Son el registro de quién cobró qué y cuándo; borrarlos
-- eliminaría la evidencia (plan 12.2).
--
-- ⚠️  AL MOVERLO, RENOMBRAR: `20261002100600` ordena ANTES de
--     20261003100000, así que un `db push` con este nombre aplicaría el DROP
--     de la columna y de la firma ANTES de la migración que lo hace posible.
--     Tiene que entrar con un timestamp POSTERIOR (p. ej. 20261003110000).
--
-- REQUISITOS (checklist antes de moverlo a supabase/migrations/ y hacer push):
--   [ ] Deploy de la app sin `collected`/`collected_method` hecho y estable
--       (Fases 2–9 desplegadas).
--   [ ] grep de la app sin cash_collected_at / p_cash_collected /
--       p_collected_method (los tres se retiran en el mismo cambio).
--       ✅ Verificado el 2026-10-01: `app/`, `lib/`, `components/` y `hooks/`
--       no leen `cash_collected_at` (la única lectura de un medio de cobro es
--       `collected_method`, que NO se borra).
--   [ ] Quitar `cash_collected_at` de los `select` de scripts/e2e-delivery-offer.mjs
--       y de los tres scripts/verify-*.mjs (hoy lo seleccionan para afirmar que
--       no se escribe: con la columna borrada, esos `select` fallan con
--       "column does not exist"). Mismo cambio que esta migración.
--   [ ] Suite completa en verde contra staging con esta migración aplicada.
--
-- ORDEN DE DESPLIEGUE (plan, Fase 9): 20261003100000 (solo relaja) → tipos +
-- código (Fases 2–6, juntos) → QA → ESTA migración (renombrada) al final.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Columna del dual-write. `collected_at` ya tiene el histórico completo
--    (backfill dual-write de 20261002100000) y desde 20261003100000 es la
--    única fuente: la deprecada se elimina sin pérdida.
-- ----------------------------------------------------------------------------
alter table public.deliveries drop column if exists cash_collected_at;

-- ----------------------------------------------------------------------------
-- 2) Firma legacy de complete_delivery (2 args, flag booleano). Los llamadores
--    desplegados ya migraron; mientras exista, un cliente viejo podría seguir
--    mandando solo el flag. El drop del (uuid, boolean) es explícito y NO toca
--    la firma vigente (Postgres resuelve por firma).
-- ----------------------------------------------------------------------------
drop function if exists public.complete_delivery(uuid, boolean);

-- ----------------------------------------------------------------------------
-- 3) La firma vigente (uuid, boolean, text) pasa a (uuid): el cobro ya no se
--    declara, así que los dos parámetros sobran. DROP + CREATE en la misma
--    transacción porque la firma cambia (un CREATE OR REPLACE dejaría las dos
--    versiones vivas y cada llamada resolvería contra la ambigua).
--    Cuerpo = el de 20261003100000 menos la rama que ignoraba los parámetros,
--    que aquí ya no existen.
-- ----------------------------------------------------------------------------
drop function if exists public.complete_delivery(uuid, boolean, text);

create function public.complete_delivery(p_order_id uuid)
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

  if v_status is distinct from 'ON_THE_WAY' then
    raise exception 'El pedido no está en camino'
      using errcode = '22000';
  end if;

  -- Pertenencia por la FILA de la entrega (más fuerte que el rol).
  select id, payment_timing
    into v_delivery_id, v_timing
  from public.deliveries
  where order_id = p_order_id
    and delivery_person_id = v_profile_id
  for update;

  if not found then
    raise exception 'No tienes este pedido asignado'
      using errcode = '42501';
  end if;

  -- `collected_at` = "finalizó la entrega con cobro". Sin medio: el método ya
  -- no se pregunta (misma decisión que select_delivery_payment).
  update public.deliveries
     set delivered_at = now(),
         collected_at = case when v_timing = 'ON_DELIVERY' then now() end,
         collected_method = null
   where id = v_delivery_id;

  update public.orders
     set status = 'DELIVERED'
   where id = p_order_id
     and status = 'ON_THE_WAY';

  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo entregado'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.complete_delivery(uuid) from public, anon;
grant execute on function public.complete_delivery(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) CHECK del modelo anterior (idempotentes: ya no existen desde
--    20261003100000; el drop documenta el cierre del ciclo).
-- ----------------------------------------------------------------------------
alter table public.deliveries
  drop constraint if exists deliveries_method_timing_pair_check;
alter table public.deliveries
  drop constraint if exists deliveries_collected_pair_check;

-- ----------------------------------------------------------------------------
-- 5) Endurecer orders_update_delivery_assigned: quita DELIVERED del `with
--    check` — la única puerta a DELIVERED pasa a ser complete_delivery().
--    PICKED_UP se conserva porque pickup_delivery() es SECURITY DEFINER y no
--    atraviesa esta policy, pero DELIVERED sí se alcanzaba por RLS con un
--    UPDATE crudo.
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
-- Reproduce VERBATIM el estado de 20261003100000: la firma (uuid, boolean,
-- text) que ignora los parámetros de cobro.
--
-- begin;
--
-- drop function if exists public.complete_delivery(uuid);
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
--   v_timing text;
-- begin
--   if v_profile_id is null then
--     raise exception 'No autenticado' using errcode = '42501';
--   end if;
--   select status into v_status from public.orders
--     where id = p_order_id for update;
--   if not found then
--     raise exception 'Pedido no encontrado' using errcode = 'P0002';
--   end if;
--   if v_status is distinct from 'ON_THE_WAY' then
--     raise exception 'El pedido no está en camino' using errcode = '22000';
--   end if;
--   select id, payment_timing into v_delivery_id, v_timing
--   from public.deliveries
--   where order_id = p_order_id and delivery_person_id = v_profile_id
--   for update;
--   if not found then
--     raise exception 'No tienes este pedido asignado' using errcode = '42501';
--   end if;
--   -- Los parámetros se aceptan y se IGNORAN (compatibilidad con la app
--   -- desplegada): el medio del cobro ya no se registra.
--   update public.deliveries
--      set delivered_at = now(),
--          collected_at = case when v_timing = 'ON_DELIVERY' then now() end,
--          collected_method = null
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
-- update public.deliveries set cash_collected_at = collected_at
--  where collected_at is not null and collected_method = 'CASH';
-- comment on column public.deliveries.cash_collected_at is
--   'Cuándo el repartidor confirmó el cobro EN EFECTIVO (legado, dual-write de collected_at).';
--
-- -- Los CHECK del modelo anterior. OJO: imposible si ya existen pedidos con
-- -- ON_DELIVERY y método NULL — reponer deliveries_method_timing_pair_check
-- -- haría fallar la migración. El rollback real es de código, no de datos.
-- alter table public.deliveries add constraint deliveries_method_timing_pair_check
--   check ((payment_method is null) = (payment_timing is null));
-- alter table public.deliveries add constraint deliveries_collected_pair_check
--   check ((collected_at is null) = (collected_method is null));
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
