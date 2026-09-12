-- ============================================================================
-- Fix: ON DELETE CASCADE en FKs que referencian profiles
-- ============================================================================
-- orders.customer_id y deliveries.delivery_person_id tenían el default
-- de PostgreSQL (RESTRICT), lo que impedía eliminar usuarios de auth.users
-- que tuvieran pedidos o deliveries asociados.
-- ============================================================================

-- orders → profiles
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey,
  ADD CONSTRAINT orders_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- deliveries → profiles
ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_delivery_person_id_fkey,
  ADD CONSTRAINT deliveries_delivery_person_id_fkey
    FOREIGN KEY (delivery_person_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
