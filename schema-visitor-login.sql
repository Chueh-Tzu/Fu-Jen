-- Visitor role + login overview
-- Run once in Supabase → SQL Editor → Run
-- Safe to re-run.

-- Do not re-run this file after schema-pending-role.sql.
-- Re-running the role section below would be outdated; new accounts use pending.

-- 1) Historical note: unapproved accounts were visitors before the pending workflow.

comment on column public.profiles.role is
  'visitor = browse, forms, and search only; admin = backend editor; super_admin = can change roles';

-- 2) New accounts stay pending until a super admin approves them
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, profile_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'pending',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() and role in ('visitor', 'pending'));

-- 3) Login overview (name, account, time, role)
create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  display_name text,
  email text,
  role text not null
    check (role in ('visitor', 'admin', 'super_admin')),
  logged_in_at timestamptz not null default now()
);

comment on table public.login_logs is 'One row each time someone signs in';

create index if not exists login_logs_logged_in_at_idx
  on public.login_logs (logged_in_at desc);

alter table public.login_logs enable row level security;

drop policy if exists "Signed-in users insert own login log" on public.login_logs;
create policy "Signed-in users insert own login log"
  on public.login_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can read login logs" on public.login_logs;
create policy "Admins can read login logs"
  on public.login_logs
  for select
  to authenticated
  using (public.is_site_admin());
