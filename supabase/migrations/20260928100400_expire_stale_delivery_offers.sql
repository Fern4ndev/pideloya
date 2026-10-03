-- ============================================================================
-- PideloYa — Expiración de ofertas de envío que el cliente nunca pagó
-- ============================================================================
-- Cierra el único agujero que le quedaba al flujo de oferta: si el cliente
-- nunca confirma el pago, el pedido se queda en AWAITING_PAYMENT y el
-- repartidor "ocupado" (AWAITING_PAYMENT cuenta como entrega activa) hasta que
-- alguno de los dos actúe a mano. Ambas partes tienen salida manual — el
-- repartidor puede retirar su oferta y el cliente puede cancelar — pero nadie
-- debería tener que darse cuenta: la oferta vieja se retira sola.
--
-- ¿Por qué es una función y no un endpoint con service role que haga los
-- DELETE/UPDATE por REST? Por los mismos motivos que offer_delivery y
-- retract_delivery_offer: son dos tablas que deben cambiar juntas (si el pedido
-- vuelve a PENDING y la fila de `deliveries` no se borra, el UNIQUE(order_id)
-- deja el pedido imposible de tomar; si se borra la fila y el pedido no vuelve,
-- queda un pedido fantasma que nadie ve), y el orden de los locks importa:
-- `orders` primero, `deliveries` después, igual que confirm_delivery_payment y
-- retract_delivery_offer. Respetarlo es lo que hace que, si el cliente confirma
-- el pago justo cuando el job está expirando la oferta, gane uno de los dos de
-- forma consistente en vez de quedar un pedido a medias.
--
-- NO se programa acá con pg_cron a propósito (decisión del equipo): la función
-- queda lista para invocarla desde donde prefieran. Dos formas soportadas:
--
--   1. Cron externo / Edge Function con la service role key:
--        POST /rest/v1/rpc/expire_stale_delivery_offers
--        { "p_max_age": "10 minutes" }
--      (el cuerpo puede ir vacío para usar el default de 10 minutos)
--   2. Manual, para destrabar algo puntual desde el SQL editor o el dashboard.
--
-- Privilegios: SOLO service_role. Es una operación de sistema, no de usuario:
-- no depende de auth.uid() y no debe ser invocable por un cliente logueado
-- (podría, por ejemplo, expirar ofertas de otras personas a voluntad).
-- ============================================================================

create or replace function public.expire_stale_delivery_offers(
  p_max_age interval default interval '10 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_ids uuid[] := '{}';
  v_delivery_ids uuid[] := '{}';
  v_order_id uuid;
  v_delivery_id uuid;
  v_count integer := 0;
begin
  if p_max_age is null or p_max_age <= interval '0 seconds' then
    raise exception 'La antigüedad máxima debe ser mayor a cero'
      using errcode = '22000';
  end if;

  -- Paso 1 — pedidos candidatos, BLOQUEADOS y evaluados uno por uno.
  -- `for update` no admite funciones de agregado, así que el array se arma con
  -- un loop de cursor; de paso, el lock se toma fila por fila en el mismo orden
  -- que el resto del flujo (orders → deliveries).
  for v_order_id in
    select o.id
    from public.orders o
    where o.status = 'AWAITING_PAYMENT'
      and exists (
        select 1
        from public.deliveries d
        where d.order_id = o.id
          and d.payment_confirmed_at is null
          and d.offered_at is not null
          and d.offered_at < now() - p_max_age
      )
    for update
  loop
    v_order_ids := array_append(v_order_ids, v_order_id);
  end loop;

  if array_length(v_order_ids, 1) is null then
    return 0;
  end if;

  -- Paso 2 — las entregas de esos pedidos, bloqueadas y re-validadas.
  -- En READ COMMITTED, `for update` vuelve a evaluar la condición sobre la
  -- versión más reciente de la fila, así que una entrega que el cliente acaba
  -- de confirmar queda fuera de la lista en vez de borrarse.
  for v_delivery_id in
    select d.id
    from public.deliveries d
    where d.order_id = any (v_order_ids)
      and d.payment_confirmed_at is null
    for update
  loop
    v_delivery_ids := array_append(v_delivery_ids, v_delivery_id);
  end loop;

  if array_length(v_delivery_ids, 1) is null then
    return 0;
  end if;

  -- Orden de escritura: borrar primero la entrega y después devolver el pedido
  -- a PENDING. Es el mismo orden que releaseActiveDeliveries (el helper de
  -- admin) por el mismo motivo: si se hiciera al revés, un repartidor podría
  -- chocar con el UNIQUE(order_id) al ofertar en el pedido recién liberado
  -- mientras la fila vieja sigue existiendo.
  delete from public.deliveries where id = any (v_delivery_ids);

  update public.orders
  set status = 'PENDING'
  where id = any (v_order_ids)
    and status = 'AWAITING_PAYMENT';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Superficie mínima: ni `public`, ni `anon`, ni `authenticated` (en Supabase
-- los dos últimos reciben EXECUTE por privilegios por defecto sobre funciones
-- nuevas del schema public, así que hay que revocarlos explícitamente).
revoke all on function public.expire_stale_delivery_offers(interval) from public, anon, authenticated;
grant execute on function public.expire_stale_delivery_offers(interval) to service_role;
