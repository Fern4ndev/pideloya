-- ============================================================================
-- PideloYa — Verificación del Yape por el repartidor antes de ir al negocio
-- ============================================================================
-- Hasta ahora, cuando el cliente elegía "Pagar ahora" y subía su comprobante
-- de Yape, select_delivery_payment() movía el pedido DIRECTO a ASSIGNED
-- ("Repartidor en camino al negocio") sin que nadie mirara el comprobante.
-- Si el yapeo estaba mal (monto distinto, captura de otro pago), el
-- repartidor ya estaba comprometido con una entrega mal pagada.
--
-- Desde este cambio, el pago por adelantado tiene DOS firmas:
--
--   1. El CLIENTE confirma (select_delivery_payment, rama UPFRONT): guarda el
--      comprobante y los snapshots, pero el pedido se QUEDA en
--      AWAITING_PAYMENT. Todavía no hay entrega en marcha.
--   2. El REPARTIDOR verifica (verify_upfront_payment): mira el comprobante,
--      lo contrasta con el total (comida + envío) y recién ahí el pedido pasa
--      a ASSIGNED. Si el comprobante no corresponde, lo rechaza
--      (reject_upfront_payment) y el pedido vuelve a PENDING para que otro
--      repartidor oferte — nunca se queda atrapado.
--
-- El pago AL RECIBIR no cambia: no hay nada que verificar por adelantado y
-- sigue pasando directo a ASSIGNED.
--
-- Tres detalles que esta migración cuida a propósito:
--
--   * accepted_at vuelve a significar "la entrega arrancó de verdad": con
--     UPFRONT se escribe al verificar (no al confirmar el cliente), así los
--     dashboards que ordenan por accepted_at no se enteran del paso intermedio.
--   * expire_stale_delivery_offers solo expira ofertas con
--     payment_confirmed_at null, así que un pago confirmado esperando
--     verificación NUNCA expira solo.
--   * cancel_order ahora rechaza cancelar con pago confirmado: antes era una
--     carrera casi imposible (el pedido salía de AWAITING_PAYMENT al instante),
--     pero con la espera intermedia el cliente sí podría cancelar un pedido ya
--     pagado por Yape y dejar al repartidor con dinero movido y sin entrega.
--     El corte ya lo documentaba OrderStatusSection ("lo marca
--     payment_confirmed_at"); la función por fin lo cumple.
--
-- Orden de locks en las funciones nuevas: `orders` PRIMERO y `deliveries`
-- después (igual que select/complete/retract/expire: evita el deadlock AB-BA).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) select_delivery_payment — misma firma (uuid, text, text, text)
-- ----------------------------------------------------------------------------
-- `create or replace`: la firma no cambia, el reemplazo es atómico. El único
-- cambio de comportamiento está en la rama UPFRONT (ver el IF del final): ya
-- no escribe accepted_at ni mueve a ASSIGNED. Todo lo demás —orden de
-- validaciones, errcodes, rama ON_DELIVERY— se conserva literal.
create or replace function public.select_delivery_payment(
  p_order_id uuid,
  p_method text default null,
  p_voucher_path text default null,
  p_timing text default null
)
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
  v_timing text;
  v_allows_on_delivery boolean;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- Derivación de compatibilidad con lo desplegado, AHORA por timing Y por
  -- método: `timing` explícito manda; sin timing, un método legacy 'CASH'
  -- significa "al recibir" y 'YAPE' (o nada) "ahora". La app nueva no manda
  -- método; la desplegada sigue mandándolo y recibe el mismo resultado de ayer.
  if p_timing is null then
    v_timing := case when p_method = 'CASH' then 'ON_DELIVERY' else 'UPFRONT' end;
  else
    v_timing := p_timing;
  end if;

  if v_timing not in ('UPFRONT', 'ON_DELIVERY') then
    raise exception 'Momento de pago inválido'
      using errcode = '22000';
  end if;

  -- Método: solo UPFRONT lo lleva, y siempre es Yape. Se valida ANTES de
  -- escribir para que la compatibilidad legacy no pueda colar un valor
  -- arbitrario; un `p_method` presente con ON_DELIVERY se ACEPTA y se ignora
  -- más abajo ('YAPE' y 'CASH' son los dos valores que la app desplegada manda).
  if p_method is not null and p_method not in ('YAPE', 'CASH') then
    raise exception 'Método de pago inválido'
      using errcode = '22000';
  end if;

  if v_timing = 'UPFRONT' and p_method is not null and p_method <> 'YAPE' then
    raise exception 'El efectivo solo se paga al recibir'
      using errcode = '22000';
  end if;

  -- Con pago al recibir NO hay comprobante: si llegó una ruta, quien llama
  -- todavía está usando el flujo de "pagar ahora" con el timing cambiado. Se
  -- rechaza en vez de ignorarla, para que nadie confirme una promesa con
  -- evidencia de otro paso. Cubre las DOS formas (UPFRONT y ON_DELIVERY) y
  -- reemplaza a la rama `elsif` que antes ataba el comprobante al método.
  if p_voucher_path is not null and v_timing <> 'UPFRONT' then
    raise exception 'El pago al recibir no lleva comprobante'
      using errcode = '22000';
  end if;

  -- Orden de locks: `orders` PRIMERO, igual que complete_delivery,
  -- retract_delivery_offer y expire_stale_delivery_offers (evita el deadlock
  -- AB-BA). `for update of o`: `d` es el lado nullable del LEFT JOIN.
  select o.customer_id, o.status, d.id, d.delivery_fee, d.payment_confirmed_at,
         d.allows_pay_on_delivery
    into v_customer_id, v_status, v_delivery_id, v_fee, v_confirmed_at,
         v_allows_on_delivery
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

  -- (D7) Pagar al recibir obliga al repartidor a ADELANTAR la comida. Si
  -- declaró que no lo hace, la elección no pasa aunque llegue por la API cruda:
  -- el snapshot de la oferta es el contrato, no la preferencia actual de su
  -- perfil.
  if v_timing = 'ON_DELIVERY' and v_allows_on_delivery is not true then
    raise exception 'Este repartidor solo acepta pago por adelantado'
      using errcode = '22000';
  end if;

  -- Las dos validaciones de siempre, sin cambios: ruta canónica de ESTE pedido
  -- + archivo existente en Storage. El navegador sube antes de llamar acá; un
  -- upload fallido en silencio no puede quedar como pago confirmado.
  if v_timing = 'UPFRONT' then
    if p_voucher_path is distinct from p_order_id::text || '/voucher.jpg' then
      raise exception 'Adjunta el comprobante de tu pago para confirmar'
        using errcode = '22000';
    end if;

    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'payment-vouchers'
        and name = p_voucher_path
    ) then
      raise exception 'No encontramos tu comprobante. Vuelve a subirlo e inténtalo de nuevo'
        using errcode = '22000';
    end if;
  end if;

  -- Guarda dura contra dos elecciones simultáneas: la segunda no actualiza
  -- nada. `payment_method` se escribe NULL con ON_DELIVERY aunque llegue un
  -- método legacy — es la decisión central de la migración 20261003100000.
  --
  -- accepted_at SOLO con ON_DELIVERY: con UPFRONT la entrega todavía no
  -- arrancó (falta la verificación del repartidor) y accepted_at lo escribe
  -- verify_upfront_payment.
  update public.deliveries
     set payment_method = case when v_timing = 'UPFRONT' then 'YAPE' end,
         payment_timing = v_timing,
         payment_confirmed_at = now(),
         accepted_at = case when v_timing = 'ON_DELIVERY' then now() else accepted_at end,
         payment_voucher_path = case when v_timing = 'UPFRONT' then p_voucher_path end
   where id = v_delivery_id
     and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  if v_timing = 'ON_DELIVERY' then
    -- Sin nada que verificar por adelantado: la entrega arranca ya.
    update public.orders
       set status = 'ASSIGNED',
           delivery_fee = v_fee,
           payment_method = null,
           payment_timing = v_timing
     where id = p_order_id
       and status = 'AWAITING_PAYMENT';

    if not found then
      raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
        using errcode = '40001';
    end if;
  else
    -- UPFRONT: se guardan los snapshots para que ambas partes vean lo mismo,
    -- pero el pedido se QUEDA en AWAITING_PAYMENT hasta que el repartidor
    -- verifique el comprobante (verify_upfront_payment). Ese es el único
    -- camino a ASSIGNED para un pago por adelantado.
    update public.orders
       set delivery_fee = v_fee,
           payment_method = 'YAPE',
           payment_timing = v_timing
     where id = p_order_id
       and status = 'AWAITING_PAYMENT';

    if not found then
      raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
        using errcode = '40001';
    end if;
  end if;
end;
$$;

revoke all on function public.select_delivery_payment(uuid, text, text, text) from public, anon;
grant execute on function public.select_delivery_payment(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) verify_upfront_payment — el repartidor confirma que el Yape está bien
-- ----------------------------------------------------------------------------
-- Puerta a ASSIGNED para los pagos por adelantado: valida que quien llama sea
-- EL repartidor de la entrega, que el pedido siga esperando verificación y que
-- haya un comprobante confirmado por el cliente. Escribe accepted_at (= "la
-- entrega arrancó de verdad") en la misma transacción que el cambio de estado.
create function public.verify_upfront_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_delivery_id uuid;
  v_person_id uuid;
  v_timing text;
  v_confirmed_at timestamptz;
  v_voucher text;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  select o.status, d.id, d.delivery_person_id, d.payment_timing,
         d.payment_confirmed_at, d.payment_voucher_path
    into v_status, v_delivery_id, v_person_id, v_timing, v_confirmed_at, v_voucher
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id
  for update of o;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  if v_delivery_id is null then
    raise exception 'No hay repartidor asociado a este pedido'
      using errcode = '22000';
  end if;

  if v_person_id is distinct from public.current_profile_id() then
    raise exception 'Este pedido no es tu entrega'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'Este pedido ya no espera verificación de pago'
      using errcode = '22000';
  end if;

  if v_timing is distinct from 'UPFRONT' then
    raise exception 'Este pedido no tiene un pago por Yape que verificar'
      using errcode = '22000';
  end if;

  if v_confirmed_at is null or v_voucher is null then
    raise exception 'El cliente todavía no envió su comprobante'
      using errcode = '22000';
  end if;

  update public.deliveries
     set accepted_at = now()
   where id = v_delivery_id;

  update public.orders
     set status = 'ASSIGNED'
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder verificar el pago'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.verify_upfront_payment(uuid) from public, anon;
grant execute on function public.verify_upfront_payment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3) reject_upfront_payment — el comprobante no corresponde, se libera todo
-- ----------------------------------------------------------------------------
-- Salida del repartidor cuando el Yape NO está bien (monto distinto, captura
-- ajena): borra su oferta y devuelve el pedido a PENDING para que otro
-- repartidor pueda ofertar. Sin esta puerta, un comprobante malo dejaría al
-- repartidor atrapado en una entrega activa que no puede avanzar (y
-- retract_delivery_offer se niega con pago confirmado, con razón: esa es la
-- salida de ANTES de pagar).
--
-- Orden de escritura: primero se borra la entrega y después se devuelve el
-- pedido (igual que releaseActiveDeliveries y expire_stale_delivery_offers:
-- al revés, otro repartidor podría chocar con el UNIQUE(order_id)).
-- Los snapshots de pago se limpian porque la elección murió con la oferta.
create function public.reject_upfront_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_delivery_id uuid;
  v_person_id uuid;
  v_timing text;
  v_confirmed_at timestamptz;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  select o.status, d.id, d.delivery_person_id, d.payment_timing,
         d.payment_confirmed_at
    into v_status, v_delivery_id, v_person_id, v_timing, v_confirmed_at
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id
  for update of o;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  if v_delivery_id is null then
    raise exception 'No hay repartidor asociado a este pedido'
      using errcode = '22000';
  end if;

  if v_person_id is distinct from public.current_profile_id() then
    raise exception 'Este pedido no es tu entrega'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'Este pedido ya no espera verificación de pago'
      using errcode = '22000';
  end if;

  if v_timing is distinct from 'UPFRONT' or v_confirmed_at is null then
    raise exception 'No hay un pago por Yape que rechazar en este pedido'
      using errcode = '22000';
  end if;

  delete from public.deliveries where id = v_delivery_id;

  update public.orders
     set status = 'PENDING',
         delivery_fee = null,
         payment_method = null,
         payment_timing = null
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder rechazar el pago'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.reject_upfront_payment(uuid) from public, anon;
grant execute on function public.reject_upfront_payment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) cancel_order — con pago confirmado ya no se cancela
-- ----------------------------------------------------------------------------
-- La espera intermedia (confirmado pero sin verificar) es nueva: antes, un
-- pedido con pago confirmado salía de AWAITING_PAYMENT al instante y este caso
-- era una carrera imposible. Ahora el cliente SÍ podría cancelar un pedido que
-- ya pagó por Yape, dejando dinero movido sin entrega. La elección es
-- definitiva (D3) y OrderStatusSection ya lo documentaba ("el corte lo marca
-- payment_confirmed_at"): la función por fin lo cumple.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_status   public.order_status;
  v_confirmed_at timestamptz;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select o.customer_id, o.status, d.payment_confirmed_at
    into v_customer, v_status, v_confirmed_at
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id for update of o;

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

  if v_confirmed_at is not null then
    raise exception 'Ya confirmaste el pago de este pedido y no se puede cancelar. Si necesitas ayuda, contacta a soporte.'
      using errcode = '22000';
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
