-- ============================================================================
-- PideloYa — Columnas de la oferta de envío y su confirmación de pago
-- ============================================================================
-- Introduce el envío como concepto económico propio, separado del subtotal
-- de comida:
--
--   orders.total          = subtotal de comida (lo cobra el restaurante).
--   deliveries.delivery_fee = tarifa de envío que cobra el repartidor por Yape.
--   orders.delivery_fee     = snapshot de esa tarifa, escrito UNA vez por
--                             confirm_delivery_payment() (20260928100200)
--                             cuando el cliente confirma el pago.
--
-- ¿Por qué el envío NO se suma a orders.total? Porque son dos ingresos de
-- dueños distintos (restaurante vs. repartidor) y orders.total ya lo usan los
-- dashboards de restaurante y admin como "ventas del negocio". Mezclarlos
-- haría que un restaurante reportara como suyo el dinero del repartidor y no
-- habría forma de deshacerlo sin perder el histórico. Es el mismo principio
-- de snapshots que ya rige order_items.product_name / restaurant_name /
-- image_url: cada dato vive en su columna, con un solo significado.
--
-- ¿Por qué orders.delivery_fee (duplicado del de deliveries) y no un join?
-- Porque deliveries.delivery_person_id es ON DELETE SET NULL: si se borrara el
-- repartidor, la fila de deliveries se queda sin dueño y con ella la tarifa
-- cobrada. El snapshot sobrevive al repartidor, igual que customer_name
-- sobrevive al cliente (20260926000000_orders_customer_snapshot.sql).
--
-- ¿Por qué offered_at si accepted_at ya existía? Cambio de significado, no de
-- columna (evita romper lo que ya lee accepted_at):
--   - offered_at           = cuándo el repartidor propuso la tarifa.
--   - payment_confirmed_at = cuándo el cliente confirmó haber pagado (Yape).
--   - accepted_at          = cuándo arrancó la entrega de verdad (= el momento
--                            en que el cliente confirmó el pago). Los
--                            dashboards que ya ordenan/filtran por accepted_at
--                            (DeliveryHistoryTable, DeliveryDashboardCards)
--                            siguen siendo correctos sin cambios: ese instante
--                            sigue siendo "el trabajo real empezó".
--
-- Todo es aditivo y nullable: sin backfill, sin rewrite de tabla, sin
-- bloqueos largos. NULL es el estado correcto para "todavía no hay oferta".
-- Los pedidos y entregas anteriores a este cambio no tienen tarifa de envío y
-- así quedan (no se puede inventar retroactivamente un precio que nunca se
-- cobró — ver Fase 7 del plan).
-- ============================================================================

alter table public.deliveries
  add column if not exists delivery_fee numeric(10,2),
  add column if not exists offered_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz;

alter table public.orders
  add column if not exists delivery_fee numeric(10,2);

-- Defensa en profundidad para una columna de dinero: la validación de rango
-- (S/ 1 a S/ 30) vive en Zod del lado del servidor (Fase 2 del plan), pero una
-- restricción de base de datos es lo único que garantiza que NUNCA se
-- persista una tarifa negativa, sin importar qué camino escriba la fila
-- (Server Action, API v1, o psql a mano). Se usa `> 0` y no `>= 1` a
-- propósito: el rango de producto (mínimo S/ 1) es una regla de negocio
-- editable en una línea de Zod, mientras que "el envío no puede ser negativo"
-- es una invariante de datos que no debería cambiar.
alter table public.deliveries
  drop constraint if exists deliveries_delivery_fee_check;
alter table public.deliveries
  add constraint deliveries_delivery_fee_check
  check (delivery_fee is null or delivery_fee > 0);

alter table public.orders
  drop constraint if exists orders_delivery_fee_check;
alter table public.orders
  add constraint orders_delivery_fee_check
  check (delivery_fee is null or delivery_fee > 0);

comment on column public.deliveries.delivery_fee is
  'Tarifa de envío (S/) que el repartidor propuso al ofertar el pedido. Editable por él mientras payment_confirmed_at sea NULL.';

comment on column public.deliveries.offered_at is
  'Cuándo el repartidor propuso la tarifa. Antes de este cambio, accepted_at marcaba este momento; ahora accepted_at marca cuándo el CLIENTE confirmó el pago y el envío arranca de verdad — los dashboards que ya ordenan/filtran por accepted_at (DeliveryHistoryTable, DeliveryDashboardCards) no necesitan cambios porque ese instante sigue siendo "el trabajo real empezó".';

comment on column public.deliveries.payment_confirmed_at is
  'Cuándo el cliente confirmó (de buena fe) haber pagado por Yape. No hay pasarela de pago integrada: es una confirmación manual del cliente, no una verificación bancaria. NULL = todavía no confirmó.';

comment on column public.orders.delivery_fee is
  'Snapshot de deliveries.delivery_fee una vez el cliente confirma el pago (lo escribe confirm_delivery_payment(), ver 20260928100200). NULL mientras el pedido está PENDING o AWAITING_PAYMENT sin confirmar. Nunca se suma a orders.total: son dos ingresos de dueños distintos (restaurante vs. repartidor).';
