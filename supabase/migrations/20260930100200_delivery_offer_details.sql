-- ============================================================================
-- PideloYa — get_delivery_offer_details: la oferta + el teléfono del repartidor
-- ============================================================================
-- El cliente paga el envío por Yape. Hasta ahora la única vía era escanear el
-- QR que el repartidor cargó en su perfil (opcional); si no lo cargó, la UI le
-- decía "confirma solo si ya acordaron cómo transferirle" — es decir, lo dejaba
-- sin ninguna forma de pagarle. El celular cierra ese hueco: Yape en Perú se
-- asocia al número, y el registro ya lo pide y lo valida (^9\d{8}$), así que no
-- hace falta ninguna columna nueva.
--
-- ¿Por qué una función NUEVA y no agregar la columna a
-- get_delivery_offer_profile (20260928100200)? Porque cambiar las columnas de
-- retorno de una función exige DROP + CREATE, y en esa ventana el código
-- desplegado que llama a la versión vieja se rompe ("function does not exist")
-- para todos los usuarios. Con una función nueva, la vieja sigue respondiendo
-- mientras se despliega, y recién se retira cuando ya nadie la llama (Fase 9
-- del plan). Es el mismo criterio aditivo que rige las columnas de este
-- proyecto: agregar es seguro, cambiar de firma no.
--
-- Mismo principio de superficie mínima que la función vieja: el cliente NO
-- recibe una policy de SELECT sobre `profiles` (una policy es a nivel de FILA,
-- no de COLUMNA: le entregaría phone, document_number, email y todo lo demás
-- de cualquier repartidor con el que tuviera un pedido). Recibe exactamente los
-- seis campos que la UI necesita, y solo de su propio pedido.
--
-- MINIMIZACIÓN (Ley 29733): el filtro por estado no es cosmético. El celular
-- del repartidor solo es visible mientras el pedido está VIVO — esperando el
-- pago o en camino. Cancelado, entregado o de vuelta en PENDING no devuelve
-- filas, así que la relación comercial terminada no deja un canal de contacto
-- abierto. Es el mismo criterio con el que se limpian la foto y el QR al
-- anonimizar la cuenta.
--
-- Nota: el `join public.profiles` es INNER a propósito (igual que la función
-- vieja). Si el repartidor fue anonimizado/borrado, deliveries.delivery_person_id
-- queda NULL (20260923100000) y la consulta devuelve cero filas: la UI cae a su
-- degradación (sin foto, sin QR, sin número) en vez de mostrar un repartidor
-- fantasma.
-- ============================================================================

create or replace function public.get_delivery_offer_details(p_order_id uuid)
returns table (
  full_name text,
  avatar_url text,
  yape_qr_url text,
  phone text,
  delivery_fee numeric,
  payment_voucher_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name,
         p.avatar_url,
         p.yape_qr_url,
         p.phone,
         d.delivery_fee,
         d.payment_voucher_path
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  join public.profiles p on p.id = d.delivery_person_id
  where o.id = p_order_id
    and o.customer_id = public.current_profile_id()
    and o.status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')
$$;

-- Superficie mínima, igual que el resto de las funciones invocables del
-- proyecto: en Supabase `anon` recibe EXECUTE por privilegios por defecto sobre
-- funciones nuevas del schema public, así que hay que revocarlo explícitamente.
-- Ojo con el detalle ya documentado en 20260928100200: esto solo es correcto
-- porque esta función la llama la APLICACIÓN (Server Action / API v1), no una
-- policy RLS.
revoke all on function public.get_delivery_offer_details(uuid) from public, anon;
grant execute on function public.get_delivery_offer_details(uuid) to authenticated;
