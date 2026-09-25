-- ============================================================================
-- PideloYa — Preservar historial de pedidos al eliminar un cliente
-- ============================================================================
-- deleteUser() purga el perfil del cliente (Admin → Usuarios). Antes:
--
--   profiles ← orders.customer_id   ON DELETE CASCADE  → pedidos borrados
--   profiles ← addresses.customer_id ON DELETE CASCADE → direcciones borradas
--   addresses ← orders.address_id   NOT NULL (RESTRICT) → el borrado FALLABA
--                                    si el cliente tenía pedidos
--
-- Cambio (mismo patrón que deliveries.delivery_person_id → SET NULL en
-- 20260923100000):
--
--   orders.customer_id   → nullable + SET NULL  (el pedido queda sin cliente)
--   addresses.customer_id → nullable + SET NULL (las direcciones de entrega
--                            se conservan; orders.address_id sigue apuntando
--                            a una fila válida y el historial muestra la
--                            dirección original)
--
-- Resultado: la cuenta desaparece, pero pedidos, items, deliveries y
-- direcciones se mantienen como evidencia histórica.
-- ----------------------------------------------------------------------------

-- orders.customer_id
alter table public.orders
  alter column customer_id drop not null;

alter table public.orders
  drop constraint if exists orders_customer_id_fkey;

alter table public.orders
  add constraint orders_customer_id_fkey
    foreign key (customer_id) references public.profiles(id)
    on delete set null;

-- addresses.customer_id (necesario: sin esto, RESTRICT en orders.address_id
-- impediría borrar el perfil o borraría la dirección del pedido)
alter table public.addresses
  alter column customer_id drop not null;

alter table public.addresses
  drop constraint if exists addresses_customer_id_fkey;

alter table public.addresses
  add constraint addresses_customer_id_fkey
    foreign key (customer_id) references public.profiles(id)
    on delete set null;

-- unique (customer_id) en addresses: Postgres permite múltiples NULLs,
-- así que no hay conflicto con direcciones huérfanas.
