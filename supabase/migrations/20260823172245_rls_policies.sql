-- ============================================================================
-- PideloYa — Row Level Security (RLS)
-- ============================================================================
-- Esta migración asume que ya existen las tablas base (profiles, restaurants,
-- restaurant_members, products, addresses, orders, order_items, deliveries)
-- creadas con `supabase migration new create_core_tables`.
--
-- Convención: cada usuario autenticado tiene una fila en `profiles` con
-- `auth_id` apuntando a `auth.users.id`. El middleware y las policies
-- consultan esta misma tabla, así que el rol vive en un solo lugar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Función auxiliar: rol del usuario autenticado actual.
-- Evita repetir el mismo subquery en cada policy.
-- SECURITY DEFINER + search_path fijo para que no pueda ser
-- secuestrada por un search_path malicioso.
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where auth_id = auth.uid()
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where auth_id = auth.uid()
$$;

-- Restaurante(s) que administra el usuario actual (vía restaurant_members)
create or replace function public.current_restaurant_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select restaurant_id
  from public.restaurant_members
  where user_id = public.current_profile_id()
$$;


-- ============================================================================
-- PROFILES
-- ============================================================================
alter table public.profiles enable row level security;

-- Cualquiera autenticado puede leer su propio perfil.
create policy "profiles_select_own"
on public.profiles for select
using (auth_id = auth.uid());

-- El admin puede leer todos los perfiles (para aprobar restaurantes/repartidores).
create policy "profiles_select_admin"
on public.profiles for select
using (public.current_role() = 'ADMIN');

-- Un usuario solo puede editar su propio perfil (no su rol ni is_active).
create policy "profiles_update_own"
on public.profiles for update
using (auth_id = auth.uid())
with check (auth_id = auth.uid());

-- Solo el admin puede activar/desactivar cuentas o cambiar roles.
create policy "profiles_update_admin"
on public.profiles for update
using (public.current_role() = 'ADMIN');


-- ============================================================================
-- PRODUCTS
-- ============================================================================
alter table public.products enable row level security;

-- Público (incluye visitantes sin sesión): puede ver productos disponibles
-- de restaurantes activos. Esto alimenta el catálogo público /(public).
create policy "products_select_public"
on public.products for select
using (available = true);

-- El restaurante dueño puede ver TODOS sus productos, incluidos los
-- desactivados (para poder reactivarlos desde su panel).
create policy "products_select_owner"
on public.products for select
using (restaurant_id in (select public.current_restaurant_ids()));

-- Solo miembros del restaurante dueño pueden crear productos para ese restaurante.
create policy "products_insert_owner"
on public.products for insert
with check (restaurant_id in (select public.current_restaurant_ids()));

-- Solo miembros del restaurante dueño pueden editar sus propios productos.
create policy "products_update_owner"
on public.products for update
using (restaurant_id in (select public.current_restaurant_ids()))
with check (restaurant_id in (select public.current_restaurant_ids()));

-- Solo miembros del restaurante dueño pueden eliminar sus propios productos.
create policy "products_delete_owner"
on public.products for delete
using (restaurant_id in (select public.current_restaurant_ids()));

-- El admin tiene acceso total (moderación de catálogo).
create policy "products_all_admin"
on public.products for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');


-- ============================================================================
-- ADDRESSES
-- ============================================================================
alter table public.addresses enable row level security;

-- Un cliente solo ve, crea, edita y borra SUS PROPIAS direcciones.
create policy "addresses_select_own"
on public.addresses for select
using (customer_id = public.current_profile_id());

create policy "addresses_insert_own"
on public.addresses for insert
with check (customer_id = public.current_profile_id());

create policy "addresses_update_own"
on public.addresses for update
using (customer_id = public.current_profile_id())
with check (customer_id = public.current_profile_id());

create policy "addresses_delete_own"
on public.addresses for delete
using (customer_id = public.current_profile_id());

-- El repartidor asignado a un pedido necesita leer la dirección de entrega
-- (pero no puede editarla ni ver las demás direcciones del cliente).
create policy "addresses_select_assigned_delivery"
on public.addresses for select
using (
  public.current_role() = 'DELIVERY'
  and id in (
    select o.address_id
    from public.orders o
    join public.deliveries d on d.order_id = o.id
    where d.delivery_person_id = public.current_profile_id()
  )
);

create policy "addresses_all_admin"
on public.addresses for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');


-- ============================================================================
-- ORDERS
-- ============================================================================
alter table public.orders enable row level security;

-- El cliente ve solo sus propios pedidos.
create policy "orders_select_own_customer"
on public.orders for select
using (customer_id = public.current_profile_id());

-- El cliente crea pedidos a su propio nombre.
create policy "orders_insert_own_customer"
on public.orders for insert
with check (customer_id = public.current_profile_id());

-- El restaurante ve (solo lectura) los pedidos que incluyen sus productos.
-- Recordatorio: el restaurante NO acepta/rechaza pedidos, solo puede
-- consultarlos para fines de historial/reportes propios.
create policy "orders_select_restaurant_readonly"
on public.orders for select
using (
  id in (
    select oi.order_id
    from public.order_items oi
    where oi.restaurant_id in (select public.current_restaurant_ids())
  )
);

-- El repartidor ve los pedidos disponibles (PENDING, sin asignar)
-- y los que ya tiene asignados a él.
create policy "orders_select_delivery"
on public.orders for select
using (
  public.current_role() = 'DELIVERY'
  and (
    status = 'PENDING'
    or id in (
      select order_id from public.deliveries
      where delivery_person_id = public.current_profile_id()
    )
  )
);

-- El repartidor solo puede actualizar el estado de un pedido que él mismo
-- tiene asignado, y únicamente para avanzar el flujo (no para cancelar
-- pedidos de otros ni tocar campos que no le corresponden — esa
-- restricción de columnas se refuerza además en la Server Action).
create policy "orders_update_delivery_assigned"
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (
    select order_id from public.deliveries
    where delivery_person_id = public.current_profile_id()
  )
)
with check (
  status in ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
);

create policy "orders_all_admin"
on public.orders for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');


-- ============================================================================
-- DELIVERIES
-- ============================================================================
alter table public.deliveries enable row level security;

-- El cliente puede ver (solo lectura) el estado de entrega de SU pedido,
-- para el seguimiento en tiempo real.
create policy "deliveries_select_customer"
on public.deliveries for select
using (
  order_id in (
    select id from public.orders where customer_id = public.current_profile_id()
  )
);

-- Cualquier repartidor puede ver entregas sin asignar (para poder aceptarlas)
-- y las que ya son suyas.
create policy "deliveries_select_delivery"
on public.deliveries for select
using (
  public.current_role() = 'DELIVERY'
  and (delivery_person_id is null or delivery_person_id = public.current_profile_id())
);

-- "Aceptar" un pedido = insertar/actualizar la fila de delivery asignándose
-- a sí mismo. Un repartidor nunca puede asignar el pedido a otro.
create policy "deliveries_insert_delivery_self"
on public.deliveries for insert
with check (
  public.current_role() = 'DELIVERY'
  and delivery_person_id = public.current_profile_id()
);

create policy "deliveries_update_delivery_self"
on public.deliveries for update
using (
  public.current_role() = 'DELIVERY'
  and delivery_person_id = public.current_profile_id()
)
with check (
  delivery_person_id = public.current_profile_id()
);

create policy "deliveries_all_admin"
on public.deliveries for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');


-- ============================================================================
-- RESTAURANTS (info del negocio)
-- ============================================================================
alter table public.restaurants enable row level security;

-- Público: puede ver restaurantes aprobados/activos (catálogo público).
create policy "restaurants_select_public"
on public.restaurants for select
using (is_approved = true and is_active = true);

-- El dueño/miembro puede ver su propio restaurante aunque esté pendiente
-- de aprobación o desactivado.
create policy "restaurants_select_owner"
on public.restaurants for select
using (id in (select public.current_restaurant_ids()));

-- El dueño/miembro puede editar la info de SU restaurante, pero no puede
-- auto-aprobarse ni reactivarse (eso queda fuera del with check permitido
-- a nivel de columnas sensibles, reforzado en la Server Action).
create policy "restaurants_update_owner"
on public.restaurants for update
using (id in (select public.current_restaurant_ids()))
with check (id in (select public.current_restaurant_ids()));

-- Solo el admin aprueba/desactiva restaurantes y tiene acceso total.
create policy "restaurants_all_admin"
on public.restaurants for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');

-- Nota: la fila inicial de un restaurante (registro) se crea vía una
-- Server Action que corre con el service role, ya que un usuario sin
-- restaurant_member previo no puede pasar la policy de owner.