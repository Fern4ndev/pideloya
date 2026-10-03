-- ============================================================================
-- PideloYa — select_delivery_payment v2: cuarto parámetro p_timing
-- ============================================================================
-- (D2) El cliente ahora decide DOS cosas: cuándo paga (UPFRONT | ON_DELIVERY)
-- y con qué (YAPE | CASH). Las combinaciones válidas:
--
--   YAPE  + UPFRONT     = hoy: comprobante OBLIGATORIO y existente en Storage.
--   YAPE  + ON_DELIVERY = NUEVO: sin comprobante (D5); exige
--                         allows_pay_on_delivery (D7).
--   CASH  + ON_DELIVERY = hoy (+ exige allows_pay_on_delivery).
--   CASH  + UPFRONT     = rechazado: el efectivo no viaja en el tiempo.
--
-- ¿DROP + CREATE y no CREATE OR REPLACE? Porque la firma cambia: un OR REPLACE
-- con otra firma dejaría DOS funciones con el mismo nombre (sobrecarga) y cada
-- llamada resolvería contra la ambigua. El DROP y el CREATE viven en la MISMA
-- transacción de la migración: no hay ni un instante sin función.
--
-- Compatibilidad con el código YA DESPLEGADO: p_timing tiene DEFAULT null y el
-- cuerpo lo DERIVA del método (YAPE -> UPFRONT, CASH -> ON_DELIVERY), así que
-- las llamadas de tres argumentos producen exactamente lo mismo que ayer. El
-- envoltorio confirm_delivery_payment(uuid, text) sigue delegando con
-- ('YAPE', voucher, 'UPFRONT').
--
-- El cuerpo conserva LITERALMENTE el orden de validaciones y los errcode de la
-- versión vigente (20261001100100): identidad -> método/timing válidos ->
-- existencia -> dueño -> idempotencia -> estado -> repartidor -> tarifa ->
-- específicas. La idempotencia sigue ANTES del chequeo de estado para que un
-- doble clic reciba "ya fue confirmado" (23505) y no el genérico 22000.
-- ============================================================================

drop function if exists public.select_delivery_payment(uuid, text, text);

create function public.select_delivery_payment(
  p_order_id uuid,
  p_method text,
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

  if p_method is null or p_method not in ('YAPE', 'CASH') then
    raise exception 'Método de pago inválido'
      using errcode = '22000';
  end if;

  -- Derivación de compatibilidad: el código desplegado no manda timing y su
  -- semántica vieja ES la derivación (Yape siempre era "ahora", efectivo
  -- siempre "al recibir"). Un timing explícito se valida tal cual.
  if p_timing is null then
    v_timing := case p_method when 'YAPE' then 'UPFRONT' else 'ON_DELIVERY' end;
  elsif p_timing not in ('UPFRONT', 'ON_DELIVERY') then
    raise exception 'Momento de pago inválido'
      using errcode = '22000';
  else
    v_timing := p_timing;
  end if;

  -- Los dos cruces imposibles, con mensajes que dicen qué hacer y no qué
  -- números violó:
  if p_method = 'CASH' and v_timing = 'UPFRONT' then
    raise exception 'El efectivo solo se paga al recibir'
      using errcode = '22000';
  end if;

  -- (D5) Con Yape al recibir NO hay comprobante: si llegó una ruta, quien llama
  -- todavía está usando el flujo de "pagar ahora". Se rechaza en vez de
  -- ignorarla, para que nadie confirme una promesa con evidencia de otro paso.
  if p_method = 'YAPE' and v_timing = 'ON_DELIVERY' and p_voucher_path is not null then
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

  if p_method = 'YAPE' and v_timing = 'UPFRONT' then
    -- Las dos validaciones de siempre, sin cambios: ruta canónica de ESTE
    -- pedido + archivo existente en Storage. El navegador sube antes de llamar
    -- acá; un upload fallido en silencio no puede quedar como pago confirmado.
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
  elsif p_voucher_path is not null then
    -- Efectivo por adelantado ya se rechazó arriba; aquí caen CASH+ON_DELIVERY
    -- con ruta (no hay transferencia que documentar) y cualquier Yape con ruta
    -- que no pasó la validación de arriba.
    raise exception 'El pago en efectivo no lleva comprobante'
      using errcode = '22000';
  end if;

  -- Guarda dura contra dos elecciones simultáneas: la segunda no actualiza
  -- nada. `payment_voucher_path` con `case`: solo Yape por adelantado puede
  -- tener ruta, que es lo que exige el CHECK
  -- deliveries_voucher_requires_upfront_yape_check.
  update public.deliveries
     set payment_method = p_method,
         payment_timing = v_timing,
         payment_confirmed_at = now(),
         accepted_at = now(),
         payment_voucher_path = case
           when p_method = 'YAPE' and v_timing = 'UPFRONT' then p_voucher_path
         end
   where id = v_delivery_id
     and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  update public.orders
     set status = 'ASSIGNED',
         delivery_fee = v_fee,
         payment_method = p_method,
         payment_timing = v_timing
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
      using errcode = '40001';
  end if;
end;
$$;

-- Superficie mínima (revoke explícito aunque el DROP+CREATE resetee ACLs: si
-- alguien reescribe esto con CREATE OR REPLACE, el revoke queda escrito en el
-- repo y el agujero no se descubre en producción).
revoke all on function public.select_delivery_payment(uuid, text, text, text) from public, anon;
grant execute on function public.select_delivery_payment(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- El envoltorio vigente pasa a delegar con el timing explícito. Mismo motivo
-- que 20261001100100: el código desplegado lo llama hasta que salga la Fase 2;
-- ventana CERRADA a propósito, se elimina en la migración de cierre (Fase 12).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_delivery_payment(
  p_order_id uuid,
  p_voucher_path text
)
returns void
language sql
security definer
set search_path = public
as $$
  select public.select_delivery_payment(p_order_id, 'YAPE', p_voucher_path, 'UPFRONT')
$$;

revoke all on function public.confirm_delivery_payment(uuid, text) from public, anon;
grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;
