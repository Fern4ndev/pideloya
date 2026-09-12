-- ============================================================================
-- PideloYa — Horarios del restaurante
-- ============================================================================

create table public.restaurant_hours (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6),
  open_time     time not null default '09:00',
  close_time    time not null default '22:00',
  is_closed     boolean not null default false,
  unique (restaurant_id, day_of_week)
);

create index restaurant_hours_restaurant_idx on public.restaurant_hours(restaurant_id);

alter table public.restaurant_hours enable row level security;

-- El restaurante dueño puede leer sus propios horarios
create policy "restaurant_hours_select_owner"
on public.restaurant_hours for select
using (restaurant_id in (select public.current_restaurant_ids()));

-- El restaurante dueño puede insertar horarios
create policy "restaurant_hours_insert_owner"
on public.restaurant_hours for insert
with check (restaurant_id in (select public.current_restaurant_ids()));

-- El restaurante dueño puede actualizar sus horarios
create policy "restaurant_hours_update_owner"
on public.restaurant_hours for update
using (restaurant_id in (select public.current_restaurant_ids()))
with check (restaurant_id in (select public.current_restaurant_ids()));

-- El restaurante dueño puede eliminar sus horarios
create policy "restaurant_hours_delete_owner"
on public.restaurant_hours for delete
using (restaurant_id in (select public.current_restaurant_ids()));
