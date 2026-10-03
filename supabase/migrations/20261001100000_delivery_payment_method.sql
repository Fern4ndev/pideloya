-- ============================================================================
-- PideloYa — Método de pago del envío (YAPE | CASH)
-- ============================================================================
-- Hasta acá el pago del envío tenía UN solo camino: Yape + comprobante. Esta
-- migración abre el segundo —efectivo al recibir— sin tocar nada del primero.
--
-- (D1, decisión del producto) Con CASH el cliente le paga al repartidor TODO el
-- pedido: la comida (orders.total) más el envío (orders.delivery_fee). El modelo
-- de datos es el mismo — los dos montos ya existen y son del mismo dueño en el
-- momento de la entrega — así que lo único que cambia es el COPY y el monto que
-- la UI suma al mostrar "le pagarás S/ X al recibir". No se agrega ninguna
-- columna de monto cobrado: se deriva de `total + delivery_fee`, que son
-- snapshots y no cambian después de confirmar.
--
-- (D4) `text` + CHECK y no enum: el dominio va a crecer (Plin, tarjeta) y
-- agregar un valor a un enum exige una migración aparte donde no se puede usar
-- el valor nuevo en la misma transacción — el problema que ya se sufrió con
-- `AWAITING_PAYMENT` (20260928100000). Un CHECK se reemplaza en una sola
-- transacción.
--
-- (D5) `payment_confirmed_at` pasa a significar "el cliente CERRÓ su elección de
-- pago", para AMBOS métodos. Se reutiliza a propósito: las cuatro guardas que ya
-- existen (retirar oferta, expirar oferta, cancelar pedido, limpiar comprobante)
-- dependen de ese campo y reutilizarlo evita tocarlas — y, sobre todo, evita
-- abrir una ventana en la que una esté mirando una columna y otra la nueva. Con
-- CASH NO significa "plata cobrada": eso lo marca `cash_collected_at`.
--
-- Sin índices nuevos: ninguna consulta filtra por método. Un índice acá sería
-- costo de escritura y de mantenimiento sin una sola lectura que lo use.
-- ============================================================================

alter table public.deliveries
  add column if not exists payment_method text,
  add column if not exists cash_collected_at timestamptz;

alter table public.orders
  add column if not exists payment_method text;

-- ---------------------------------------------------------------------------
-- Backfill ANTES de los constraints, no después.
--
-- Todo pago ya confirmado hasta hoy fue por Yape: era el único método que
-- existía. Las filas sin confirmar quedan en NULL a propósito — "todavía no
-- eligió" es información real y distinta de "eligió Yape". Si se invirtiera el
-- orden, `deliveries_voucher_requires_yape_check` fallaría contra las filas
-- históricas: tienen comprobante y no tendrían método.
-- ---------------------------------------------------------------------------
update public.deliveries
   set payment_method = 'YAPE'
 where payment_confirmed_at is not null
   and payment_method is null;

-- Snapshot en `orders` (mismo criterio que orders.delivery_fee): sobrevive a que
-- la fila de `deliveries` desaparezca — la FK es ON DELETE SET NULL y el
-- repartidor puede borrarse.
update public.orders o
   set payment_method = d.payment_method
  from public.deliveries d
 where d.order_id = o.id
   and d.payment_method is not null
   and o.payment_method is null;

-- ---------------------------------------------------------------------------
-- Invariantes de datos, no validación de aplicación: aunque mañana se escriba
-- una Server Action con un bug, la base no acepta un método inexistente ni un
-- estado incoherente entre método, comprobante y cobro.
-- ---------------------------------------------------------------------------
alter table public.deliveries drop constraint if exists deliveries_payment_method_check;
alter table public.deliveries add constraint deliveries_payment_method_check
  check (payment_method is null or payment_method in ('YAPE', 'CASH'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('YAPE', 'CASH'));

-- El comprobante solo tiene sentido con Yape: es evidencia de una transferencia.
-- Con efectivo no hay transferencia que documentar.
alter table public.deliveries drop constraint if exists deliveries_voucher_requires_yape_check;
alter table public.deliveries add constraint deliveries_voucher_requires_yape_check
  check (payment_voucher_path is null or payment_method = 'YAPE');

-- Y al revés: nadie puede declarar que cobró en efectivo un pedido que se pagó
-- por Yape (sería un doble cobro, o un error que dejaría al cliente sin
-- evidencia y al repartidor con el registro equivocado).
alter table public.deliveries drop constraint if exists deliveries_cash_collected_requires_cash_check;
alter table public.deliveries add constraint deliveries_cash_collected_requires_cash_check
  check (cash_collected_at is null or payment_method = 'CASH');

comment on column public.deliveries.payment_method is
  'Cómo paga el cliente el pedido: YAPE (por adelantado, con comprobante) o CASH (al recibir, en efectivo: comida + envío). NULL mientras no eligió y en las entregas legacy aceptadas sin oferta.';

comment on column public.deliveries.payment_confirmed_at is
  'Cuándo el cliente CERRÓ su elección de pago (Yape con comprobante, o efectivo al recibir). Con CASH NO significa que el dinero ya se cobró: eso lo marca cash_collected_at. Las guardas de retirar/expirar/cancelar/limpiar dependen de este campo: solo está puesto cuando el pedido ya arrancó por un camino pagado.';

comment on column public.deliveries.cash_collected_at is
  'Cuándo el repartidor confirmó haber cobrado el pedido en efectivo al entregarlo (monto = orders.total + orders.delivery_fee). Solo con payment_method = CASH; la función complete_delivery() lo escribe.';

comment on column public.orders.payment_method is
  'Snapshot de deliveries.payment_method al confirmar el pago. Sobrevive a la fila de deliveries (ON DELETE SET NULL del repartidor), igual que orders.delivery_fee. Con CASH indica que el repartidor cobra total + delivery_fee al entregar.';
