-- ============================================================================
-- PideloYa — Eje "cuándo" (payment_timing) y cobro genérico (collected_*)
-- ============================================================================
-- Fase 1 del plan "Pagar al recibir con Yape o Efectivo". Patrón EXPAND:
-- ninguna columna existente se borra ni se renombra; el código desplegado sigue
-- funcionando entre este `db push` y el deploy de las Fases 2–3.
--
-- (D2) "Cuándo paga" pasa a ser un eje independiente del "con qué paga":
--   UPFRONT     = ahora, con comprobante (solo puede ser Yape).
--   ON_DELIVERY = al recibir (Yape o efectivo).
-- Hasta hoy el método tenía ambos significados pegados: CASH implicaba
-- "al recibir" por construcción y Yape solo existía "por adelantado". Con dos
-- columnas la UI reacciona a cada eje por separado y no hace falta un tercer
-- valor compuesto.
--
-- (D4) El cobro al recibir lo DECLARA el repartidor (`collected_method`) y
-- puede diferir de lo que el cliente anunció (`payment_method`): en la puerta
-- dijo "Yape" y paga en efectivo. Registrar el desvío es lo correcto;
-- bloquearlo es fricción inútil. Por eso el CHECK
-- `deliveries_cash_collected_requires_cash_check` SE REEMPLAZA: ataba el cobro
-- a payment_method = 'CASH', y ahora el anuncio y el cobro real son datos
-- independientes (auditable por el admin).
-- ============================================================================

alter table public.deliveries
  add column if not exists payment_timing text,
  add column if not exists collected_at timestamptz,
  add column if not exists collected_method text,
  add column if not exists allows_pay_on_delivery boolean not null default true;

alter table public.orders
  add column if not exists payment_timing text,
  add column if not exists restaurant_paid_at timestamptz;

-- ---------------------------------------------------------------------------
-- Backfill ANTES de los constraints (mismo criterio que 20261001100000): toda
-- elección ya hecha es coherente con la semántica vieja — Yape era siempre
-- "por adelantado" y efectivo siempre "al recibir".
-- ---------------------------------------------------------------------------
update public.deliveries
   set payment_timing =
     case payment_method when 'YAPE' then 'UPFRONT' when 'CASH' then 'ON_DELIVERY' end
 where payment_method is not null
   and payment_timing is null;

update public.orders o
   set payment_timing = d.payment_timing
  from public.deliveries d
 where d.order_id = o.id
   and d.payment_timing is not null
   and o.payment_timing is null;

-- El cobro en efectivo ya registrado pasa al campo genérico (dual-write:
-- `cash_collected_at` se CONSERVA durante toda la transición; complete_delivery
-- sigue escribiéndolo y se elimina recién en la Fase 12 contract).
update public.deliveries
   set collected_at = cash_collected_at,
       collected_method = 'CASH'
 where cash_collected_at is not null
   and collected_at is null;

-- ---------------------------------------------------------------------------
-- Invariantes. La base (schema-constraints de la skill de Postgres) no admite
-- `add constraint if not exists`, así que se hace drop-if-exists + add: son
-- migraciones lineales, no re-ejecutables a mano.
-- ---------------------------------------------------------------------------

-- El dominio del eje nuevo, en ambas tablas (snapshot en orders, mismo criterio
-- que payment_method: sobrevive al borrado de la fila de deliveries).
alter table public.deliveries drop constraint if exists deliveries_payment_timing_check;
alter table public.deliveries add constraint deliveries_payment_timing_check
  check (payment_timing is null or payment_timing in ('UPFRONT', 'ON_DELIVERY'));

alter table public.orders drop constraint if exists orders_payment_timing_check;
alter table public.orders add constraint orders_payment_timing_check
  check (payment_timing is null or payment_timing in ('UPFRONT', 'ON_DELIVERY'));

-- El efectivo solo existe "al recibir" — nunca hay una transferencia previa que
-- documentar con billetes.
alter table public.deliveries drop constraint if exists deliveries_cash_is_on_delivery_check;
alter table public.deliveries add constraint deliveries_cash_is_on_delivery_check
  check (payment_method is distinct from 'CASH' or payment_timing = 'ON_DELIVERY');

-- Método y timing viajan juntos o ninguno: evita filas a medias donde el
-- cliente eligió pero no se sabe cuándo paga.
alter table public.deliveries drop constraint if exists deliveries_method_timing_pair_check;
alter table public.deliveries add constraint deliveries_method_timing_pair_check
  check ((payment_method is null) = (payment_timing is null));

-- El comprobante SOLO tiene sentido con Yape por adelantado. REEMPLAZA a
-- deliveries_voucher_requires_yape_check (que solo exigía Yape): con Yape al
-- recibir no hay comprobante del cliente — en la puerta lo que existe es la app
-- de Yape del repartidor (D5), no una captura previa.
alter table public.deliveries drop constraint if exists deliveries_voucher_requires_yape_check;
alter table public.deliveries add constraint deliveries_voucher_requires_upfront_yape_check
  check (
    payment_voucher_path is null
    or (payment_method = 'YAPE' and payment_timing = 'UPFRONT')
  );

-- (D4) El cobro al recibir se registra con un medio válido INDEPENDIENTEMENTE
-- de lo anunciado. Reemplaza a deliveries_cash_collected_requires_cash_check.
alter table public.deliveries drop constraint if exists deliveries_cash_collected_requires_cash_check;
alter table public.deliveries drop constraint if exists deliveries_collected_check;
alter table public.deliveries add constraint deliveries_collected_check
  check (
    collected_at is null
    or (payment_timing = 'ON_DELIVERY' and collected_method in ('YAPE', 'CASH'))
  );

-- La pareja collected_at/collected_method se escribe junta o no se escribe.
alter table public.deliveries drop constraint if exists deliveries_collected_pair_check;
alter table public.deliveries add constraint deliveries_collected_pair_check
  check ((collected_at is null) = (collected_method is null));

-- ---------------------------------------------------------------------------
-- Comentarios de columna: documentan la semántica QUE NO SE VE en el tipo.
-- ---------------------------------------------------------------------------

comment on column public.deliveries.payment_timing is
  'Cuándo paga el cliente: UPFRONT (ahora, con comprobante) u ON_DELIVERY (al recibir). NULL en las entregas legacy sin oferta. Viaja en pareja con payment_method (CHECK deliveries_method_timing_pair_check).';

comment on column public.deliveries.collected_method is
  'Lo que el repartidor DECLARÓ haber recibido al entregar (YAPE|CASH). Puede diferir de payment_method, que es lo que el cliente ANUNCIÓ: el desvío es válido y auditable. La escribe complete_delivery().';

comment on column public.deliveries.collected_at is
  'Cuándo el repartidor confirmó el cobro al entregar (monto = orders.total + orders.delivery_fee, siempre comida + envío). Solo con payment_timing = ON_DELIVERY. Durante la transición también se llena cash_collected_at cuando el medio es efectivo (dual-write hasta la Fase 12).';

comment on column public.deliveries.allows_pay_on_delivery is
  'Snapshot (D7) al enviar la oferta: si el repartidor acepta cobrar al recibir, adelantando la comida de su dinero. False => el cliente solo puede pagar por adelantado, aunque luego cambie su perfil.';

comment on column public.orders.payment_timing is
  'Snapshot de deliveries.payment_timing al confirmar el pago. Sobrevive a la fila de deliveries (ON DELETE SET NULL), igual que payment_method y delivery_fee.';

comment on column public.orders.restaurant_paid_at is
  'Constancia (D6) de que el repartidor declaró haberle pagado la comida al restaurante al recoger el pedido. Vive en orders y no en deliveries a propósito: la policy orders_select_restaurant_readonly ya le da al restaurante lectura de sus pedidos, sin abrir nada de deliveries. La escribe pickup_delivery(); idempotente (reintentar no reescribe la evidencia).';

comment on column public.deliveries.cash_collected_at is
  'DEPRECADO en datos nuevos (conservado para la app desplegada hasta la Fase 12): ver collected_at/collected_method. Los writes nuevos los hacen complete_delivery() por dual-write cuando el medio cobrado es efectivo.';
