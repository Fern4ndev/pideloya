-- ============================================================================
-- PideloYa — Rate limit de registro público (C4 del plan de optimización)
-- ============================================================================
-- Motivo:
--   registerRestaurant/registerDeliveryPerson son Server Actions PÚBLICAS que
--   crean usuarios de Auth. Sin freno, un script puede crear miles de cuentas
--   huérfanas (C4). Esta tabla registra intentos por IP y la Server Action
--   rechaza con 429 a la 6ª tentativa dentro de la última hora (máx. 5/hora/IP).
--
--   RLS habilitada y SIN policies: para anon/authenticated la tabla es
--   invisible e intocable (fail-closed). Solo el service_role (Server Actions)
--   la lee/escribe, porque salta RLS.
--
--   Sin columna/policy "user_id": la IP viene de x-forwarded-for y no
--   identificamos usuarios, minimizando PII (Ley 29733). Retención: cada
--   registro borra sus intentos > 2 h (best-effort, en la Server Action).
--
-- Rollback (comentado, verbatim del estado anterior — la tabla no existía):
--   drop table if exists public.registration_attempts;
-- ============================================================================
create table public.registration_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

alter table public.registration_attempts enable row level security;

-- (Sin policies a propósito — ver el motivo arriba.)

create index registration_attempts_ip_created_idx
  on public.registration_attempts (ip, created_at desc);
