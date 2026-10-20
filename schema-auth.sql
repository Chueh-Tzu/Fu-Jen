-- imMBA Authentication + Admin roles
-- Run in Supabase → SQL Editor → Run
-- Roles: pending | admin | super_admin

-- 1) Profiles (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'pending'
    check (role in ('pending', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Admin access roles for the imMBA teaching site';
comment on column public.profiles.role is 'pending = awaiting approval; admin = content manager; super_admin = can approve admins';

create index if not exists profiles_role_idx on public.profiles (role);

-- 2) updated_at trigger (reuse helper if present)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- 3) Auto-create profile as pending on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 4) Helper: is current user an approved admin?
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

-- 5) RLS on profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() and role = 'pending');

drop policy if exists "Users can update own display name" on public.profiles;
create policy "Users can update own display name"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "Super admin can update roles" on public.profiles;
create policy "Super admin can update roles"
  on public.profiles
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- 6) Lock down faculty writes (remove class temp anon policies)
drop policy if exists "Temp anon can insert faculty" on public.faculty;
drop policy if exists "Temp anon can update faculty" on public.faculty;
drop policy if exists "Temp anon can delete faculty" on public.faculty;
drop policy if exists "Authenticated can insert faculty" on public.faculty;
drop policy if exists "Authenticated can update faculty" on public.faculty;
drop policy if exists "Authenticated can delete faculty" on public.faculty;

drop policy if exists "Admins can insert faculty" on public.faculty;
create policy "Admins can insert faculty"
  on public.faculty
  for insert
  to authenticated
  with check (public.is_site_admin());

drop policy if exists "Admins can update faculty" on public.faculty;
create policy "Admins can update faculty"
  on public.faculty
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Admins can delete faculty" on public.faculty;
create policy "Admins can delete faculty"
  on public.faculty
  for delete
  to authenticated
  using (public.is_site_admin());

-- Keep public read if present
drop policy if exists "Public can read faculty" on public.faculty;
create policy "Public can read faculty"
  on public.faculty
  for select
  to anon, authenticated
  using (true);

-- 7) Lock down Storage writes to admins (keep public read)
drop policy if exists "Anyone can upload faculty photos" on storage.objects;
drop policy if exists "Anyone can update faculty photos" on storage.objects;
drop policy if exists "Anyone can delete faculty photos" on storage.objects;

drop policy if exists "Admins can upload faculty photos" on storage.objects;
create policy "Admins can upload faculty photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'faculty-photos' and public.is_site_admin());

drop policy if exists "Admins can update faculty photos" on storage.objects;
create policy "Admins can update faculty photos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'faculty-photos' and public.is_site_admin())
  with check (bucket_id = 'faculty-photos' and public.is_site_admin());

drop policy if exists "Admins can delete faculty photos" on storage.objects;
create policy "Admins can delete faculty photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'faculty-photos' and public.is_site_admin());

-- Public read for photos (if missing)
drop policy if exists "Public read faculty photos" on storage.objects;
create policy "Public read faculty photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'faculty-photos');

-- ---------------------------------------------------------------
-- AFTER you register your first account in the website login page,
-- promote yourself to super_admin in SQL Editor (replace email):
--
--   update public.profiles
--   set role = 'super_admin'
--   where email = 'your@email.com';
-- ---------------------------------------------------------------
