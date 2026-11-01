-- Pending approval for new registrations.
-- Run in Supabase → SQL Editor → Run.
-- Existing visitor, admin, and super_admin accounts stay as they are.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('visitor', 'pending', 'rejected', 'admin', 'super_admin'));

alter table public.profiles alter column role set default 'pending';

comment on column public.profiles.role is
  'pending = waiting for approval; rejected = application rejected; visitor = browse only; admin = back office; super_admin = can approve admins';

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

alter table public.login_logs drop constraint if exists login_logs_role_check;
alter table public.login_logs
  add constraint login_logs_role_check
  check (role in ('visitor', 'pending', 'rejected', 'admin', 'super_admin'));
