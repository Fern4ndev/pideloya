-- ============================================================================
-- PideloYa — Ruta del comprobante de pago en `deliveries`
-- ============================================================================
-- La imagen vive en el bucket privado payment-vouchers (20260930100000); acá
-- se guarda DÓNDE quedó. Es la misma pareja que ya usa el proyecto con
-- ImageKit (yape_qr_url + yape_qr_file_id en profiles, 20260928000000): una
-- columna apunta al archivo, la base guarda la referencia.
--
-- ¿Por qué en `deliveries` y no en `orders`? Porque es el comprobante DEL PAGO
-- DEL ENVÍO: pertenece al mismo ciclo y al mismo dueño que delivery_fee y
-- payment_confirmed_at, que ya viven ahí. `orders` guarda el pedido de comida
-- (subtotal, dirección, notas); `deliveries` guarda la relación cliente ↔
-- repartidor para ese traslado (tarifa, cuándo se ofertó, cuándo se pagó).
--
-- Sin backfill a propósito: NULL es la respuesta CORRECTA para toda entrega
-- anterior a este cambio. No existe (ni puede inventarse) un comprobante
-- retroactivo de un pago que se hizo sin subir nada.
-- ============================================================================

alter table public.deliveries
  add column if not exists payment_voucher_path text;

comment on column public.deliveries.payment_voucher_path is
  'Ruta en el bucket privado payment-vouchers del comprobante de Yape que el cliente adjuntó al confirmar el pago del envío (formato: {order_id}/voucher.jpg). NULL en entregas anteriores a este cambio y mientras el cliente no haya confirmado.';

-- Invariante de datos, no validación de aplicación: la ruta guardada SOLO
-- puede ser la de ESTE pedido. La aplicación ya calcula la ruta a partir del
-- id (paymentVoucherPath en lib/constants/payment-voucher.ts) y la función que
-- la escribe la vuelve a validar; esto es lo que garantiza que ni una Server
-- Action futura, ni la API v1, ni un UPDATE a mano puedan apuntar la fila a un
-- comprobante de otro pedido (lo que le daría al repartidor de este pedido la
-- evidencia —y los datos personales— de otro cliente).
alter table public.deliveries
  drop constraint if exists deliveries_voucher_path_check;
alter table public.deliveries
  add constraint deliveries_voucher_path_check
  check (
    payment_voucher_path is null
    or payment_voucher_path = order_id::text || '/voucher.jpg'
  );
