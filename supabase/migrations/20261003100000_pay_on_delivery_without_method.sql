-- ============================================================================
-- PideloYa — "Pagar al recibir" sin método: una sola decisión de dos opciones
-- ============================================================================
-- El cliente elegía DOS cosas para pagar al recibir: cuándo (ahora / al
-- recibir) y con qué (Yape / efectivo). El segundo eje era una promesa que el
-- repartidor volvía a declarar en la puerta, y el sistema comparaba una contra
-- otra (`mismatch` en admin). Nadie usaba ese dato para nada: el repartidor
-- cobra con lo que el cliente le entregue.
--
-- Desde acá la elección es de UN nivel — `Pagar ahora` (UPFRONT, Yape +
-- comprobante) o `Pagar al recibir` (ON_DELIVERY) — y con ON_DELIVERY
-- `payment_method` queda NULL: guardar un método que nadie eligió sería
-- inventar un dato.
--
-- Patrón EXPAND: esta migración solo RELAJA reglas. Todo lo desplegado hoy
-- sigue funcionando:
--   * Las firmas de select_delivery_payment y complete_delivery son las MISMAS
--     (el cuarto parámetro nuevo de la primera tiene default null).
--   * Con ON_DELIVERY se ACEPTA un `p_method` legacy ('CASH' o 'YAPE') y se
--     ignora al escribir: la app desplegada sigue confirmando igual.
--   * Los parámetros de cobro de complete_delivery se aceptan y se ignoran.
--   * No hay backfill: las filas históricas (método + ON_DELIVERY) cumplen las
--     reglas nuevas por construcción.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Constraints de `deliveries`
-- ----------------------------------------------------------------------------

-- "Al recibir" ya no lleva método. El par viajaba junto o ninguno
-- (deliveries_method_timing_pair_check) porque el segundo eje lo exigía; con el
-- eje retirado, ON_DELIVERY + método NULL es el caso NORMAL y no una fila a
-- medias. Las filas legacy (YAPE/CASH + ON_DELIVERY) siguen siendo válidas.
alter table public.deliveries drop constraint if exists deliveries_method_timing_pair_check;
alter table public.deliveries add constraint deliveries_timing_method_check check (
  (payment_timing is null and payment_method is null)
  or (payment_timing = 'UPFRONT' and payment_method = 'YAPE')
  or (payment_timing = 'ON_DELIVERY')  -- método NULL (nuevo) o legacy (YAPE|CASH)
);

-- `collected_at` pasa a significar "el repartidor finalizó la entrega con
-- cobro": ya no depende de que haya declarado un medio. `collected_method`
-- queda como dato OPCIONAL (solo lo escriben las entregas legacy /
-- `complete_delivery` en su camino viejo), así que se acota su dominio en un
-- CHECK propio en vez de atarlo a la pareja.
alter table public.deliveries drop constraint if exists deliveries_collected_pair_check;
alter table public.deliveries drop constraint if exists deliveries_collected_check;
alter table public.deliveries add constraint deliveries_collected_check check (
  collected_at is null or payment_timing = 'ON_DELIVERY'
);
alter table public.deliveries add constraint deliveries_collected_method_check check (
  collected_method is null or collected_method in ('YAPE', 'CASH')
);

-- El comprobante solo existe con pago POR ADELANTADO (que es siempre Yape). La
-- regla anterior (`payment_voucher_path is null or (payment_method = 'YAPE' and
-- payment_timing = 'UPFRONT')`) ataba la ruta al MÉTODO, y ahora una fila
-- UPFRONT sigue cumpliéndola — pero con ON_DELIVERY el método es NULL y la
-- definición quedaba diciendo más de lo necesario. Se expresa la regla real:
-- el único eje que importa para el comprobante es el momento.
--
-- Seguro sobre el histórico: `payment_voucher_path` solo la escribía
-- select_delivery_payment, y solo en su rama UPFRONT+YAPE, así que toda fila
-- con ruta tiene timing UPFRONT (backfill de 20261002100000).
alter table public.deliveries drop constraint if exists deliveries_voucher_requires_upfront_yape_check;
alter table public.deliveries add constraint deliveries_voucher_requires_upfront_check
  check (payment_voucher_path is null or payment_timing = 'UPFRONT');

comment on column public.deliveries.payment_timing is
  'Cuándo paga el cliente: UPFRONT (ahora, Yape + comprobante) u ON_DELIVERY (al recibir). NULL en las entregas legacy sin oferta. Con ON_DELIVERY payment_method es NULL: el método ya no se pregunta (CHECK deliveries_timing_method_check).';

comment on column public.deliveries.collected_method is
  'LEGACY/opcional: medio del cobro declarado por el repartidor. Desde el pago al recibir sin método, complete_delivery() ya no lo escribe: collected_at es la constancia de "finalizó con cobro" y el medio no se pregunta.';

comment on column public.deliveries.collected_at is
  'Cuándo el repartidor finalizó la entrega con cobro (monto = orders.total + orders.delivery_fee). Solo con payment_timing = ON_DELIVERY.';

comment on column public.deliveries.cash_collected_at is
  'DEPRECADO (conservado para la app desplegada hasta la migración contract): complete_delivery() ya NO lo escribe; ver collected_at.';

-- ----------------------------------------------------------------------------
-- 2) select_delivery_payment — misma firma (uuid, text, text, text)
-- ----------------------------------------------------------------------------
-- `create or replace` y no DROP+CREATE: la firma no cambia, así que el
-- reemplazo es atómico por sí solo y no hay ventana sin función. El orden de
-- validaciones y los errcode se conservan LITERALMENTE (identidad -> timing ->
-- existencia -> dueño -> idempotencia -> estado -> repartidor -> tarifa ->
-- específicas): quien llama no puede notar un cambio salvo por los dos que se
-- buscan (ON_DELIVERY ya no exige ni guarda método).
create or replace function public.select_delivery_payment(
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

-- ----------------------------------------------------------------------------
-- 3) complete_delivery — misma firma (uuid, boolean, text)
-- ----------------------------------------------------------------------------
-- `create or replace` (la firma no cambia). Se ELIMINA la guarda 22000 "Confirma
-- que cobraste…": finalizar la entrega vuelve a ser un toque, y `collected_at`
-- pasa a ser la constancia de que se finalizó CON cobro. Los parámetros
-- `p_cash_collected` / `p_collected_method` se ACEPTAN y se IGNORAN: la app
-- desplegada los sigue mandando y no puede recibir un error por ello.
create or replace function public.complete_delivery(
  p_order_id uuid,
  p_cash_collected boolean default false,
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

  -- Pertenencia por la FILA de la entrega (más fuerte que el rol): la misma
  -- comprobación que hace la Server Action con
  -- .eq('delivery_person_id', profileId).
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

  -- `collected_at` = "finalizó la entrega con cobro", sin medio: con
  -- ON_DELIVERY se escribe SIEMPRE, sin flags. En UPFRONT (y en las entregas
  -- legacy sin timing) el dinero ya se movió por adelantado y no hay cobro que
  -- registrar — escribirlo chocaría con deliveries_collected_check.
  --
  -- `collected_method` se escribe NULL: el método ya no se pregunta (misma
  -- decisión que select_delivery_payment). El dual-write a cash_collected_at
  -- también se retira: sin medio que registrar, la columna deprecada dejaba de
  -- tener fuente.
  update public.deliveries
     set delivered_at = now(),
         collected_at = case when v_timing = 'ON_DELIVERY' then now() end,
         collected_method = null
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

revoke all on function public.complete_delivery(uuid, boolean, text) from public, anon;
grant execute on function public.complete_delivery(uuid, boolean, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) El envoltorio de compatibilidad no cambia: confirm_delivery_payment()
--    sigue delegando con ('YAPE', voucher, 'UPFRONT') y su camino es idéntico.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- ROLLBACK (solo si hay que revertir el despliegue después de aplicar esto).
-- OJO: NO se puede reponer deliveries_method_timing_pair_check si ya existen
-- pedidos con ON_DELIVERY y método NULL — la migración fallaría. El rollback es
-- de código, no de datos.
--
-- begin;
--
-- alter table public.deliveries drop constraint if exists deliveries_timing_method_check;
-- alter table public.deliveries drop constraint if exists deliveries_collected_check;
-- alter table public.deliveries drop constraint if exists deliveries_collected_method_check;
-- alter table public.deliveries add constraint deliveries_method_timing_pair_check
--   check ((payment_method is null) = (payment_timing is null));
-- alter table public.deliveries add constraint deliveries_collected_check
--   check (
--     collected_at is null
--     or (payment_timing = 'ON_DELIVERY' and collected_method in ('YAPE', 'CASH'))
--   );
-- alter table public.deliveries add constraint deliveries_collected_pair_check
--   check ((collected_at is null) = (collected_method is null));
--
-- -- Y los cuerpos verbatim de 20261002100100 / 20261002100200 (ver el doc
-- -- docs/db-contract/20261002100600_drop_legacy_payment_columns.sql).
--
-- commit;
-- ============================================================================
