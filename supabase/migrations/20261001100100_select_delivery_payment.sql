-- ============================================================================
-- PideloYa — select_delivery_payment(uuid, text, text): la confirmación del
-- pago del envío, con método
-- ============================================================================
-- Generaliza `confirm_delivery_payment(uuid, text)`: el cliente ahora decide
-- CÓMO paga (Yape con comprobante, o efectivo al recibir) y la decisión entra
-- por acá. La transición AWAITING_PAYMENT -> ASSIGNED sigue siendo la misma y
-- sigue siendo atómica en dos tablas.
--
-- El cuerpo conserva LITERALMENTE el orden de validaciones y los errcode de la
-- versión vigente (20260930100300): identidad -> existencia -> dueño ->
-- idempotencia -> estado -> repartidor -> tarifa. Ese orden no es estético:
--
--   * La idempotencia va antes del chequeo de estado para que un doble clic o
--     un reintento de red reciba "ya fue confirmado" (23505) y no el genérico
--     "no hay una oferta esperando confirmación" (22000), que le haría pensar
--     al cliente que perdió su pedido.
--   * Identidad y dueño van antes que todo: ni el mensaje de error debe revelar
--     algo de un pedido ajeno.
--
-- (D3) La elección es DEFINITIVA: una vez que el pedido queda ASSIGNED con un
-- método, no hay camino para cambiarlo. Cambiarlo obligaría a reabrir el estado
-- del pedido y a coordinar con el repartidor que ya está en camino.
--
-- El comprobante sigue siendo obligatorio con Yape y sigue siendo inaceptable
-- con efectivo: un `p_voucher_path` adjunto en CASH delata un cliente que quería
-- Yape; no se adivina la intención, se rechaza (el error le dice exactamente qué
-- hacer).
-- ============================================================================

create or replace function public.select_delivery_payment(
  p_order_id uuid,
  p_method text,
  p_voucher_path text default null
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
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- El método se valida acá y no solo con el CHECK: el CHECK protege la fila,
  -- esto le explica al cliente qué pasó. Sin esta guarda, un método inválido
  -- llegaría hasta el UPDATE y saldría como un 23514 sin contexto.
  if p_method is null or p_method not in ('YAPE', 'CASH') then
    raise exception 'Método de pago inválido'
      using errcode = '22000';
  end if;

  -- Orden de locks: `orders` PRIMERO, igual que confirm_delivery_payment,
  -- retract_delivery_offer y expire_stale_delivery_offers. Si una función
  -- bloqueara deliveries y después orders, dos transacciones simultáneas
  -- podrían quedar esperándose en espejo (deadlock AB-BA).
  --
  -- `for update of o`: `d` es el lado nullable del LEFT JOIN y Postgres no
  -- permite bloquearlo; la carrera sobre `deliveries` la cubre el
  -- `payment_confirmed_at is null` del UPDATE + el chequeo de FOUND.
  select o.customer_id, o.status, d.id, d.delivery_fee, d.payment_confirmed_at
    into v_customer_id, v_status, v_delivery_id, v_fee, v_confirmed_at
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

  if p_method = 'YAPE' then
    -- Las dos validaciones de 20260930100300, sin cambios: la ruta tiene que
    -- ser la canónica de ESTE pedido (`is distinct from` cubre NULL y ruta
    -- ajena en un solo predicado) y el archivo tiene que existir de verdad en
    -- Storage — el navegador sube antes de llamar acá, así que un upload que
    -- falló en silencio no puede quedar como un pago "confirmado" sin evidencia.
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
    raise exception 'El pago en efectivo no lleva comprobante'
      using errcode = '22000';
  end if;

  -- El `payment_confirmed_at is null` es la guarda dura contra dos elecciones
  -- simultáneas (dos pestañas, doble clic): la segunda no actualiza nada.
  --
  -- `payment_voucher_path` se escribe con `case`: con CASH queda en NULL por
  -- construcción, que es lo que exige deliveries_voucher_requires_yape_check.
  update public.deliveries
     set payment_method = p_method,
         payment_confirmed_at = now(),
         accepted_at = now(),
         payment_voucher_path = case when p_method = 'YAPE' then p_voucher_path end
   where id = v_delivery_id
     and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  update public.orders
     set status = 'ASSIGNED',
         delivery_fee = v_fee,
         payment_method = p_method
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';

  -- Si el estado cambió entre el SELECT y el UPDATE (el cliente canceló en
  -- paralelo), se levanta un error en vez de dejar el pedido sin avanzar: la
  -- excepción revierte TAMBIÉN el update de deliveries, así que "eligió",
  -- "con comprobante" y "arrancó" nunca quedan a medias.
  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
      using errcode = '40001';
  end if;
end;
$$;

-- Superficie mínima: en Supabase `anon` recibe EXECUTE por privilegios por
-- defecto sobre funciones nuevas del schema public, así que hay que revocarlo
-- explícitamente. Solo `authenticated` puede invocarla (y la función valida
-- identidad y dueño por dentro).
revoke all on function public.select_delivery_payment(uuid, text, text) from public, anon;
grant execute on function public.select_delivery_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- La firma vigente pasa a ser un envoltorio de una línea.
--
-- ¿Por qué no se borra en esta misma migración? Porque el código YA DESPLEGADO
-- la sigue llamando hasta que se despliegue la Fase 2. Y no alcanza con dejar
-- la función vieja como estaba: su cuerpo escribe `payment_voucher_path` sin
-- tocar `payment_method`, y el CHECK
-- `deliveries_voucher_requires_yape_check` que se acaba de agregar rechazaría
-- ese UPDATE — cada confirmación desde la app desplegada empezaría a fallar.
-- Reemplazándola por este envoltorio, ese código sigue funcionando Y además
-- queda con `payment_method = 'YAPE'`, que es lo que siempre fue.
--
-- Es una ventana corta y CERRADA a propósito: se elimina en la migración de
-- cierre (Fase 10), recién cuando ningún código llame a la firma de un
-- argumento. Su rollback verbatim va en esa migración.
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
  select public.select_delivery_payment(p_order_id, 'YAPE', p_voucher_path)
$$;

-- Redundante con la migración anterior (CREATE OR REPLACE conserva el ACL),
-- pero se deja explícito: si alguien reescribe esta función con DROP + CREATE,
-- el revoke del privilegio por defecto de `anon` sigue quedando escrito en el
-- repo y no se descubre el agujero recién en producción.
revoke all on function public.confirm_delivery_payment(uuid, text) from public, anon;
grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;
