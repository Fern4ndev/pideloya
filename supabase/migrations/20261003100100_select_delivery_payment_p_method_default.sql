-- ============================================================================
-- PideloYa — hotfix: `p_method` sin default en select_delivery_payment
-- ============================================================================
-- La migración 20261003100000 reemplazó el cuerpo de select_delivery_payment
-- pero dejó `p_method` SIN default. Con una sola firma vigente (la v2,
-- 20261002100100, ya dropeó la de 3 args), PostgREST no puede resolver la
-- forma NUEVA de la llamada {p_order_id, p_timing}: casa los argumentos
-- nombrados con LA firma y le falta `p_method`, que es obligatorio. Error
-- observable:
--   "Could not find the function public.select_delivery_payment(p_order_id,
--    p_timing) in the schema cache" (PGRST203).
--
-- El plan (Fase 1.2) ya pedía `p_method text default null`: agregar un default
-- está permitido y desambigua TODAS las formas — {order, timing}, {order,
-- method, voucher} (app desplegada), {order, method, timing}, {order}. El
-- cuerpo es VERBATIM el de 20261003100000: solo cambia la línea del parámetro.
--
-- Verificado tras aplicar: {order, timing}, {order, method}, {order, method,
-- voucher}, {order} y las dos formas de complete_delivery y del envoltorio
-- resuelven (P0002 con un uuid inexistente), y la forma de 3 nombres de la app
-- desplegada elige su firma exacta — Postgres prefiere menos defaults, así que
-- no hay ambigüedad (42702).
-- ============================================================================

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
  -- método legacy — es la decisión central de esta migración.
  update public.deliveries
     set payment_method = case when v_timing = 'UPFRONT' then 'YAPE' end,
         payment_timing = v_timing,
         payment_confirmed_at = now(),
         accepted_at = now(),
         payment_voucher_path = case when v_timing = 'UPFRONT' then p_voucher_path end
   where id = v_delivery_id
     and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  update public.orders
     set status = 'ASSIGNED',
         delivery_fee = v_fee,
         payment_method = case when v_timing = 'UPFRONT' then 'YAPE' end,
         payment_timing = v_timing
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.select_delivery_payment(uuid, text, text, text) from public, anon;
grant execute on function public.select_delivery_payment(uuid, text, text, text) to authenticated;
