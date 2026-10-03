-- ============================================================================
-- PideloYa — RPCs cancel_order y start_route (C2 del plan de optimización)
-- ============================================================================
-- Motivo:
--   Hoy cancelar (cliente) y avanzar PICKED_UP → ON_THE_WAY (repartidor) son
--   UPDATEs directos sobre `orders` desde la sesión del usuario. La siguiente
--   migración (contract) revocará UPDATE/DELETE en orders y deliveries para
--   `authenticated`; estas RPCs SECURITY DEFINER son las puertas de reemplazo:
--   atómicas, con la autorización por dentro y sin exponer escritura directa.
--
--   - cancel_order: cliente dueño (o ADMIN, pero el admin pasa por service_role
--     y ni siquiera llega aquí: no tiene auth.uid()). Solo en PENDING o
--     AWAITING_PAYMENT (mismo criterio que la policy
--     orders_update_own_customer_cancel que la sustituye) y borra la oferta sin
--     confirmar (mismo filtro payment_confirmed_at is null que
--     releaseUnconfirmedOffer en lib/actions/orders.ts).
--
--   - start_route: solo el repartidor asignado, solo PICKED_UP → ON_THE_WAY.
--
-- Rollback (comentado, verbatim del estado anterior — las RPCs no existían):
--   drop function if exists public.cancel_order(uuid);
--   drop function if exists public.start_route(uuid);
-- ============================================================================
begin;

-- Cancelación (cliente). Atómica: cambia el estado y limpia la oferta sin
-- confirmar en la MISMA transacción.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_status   public.order_status;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select customer_id, status into v_customer, v_status
  from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;

  if v_customer is distinct from public.current_profile_id()
     and (select public.current_role()) <> 'ADMIN' then
    raise exception 'No puedes cancelar este pedido' using errcode = '42501';
  end if;

  if v_status not in ('PENDING', 'AWAITING_PAYMENT') then
    raise exception 'El pedido ya no se puede cancelar' using errcode = '22000';
  end if;

  -- La oferta huérfana (pago aún sin confirmar) se limpia aquí y no en TS:
  -- misma guarda que releaseUnconfirmedOffer (nunca tocar entregas con dinero
  -- confirmado — es historial de dinero cobrado).
  delete from public.deliveries
   where order_id = p_order_id and payment_confirmed_at is null;

  update public.orders set status = 'CANCELLED' where id = p_order_id;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- PICKED_UP -> ON_THE_WAY, solo el repartidor asignado.
create or replace function public.start_route(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_status  public.order_status;
begin
  if v_profile is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;

  perform 1 from public.deliveries
   where order_id = p_order_id and delivery_person_id = v_profile
   for update;
  if not found then
    raise exception 'No tienes este pedido asignado' using errcode = '42501';
  end if;

  if v_status is distinct from 'PICKED_UP' then
    raise exception 'El pedido no está recogido' using errcode = '22000';
  end if;

  update public.orders set status = 'ON_THE_WAY'
   where id = p_order_id and status = 'PICKED_UP';
end;
$$;

revoke all on function public.start_route(uuid) from public, anon;
grant execute on function public.start_route(uuid) to authenticated;

commit;
