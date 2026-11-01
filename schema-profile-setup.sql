-- First-time back-office profile (run after schema-auth.sql)
-- Existing accounts stay complete. New registrations must fill the profile once.

alter table public.profiles
  add column if not exists student_id text,
  add column if not exists department text,
  add column if not exists degree_program text,
  add column if not exists admission_year integer,
  add column if not exists graduation_year integer,
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists job_title text,
  add column if not exists profile_completed boolean not null default true;

comment on column public.profiles.profile_completed is 'false until the user finishes the first back-office profile form';
comment on column public.profiles.degree_program is 'Bachelor | Master | Doctoral | Other';
comment on column public.profiles.admission_year is 'ROC year (100-120) or western year';

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
    'visitor',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
