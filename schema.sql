-- imMBA Faculty schema
-- Run this in Supabase → SQL Editor → New query → Run
-- Success usually shows: Success. No rows returned.

-- 1) Faculty table (教職員資料表)
create table if not exists public.faculty (
  id bigserial primary key,
  name text not null,
  title text,
  education text,
  research_fields text,
  email text,
  phone text,
  website text,
  image_url text,
  category text not null default 'full'
    check (category in ('full', 'adjunct')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.faculty is 'imMBA faculty profiles for front-end + AdminFaculty';
comment on column public.faculty.category is 'full = 專任, adjunct = 兼任';
comment on column public.faculty.sort_order is 'Lower numbers appear first';
comment on column public.faculty.image_url is 'Public URL from Supabase Storage (or external URL)';

-- 2) Keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists faculty_set_updated_at on public.faculty;
create trigger faculty_set_updated_at
before update on public.faculty
for each row
execute function public.set_updated_at();

-- 3) Helpful indexes for listing / reorder
create index if not exists faculty_category_sort_idx
  on public.faculty (category, sort_order);

create index if not exists faculty_sort_idx
  on public.faculty (sort_order);

-- 4) Row Level Security
-- Visitors can read; writes will be locked down further when Auth is added.
alter table public.faculty enable row level security;

drop policy if exists "Public can read faculty" on public.faculty;
create policy "Public can read faculty"
  on public.faculty
  for select
  to anon, authenticated
  using (true);

-- Temporary open write policies for class setup (CRUD + reorder).
-- Replace these later with admin-only policies after Authentication is enabled.
drop policy if exists "Authenticated can insert faculty" on public.faculty;
create policy "Authenticated can insert faculty"
  on public.faculty
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update faculty" on public.faculty;
create policy "Authenticated can update faculty"
  on public.faculty
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete faculty" on public.faculty;
create policy "Authenticated can delete faculty"
  on public.faculty
  for delete
  to authenticated
  using (true);

-- Optional: allow anon writes only while building AdminFaculty without Auth yet.
-- Comment these three policies out after login is working.
drop policy if exists "Temp anon can insert faculty" on public.faculty;
create policy "Temp anon can insert faculty"
  on public.faculty
  for insert
  to anon
  with check (true);

drop policy if exists "Temp anon can update faculty" on public.faculty;
create policy "Temp anon can update faculty"
  on public.faculty
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Temp anon can delete faculty" on public.faculty;
create policy "Temp anon can delete faculty"
  on public.faculty
  for delete
  to anon
  using (true);
