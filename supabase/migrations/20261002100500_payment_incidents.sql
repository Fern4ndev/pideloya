-- ============================================================================
-- PideloYa — Incidencias de pago ("No pude cobrar") y conciliación
-- ============================================================================
-- Fase 8 del plan "Pagar al recibir con Yape o Efectivo".
--
-- Quién pone plata en este flujo es el repartidor (adelanta la comida cuando el
-- cliente paga al recibir) y el restaurante (espera su constancia). Sin un
-- registro formal, el caso "el cliente no pagó" se resolvía por WhatsApp, sin
-- evidencia, sin responsable y sin forma de que el admin vea el patrón.
--
-- Modelo minimalista a propósito:
--   - Una fila = UN reporte de UNA de las partes. No mueve dinero ni cambia el
--     estado del pedido (D8): es un registro de gestión que el admin revisa.
--   - `reporter_role` se copia del rol REAL calculado contra el pedido, no se
--     acepta del cliente: es el dato que usa el admin para leer el reporte.
--   - Escritura SOLO por `report_payment_incident()` (security definer), igual
--     que admin_audit_log: sin policies de insert/update/delete, una sesión
--     cualquiera no puede inventar una incidencia ni marcarla resuelta.
--   - Resolución (resolved_at/resolved_by) la hace el admin con service_role
--     desde la server action, que además escribe `admin_audit_log`.
-- ============================================================================

create table if not exists public.payment_incidents (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  reported_by   uuid references public.profiles(id) on delete set null,
  reporter_role public.user_role not null,
  kind          text not null
                check (kind in ('CUSTOMER_DID_NOT_PAY','RESTAURANT_NOT_PAID','AMOUNT_MISMATCH','OTHER')),
  note          text check (char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null
);

comment on table public.payment_incidents is
  'Reportes de las partes sobre el pago de un pedido (Fase 8, D8). NO cambia el estado del pedido ni mueve dinero: es una bandeja de conciliación para el admin. Escritura solo vía report_payment_incident(); la resolución la hace el admin con service_role y queda en admin_audit_log.';

comment on column public.payment_incidents.kind is
  'CUSTOMER_DID_NOT_PAY / AMOUNT_MISMATCH / OTHER los reporta el repartidor; RESTAURANT_NOT_PAID el restaurante. AMOUNT_MISMATCH y OTHER también el cliente.';

comment on column public.payment_incidents.reporter_role is
  'Rol REAL del reportante calculado contra el pedido (no lo elige el llamador): es el dato que interpreta el admin.';

-- Bandeja del admin: "incidencias abiertas, más nuevas primero".
create index if not exists payment_incidents_open_idx
  on public.payment_incidents(created_at desc)
  where resolved_at is null;

-- Idempotencia REAL (no solo el chequeo previo de la función): dos toques en un
-- botón en la puerta del cliente no deben crear dos reportes idénticos. Índice
-- parcial único porque solo la incidencia ABIERTA es la que se deduplica: tras
-- resolverla, el mismo hecho puede (y debe poder) volver a reportarse.
-- `reported_by` puede quedar NULL (perfil borrado) y los NULL no colisionan:
-- correcto, sin reportante no hay a quién atribuir el duplicado.
create unique index if not exists payment_incidents_open_key
  on public.payment_incidents(order_id, kind, reported_by)
  where resolved_at is null;

alter table public.payment_incidents enable row level security;

-- Lectura: el admin ve todo; cada reportante ve SOLO sus propios reportes (para
-- que la UI pueda mostrarle "ya registramos tu reporte" sin exponerle los de
-- otras partes del mismo pedido, que pueden contener quejas sobre él).
create policy "payment_incidents_select_admin"
on public.payment_incidents for select
using (public.current_role() = 'ADMIN');

create policy "payment_incidents_select_own"
on public.payment_incidents for select
using (reported_by = public.current_profile_id());

-- Sin policies de insert/update/delete: escribe la función de abajo
-- (security definer) y el service_role del admin. Una sesión autenticada no
-- puede crear ni "resolver" incidencias por su cuenta.


-- ----------------------------------------------------------------------------
-- report_payment_incident: registra un reporte de una de las partes.
--
-- Guardas, en orden:
--   1. Hay sesión.
--   2. El tipo es uno de los cuatro válidos (mismo CHECK de la tabla, acá para
--      dar un mensaje legible en vez de un 23514).
--   3. El llamador es PARTE del pedido y el tipo corresponde a su rol. Se
--      resuelve el rol REAL contra `orders.customer_id`, `deliveries` y
--      `restaurant_members` — nunca se acepta un rol del cliente.
--   4. Nota: se recorta; vacía = NULL; > 500 caracteres → 22000 (misma
--      invariante que el CHECK, adelantada).
--
-- Idempotencia: devuelve la incidencia ABIERTA existente (mismo pedido, tipo y
-- reportante) en vez de duplicarla. El índice parcial único cierra la carrera
-- entre dos llamadas simultáneas.
-- ----------------------------------------------------------------------------
create or replace function public.report_payment_incident(
  p_order_id uuid,
  p_kind text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_customer_id uuid;
  v_reporter_role public.user_role;
  v_note text;
  v_incident_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  if p_kind is null
     or p_kind not in ('CUSTOMER_DID_NOT_PAY','RESTAURANT_NOT_PAID','AMOUNT_MISMATCH','OTHER') then
    raise exception 'Tipo de incidencia inválido'
      using errcode = '22000';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'La nota no puede pasar de 500 caracteres'
      using errcode = '22000';
  end if;

  select o.customer_id
    into v_customer_id
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'No participas en este pedido'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.deliveries d
    where d.order_id = p_order_id
      and d.delivery_person_id = v_profile_id
  ) then
    v_reporter_role := 'DELIVERY';
    if p_kind not in ('CUSTOMER_DID_NOT_PAY','AMOUNT_MISMATCH','OTHER') then
      raise exception 'Tu rol no puede reportar ese tipo de incidencia'
        using errcode = '42501';
    end if;

  elsif v_customer_id = v_profile_id then
    v_reporter_role := 'CUSTOMER';
    if p_kind not in ('AMOUNT_MISMATCH','OTHER') then
      raise exception 'Tu rol no puede reportar ese tipo de incidencia'
        using errcode = '42501';
    end if;

  elsif exists (
    select 1
    from public.order_items oi
    join public.restaurant_members rm on rm.restaurant_id = oi.restaurant_id
    where oi.order_id = p_order_id
      and rm.user_id = v_profile_id
  ) then
    v_reporter_role := 'RESTAURANT';
    if p_kind <> 'RESTAURANT_NOT_PAID' then
      raise exception 'Tu rol no puede reportar ese tipo de incidencia'
        using errcode = '42501';
    end if;

  else
    raise exception 'No participas en este pedido'
      using errcode = '42501';
  end if;

  insert into public.payment_incidents (order_id, reported_by, reporter_role, kind, note)
  values (p_order_id, v_profile_id, v_reporter_role, p_kind, v_note)
  -- Inferencia del índice parcial único: si ya hay una abierta con la misma
  -- terna, no se inserta. Se evita el SELECT previo (y su carrera).
  on conflict (order_id, kind, reported_by) where resolved_at is null
  do nothing
  returning id into v_incident_id;

  if v_incident_id is null then
    select pi.id
      into v_incident_id
    from public.payment_incidents pi
    where pi.order_id = p_order_id
      and pi.kind = p_kind
      and pi.reported_by = v_profile_id
      and pi.resolved_at is null
    limit 1;
  end if;

  return v_incident_id;
end;
$$;

-- Superficie mínima, igual que el resto de funciones llamables por el app:
-- `anon` recibe EXECUTE por defecto, así que se revoca explícitamente. Solo un
-- usuario autenticado la invoca, y la función valida identidad y parte por dentro.
revoke all on function public.report_payment_incident(uuid, text, text) from public, anon;
grant execute on function public.report_payment_incident(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- Realtime del badge del admin: sin esto, RealtimeRefresh no recibe eventos de
-- la tabla nueva (Postgres Changes solo emite de tablas en la publicación).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payment_incidents'
  ) then
    alter publication supabase_realtime add table public.payment_incidents;
  end if;
end
$$;
