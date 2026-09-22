-- supabase/migrations/20260921000000_enable_realtime_orders.sql
-- REPLICA IDENTITY FULL es necesario para que los eventos UPDATE
-- traigan también los valores viejos (payload.old), útil para
-- detectar transiciones de estado (ej. PENDING -> ASSIGNED).
alter table public.orders replica identity full;