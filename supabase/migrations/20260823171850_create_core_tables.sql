-- ============================================================================
-- PideloYa — Tablas base
-- ============================================================================
-- Debe aplicarse ANTES de la migración de RLS (0002_rls_policies.sql).
-- Convención: nombres de tabla y columna en snake_case, ids en UUID.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('CUSTOMER', 'RESTAURANT', 'DELIVERY', 'ADMIN');

create type public.order_status as enum (
  'PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'
);

-- ----------------------------------------------------------------------------
-- PROFILES
-- Un perfil por cada usuario de auth.users. El rol vive aquí, no en
-- auth.users, porque RLS y el middleware necesitan consultarlo con
-- una query simple sobre una tabla propia.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid not null unique references auth.users(id) on delete cascade,
  role         public.user_role not null,
  full_name    text not null,
  phone        text,
  is_active    boolean not null default true, -- false = pendiente de aprobación (restaurante/repartidor)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index profiles_auth_id_idx on public.profiles(auth_id);
create index profiles_role_idx on public.profiles(role);

-- ----------------------------------------------------------------------------
-- RESTAURANTS
-- ----------------------------------------------------------------------------
create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  logo_url      text,
  address_text  text,          -- dirección en texto libre del local
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  is_approved   boolean not null default false, -- lo aprueba el admin
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index restaurants_slug_idx on public.restaurants(slug);
create index restaurants_approved_active_idx on public.restaurants(is_approved, is_active);

-- Relación muchos-a-muchos: quién administra qué restaurante.
-- (Permite más de un miembro por restaurante a futuro sin migrar de nuevo.)
create table public.restaurant_members (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index restaurant_members_user_idx on public.restaurant_members(user_id);
create index restaurant_members_restaurant_idx on public.restaurant_members(restaurant_id);

-- ----------------------------------------------------------------------------
-- CATEGORIES (propias de cada restaurante)
-- ----------------------------------------------------------------------------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index categories_restaurant_idx on public.categories(restaurant_id);

-- ----------------------------------------------------------------------------
-- PRODUCTS
-- ----------------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  category_id    uuid references public.categories(id) on delete set null,
  name           text not null,
  description    text,
  price          numeric(10,2) not null check (price >= 0),
  image_url      text,
  available      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_restaurant_idx on public.products(restaurant_id);
create index products_available_idx on public.products(available);

-- ----------------------------------------------------------------------------
-- ADDRESSES (direcciones del cliente)
-- ----------------------------------------------------------------------------
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  label         text,             -- "Casa", "Trabajo", etc.
  address_text  text not null,
  reference     text,             -- referencia adicional (típico en Perú)
  latitude      numeric(9,6) not null,
  longitude     numeric(9,6) not null,
  created_at    timestamptz not null default now()
);

create index addresses_customer_idx on public.addresses(customer_id);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id),
  address_id    uuid not null references public.addresses(id),
  status        public.order_status not null default 'PENDING',
  total         numeric(10,2) not null check (total >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index orders_customer_idx on public.orders(customer_id);
create index orders_status_idx on public.orders(status);

-- ----------------------------------------------------------------------------
-- ORDER_ITEMS
-- Guarda restaurant_id "desnormalizado" a propósito: permite que la
-- policy de RLS "el restaurante ve los pedidos con sus productos" no
-- tenga que hacer join extra contra products en cada consulta.
-- ----------------------------------------------------------------------------
create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid not null references public.products(id),
  restaurant_id  uuid not null references public.restaurants(id),
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(10,2) not null check (unit_price >= 0), -- precio al momento del pedido
  created_at     timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);
create index order_items_restaurant_idx on public.order_items(restaurant_id);

-- ----------------------------------------------------------------------------
-- DELIVERIES
-- ----------------------------------------------------------------------------
create table public.deliveries (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.orders(id) on delete cascade,
  delivery_person_id  uuid references public.profiles(id), -- null hasta que alguien lo acepte
  accepted_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index deliveries_delivery_person_idx on public.deliveries(delivery_person_id);
create index deliveries_order_idx on public.deliveries(order_id);

-- ----------------------------------------------------------------------------
-- Trigger genérico: mantener updated_at al día
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();