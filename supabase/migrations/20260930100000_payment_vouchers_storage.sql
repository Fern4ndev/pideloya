-- ============================================================================
-- PideloYa — Storage: comprobantes de pago del envío (voucher de Yape)
-- ============================================================================
-- El cliente sube una foto de su comprobante de Yape al confirmar el pago del
-- envío. Esa imagen pasa a ser la ÚNICA evidencia que tiene el repartidor de
-- que le pagaron (no hay pasarela integrada), así que tiene que vivir en un
-- lugar que solo las dos partes puedan leer.
--
-- ¿Por qué Supabase Storage y no ImageKit (lo que usa el resto del proyecto)?
-- Un comprobante de Yape lleva nombre, monto y número de operación: es un dato
-- financiero personal (Ley 29733, ya asumida por el proyecto). Las URLs de
-- ImageKit que usamos hoy son PÚBLICAS — cualquiera con la URL ve la imagen, y
-- las URLs se filtran por logs, historial y cachés. Supabase Storage permite:
--   a) RLS por carpeta (solo el dueño del pedido sube, solo las partes leen),
--   b) URLs firmadas que expiran (Fase 3: 1 h),
--   c) borrar el archivo con la misma API con la que se subió (Fase 6).
-- El precio es que hay que servir la lectura por URL firmada en vez de una URL
-- fija. Vale la pena para este dato.
--
-- Convención de rutas (ÚNICA forma válida):
--   payment-vouchers/{order_id}/voucher.jpg
-- Un solo archivo por pedido, con la extensión fija .jpg: el cliente
-- re-encodea a JPEG en el navegador antes de subir (Fase 4), así que la
-- extensión nunca miente. Un archivo por pedido acota los huérfanos posibles a
-- uno y hace trivial tanto la limpieza (Fase 6) como esta RLS.
-- ============================================================================

-- Bucket PRIVADO. `public = false` es la diferencia central con
-- restaurant-logos: sin URL fija, todas las lecturas pasan por una URL firmada
-- y por lo tanto por la policy de SELECT de abajo.
--
-- `file_size_limit` y `allowed_mime_types` son la PRIMERA barrera, y la única
-- que no depende de nuestra aplicación: las hace cumplir el servidor de
-- Storage aunque alguien suba el archivo con curl y un token válido, saltándose
-- la compresión y la validación del navegador. El límite de 5 MB coincide con
-- VOUCHER_MAX_BYTES (lib/constants/payment-voucher.ts); si se cambia uno, hay
-- que cambiar el otro.
--
-- `on conflict do update` y no `do nothing` (como hace 20260912135915 con
-- restaurant-logos): si el bucket ya existiera con la configuración por
-- defecto, `do nothing` dejaría un bucket PÚBLICO o con tipos permitidos
-- abiertos — un fallo silencioso de privacidad. Acá se prefiere que la
-- migración fije la configuración correcta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-vouchers',
  'payment-vouchers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ----------------------------------------------------------------------------
-- 1) voucher_order_id: extrae el order_id de una ruta con el ÚNICO formato
--    válido, o NULL para cualquier otra cosa.
--
-- ¿Por qué no `(storage.foldername(name))[1]::uuid` (el patrón de
-- restaurant-logos)? Porque un cast fallido dentro de una policy no devuelve
-- "denegar": LANZA error (22P02) y tumba la consulta completa. Y no se puede
-- arreglar envolviéndolo en un AND esperando que el orden de evaluación lo
-- salve: el planner de Postgres es libre de reordenar los términos de un WHERE
-- (y de hecho lo hace). Acá la decisión "¿es una ruta válida?" se toma con una
-- expresión que NUNCA lanza: una regex que restringe el patrón completo, con lo
-- cual el cast ya es seguro cuando el regex matchea.
--
-- `immutable` porque es una función pura de texto: el planner puede usarla en
-- planes sin recalcularla por fila y es la volatilidad correcta para una
-- expresión que solo compara strings.
--
-- Privilegios: NO se revoca (a diferencia de las funciones invocables). Se usa
-- dentro de expresiones de policies, y esas se evalúan con los privilegios del
-- rol que consulta: si `authenticated` (o `anon`) pierde EXECUTE, cualquier
-- operación de Storage sobre este bucket falla con "permission denied for
-- function" en vez de devolver cero filas. Mismo motivo documentado en
-- 20260928100200 para pending_order_address_ids().
-- ----------------------------------------------------------------------------
create or replace function public.voucher_order_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/voucher\.jpg$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

grant execute on function public.voucher_order_id(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2) customer_awaiting_payment_order_ids: los pedidos del cliente actual que
--    están esperando su pago. Mismo patrón (SECURITY DEFINER + stable) que
--    current_customer_order_ids(), y por el mismo motivo: una subconsulta
--    directa contra `orders` desde una policy de storage.objects re-dispararía
--    la RLS de `orders` (y su recursión con `deliveries`), mientras que una
--    función SECURITY DEFINER no.
--
-- Filtra por estado A PROPOSITO: el comprobante se sube SOLO mientras el
-- pedido espera el pago. Esa ventana se cierra apenas el cliente confirma (el
-- pedido pasa a ASSIGNED), así que a partir de ahí el comprobante queda
-- inmutable: nadie puede reemplazarlo a posteriori, que es justo lo que uno
-- quiere de una evidencia de pago.
-- ----------------------------------------------------------------------------
create or replace function public.customer_awaiting_payment_order_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.orders
  where customer_id = public.current_profile_id()
    and status = 'AWAITING_PAYMENT'
$$;


-- ----------------------------------------------------------------------------
-- 3) SUBIR / REEMPLAZAR: solo el cliente dueño, solo mientras su pedido espera
--    el pago.
--
-- El `update` es obligatorio además del `insert` porque el reintento se hace
-- con `upsert: true` (Fase 4): si el primer intento subió el archivo pero la
-- confirmación falló por red, el reintento SOBREESCRIBE la misma ruta en vez de
-- duplicar. Sin policy de UPDATE, el upsert fallaría con un 403 desconcertante
-- en el camino del reintento — que es exactamente el camino en el que el
-- usuario ya está frustrado.
-- ----------------------------------------------------------------------------
create policy "payment_vouchers_insert_customer"
on storage.objects for insert
with check (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
);

create policy "payment_vouchers_update_customer"
on storage.objects for update
using (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
)
with check (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
);


-- ----------------------------------------------------------------------------
-- 4) LEER: el cliente dueño, el repartidor de ESE pedido y el admin. Nadie más
--    — ni otro cliente, ni otro repartidor.
--
-- En esta policy SÍ se usa current_customer_order_ids() (todos los pedidos del
-- cliente, sin filtrar por estado) y no la versión "awaiting payment": el
-- cliente tiene que poder ver su propio comprobante después de confirmar
-- (Fase 5), y el repartidor también. Filtrar por estado acá le escondería al
-- cliente su propia evidencia justo cuando el pedido avanza.
--
-- Se apoya en funciones SECURITY DEFINER y no en subconsultas directas porque
-- `deliveries` y `orders` tienen RLS con recursión cruzada: una subconsulta
-- acá volvería a dispararla (42P17).
-- ----------------------------------------------------------------------------
create policy "payment_vouchers_select_parties"
on storage.objects for select
using (
  bucket_id = 'payment-vouchers'
  and (
    public.voucher_order_id(name) in (select public.current_customer_order_ids())
    or public.voucher_order_id(name) in (select public.current_delivery_order_ids())
    or public.current_role() = 'ADMIN'
  )
);

-- Sin policy de DELETE para usuarios: el comprobante solo se borra desde el
-- servidor con service_role (Fase 6). Un cliente que pudiera borrar su propio
-- comprobante podría dejar al repartidor sin la evidencia del cobro DESPUÉS de
-- que el pedido arrancó.
--
-- Nota de implementación (por si alguien agrega la limpieza en SQL): borrar
-- filas de storage.objects NO elimina el archivo físico. La única forma
-- soportada de borrar de verdad es la API de Storage (`remove`), que es lo que
-- hace lib/storage/payment-vouchers.ts en la Fase 6.
