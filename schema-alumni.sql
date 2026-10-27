-- imMBA Alumni + Audit trail (Multi-Admin Back-Office)
-- Run in Supabase → SQL Editor → Run
-- Requires: schema-auth.sql already applied (profiles, is_site_admin)

-- 1) Alumni table
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  student_id text,
  department text,
  degree_program text
    check (
      degree_program is null
      or degree_program in ('Bachelor', 'Master', 'Doctoral', 'Other')
    ),
  admission_year integer
    check (admission_year is null or (admission_year >= 1950 and admission_year <= 2100)),
  graduation_year integer
    check (graduation_year is null or (graduation_year >= 1950 and graduation_year <= 2100)),
  email text,
  phone text,
  company text,
  job_title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.alumni is 'Alumni records for AdminAlumni multi-admin back office';
comment on column public.alumni.degree_program is 'Controlled values: Bachelor | Master | Doctoral | Other';

create index if not exists alumni_full_name_idx on public.alumni (full_name);
create index if not exists alumni_student_id_idx on public.alumni (student_id);
create index if not exists alumni_department_idx on public.alumni (department);
create index if not exists alumni_degree_program_idx on public.alumni (degree_program);
create index if not exists alumni_graduation_year_idx on public.alumni (graduation_year);
create index if not exists alumni_company_idx on public.alumni (company);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alumni_set_updated_at on public.alumni;
create trigger alumni_set_updated_at
before update on public.alumni
for each row
execute function public.set_updated_at();

-- 2) Audit log (who / did what / which record / when / what changed)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null
    check (action in ('CREATE', 'UPDATE', 'DELETE')),
  entity_type text not null default 'alumni',
  entity_id text,
  entity_label text,
  summary text,
  changes jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Audit trail for multi-admin alumni operations';
comment on column public.audit_logs.changes is 'JSON diff or payload describing the change';

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

-- 3) RLS — admin / super_admin only (uses public.is_site_admin from schema-auth.sql)
alter table public.alumni enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Admins can select alumni" on public.alumni;
create policy "Admins can select alumni"
  on public.alumni
  for select
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Admins can insert alumni" on public.alumni;
create policy "Admins can insert alumni"
  on public.alumni
  for insert
  to authenticated
  with check (public.is_site_admin());

drop policy if exists "Admins can update alumni" on public.alumni;
create policy "Admins can update alumni"
  on public.alumni
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Admins can delete alumni" on public.alumni;
create policy "Admins can delete alumni"
  on public.alumni
  for delete
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Admins can select audit logs" on public.audit_logs;
create policy "Admins can select audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_site_admin());

drop policy if exists "Admins can insert audit logs" on public.audit_logs;
create policy "Admins can insert audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.is_site_admin());

-- Optional: prevent clients from updating/deleting audit history
drop policy if exists "No update audit logs" on public.audit_logs;
-- (no update/delete policies = admins cannot modify or erase audit rows via anon key)
