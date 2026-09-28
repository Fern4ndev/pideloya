-- ============================================================================
-- PideloYa — confirm_delivery_payment(uuid, text): la confirmación exige el
-- comprobante
-- ============================================================================
-- Sobrecarga de la función de 20260928100200 que además recibe y guarda la ruta
-- del comprobante de Yape. El cuerpo es IDÉNTICO a la versión vigente (mismo
-- orden de validaciones, mismos errcode, mismo bloqueo, misma guarda de
-- idempotencia, mismos `if not found`) más tres cambios marcados abajo como
-- (1), (2) y (3). Cualquier otro ajuste del cuerpo tendría que ser una decisión
-- explícita, no un efecto colateral de este cambio.
--
-- ¿Por qué el comprobante es OBLIGATORIO?
--   El aviso "no verificamos el pago automáticamente" se elimina de la UI en la
--   Fase 4 (a pedido del usuario, y con razón: competía con la tarea real). Sin
--   ese aviso, y sin pasarela integrada, el botón "Ya pagué" era una declaración
--   sin ningún respaldo para el repartidor, que es la parte que arriesga: él
--   entrega la comida y cobra por Yape, fuera de la plataforma. El comprobante
--   no VERIFICA el pago (no hay forma de verificarlo sin integración bancaria),
--   pero convierte una afirmación en una evidencia que el repartidor puede
--   contrastar. Si algún día se decide que NO sea obligatorio, se quitan la
--   validación (1) y el `disabled` del botón; son dos líneas.
--
-- ¿Por qué sobrecarga y no reemplazo?
--   La función de un argumento sigue existiendo para que el código desplegado
--   no se rompa durante la ventana de migración. Esa convivencia tiene un costo
--   consciente: mientras la versión vieja exista, se puede confirmar sin
--   comprobante. Es una ventana corta y CERRADA a propósito por la migración de
--   la Fase 9.3 (drop de la firma vieja), que se aplica recién cuando ningún
--   código la llama.
--
-- ¿Por qué el servidor calcula la ruta y no el navegador?
--   La ruta se deriva del order_id (paymentVoucherPath en
--   lib/constants/payment-voucher.ts), nunca se acepta como dato del cliente.
--   La función la vuelve a validar igual (defensa en profundidad) contra el
--   formato único `{order_id}/voucher.jpg`: si llegara de otro lado, se rechaza.
-- ============================================================================

create or replace function public.confirm_delivery_payment(
  p_order_id uuid,
  p_voucher_path text
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

  -- FOR UPDATE OF o: bloquea la fila del pedido durante la transición para que
  -- dos confirmaciones simultáneas no puedan intercalarse. `d` es el lado
  -- nullable del LEFT JOIN y Postgres no permite `for update` sobre él; la
  -- carrera sobre `deliveries` la cubre el `payment_confirmed_at is null` del
  -- UPDATE + el chequeo de FOUND.
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

  -- La idempotencia va ANTES del chequeo de estado para que un doble clic o un
  -- reintento de red reciba "ya fue confirmado" y no el genérico "no hay una
  -- oferta esperando confirmación" (que le haría pensar que perdió su pedido).
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

  -- --------------------------------------------------------------------------
  -- (1) El comprobante es obligatorio y solo puede ser el de ESTE pedido.
  --
  -- `is distinct from` y no `<>` por el mismo motivo que las comparaciones de
  -- identidad de esta función: con `<>`, un p_voucher_path NULL devuelve NULL y
  -- el IF no se dispara — la confirmación pasaría sin comprobante, que es
  -- exactamente lo que D1 quiere evitar. Un solo predicado cubre los dos casos
  -- (NULL y ruta ajena) porque la ruta válida es única y está determinada.
  -- --------------------------------------------------------------------------
  if p_voucher_path is distinct from p_order_id::text || '/voucher.jpg' then
    raise exception 'Adjunta el comprobante de tu pago para confirmar'
      using errcode = '22000';
  end if;

  -- --------------------------------------------------------------------------
  -- (2) Y tiene que existir de verdad en Storage.
  --
  -- Evita confirmar apuntando a un archivo que nunca se subió (el navegador
  -- sube primero y recién después llama acá, así que un fallo silencioso del
  -- upload dejaría un pedido "pagado" sin ninguna evidencia). Es lo que
  -- convierte el comprobante en una garantía de la BASE y no solo de la UI.
  --
  -- Sobre la RLS de storage.objects en este SELECT: `auth.uid()` y por lo tanto
  -- current_profile_id() SE CONSERVAN dentro de una función SECURITY DEFINER, así
  -- que payment_vouchers_select_parties da verdadero justo para el cliente dueño
  -- del pedido. Es decir, tanto si el rol definer salta la RLS de storage (tabla
  -- de supabase_storage_admin) como si la evalúa, el resultado es el que
  -- queremos: "el archivo existe Y quien confirma tiene derecho a verlo".
  --
  -- La lectura no puede llegar "temprano": la API de Storage responde 200 recién
  -- después de insertar la fila en storage.objects, y el navegador sube antes de
  -- llamar acá.
  -- --------------------------------------------------------------------------
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'payment-vouchers'
      and name = p_voucher_path
  ) then
    raise exception 'No encontramos tu comprobante. Vuelve a subirlo e inténtalo de nuevo'
      using errcode = '22000';
  end if;

  -- --------------------------------------------------------------------------
  -- (3) Se guarda EN LA MISMA TRANSACCIÓN que la confirmación.
  --
  -- No hay un UPDATE suelto después: si el pedido cambia de estado entre medio
  -- (el `if not found` de abajo), la excepción revierte también esto, así que
  -- nunca queda un pedido sin confirmar apuntando a un comprobante. El
  -- `payment_confirmed_at is null` sigue siendo la guarda dura contra dos
  -- confirmaciones simultáneas.
  -- --------------------------------------------------------------------------
  update public.deliveries
  set payment_confirmed_at = now(),
      accepted_at = now(),
      payment_voucher_path = p_voucher_path
  where id = v_delivery_id
    and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado'
      using errcode = '23505';
  end if;

  update public.orders
  set status = 'ASSIGNED',
      delivery_fee = v_fee
  where id = p_order_id
    and status = 'AWAITING_PAYMENT';

  -- Si el estado cambió entre el SELECT y el UPDATE (cancelación del cliente en
  -- paralelo), se levanta un error en vez de dejar el pedido sin avanzar: la
  -- excepción revierte TAMBIÉN el update de deliveries, así que "confirmado",
  -- "con comprobante" y "arrancado" nunca quedan a medias.
  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago'
      using errcode = '40001';
  end if;
end;
$$;

-- Superficie mínima, igual que la versión de un argumento: en Supabase `anon`
-- recibe EXECUTE por privilegios por defecto sobre funciones nuevas del schema
-- public, así que hay que revocarlo explícitamente. Solo `authenticated` puede
-- invocarla (la función valida identidad y dueño por dentro).
revoke all on function public.confirm_delivery_payment(uuid, text) from public, anon;
grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;
