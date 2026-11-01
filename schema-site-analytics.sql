-- Site browsing stats for the admin Database page
-- Run once in Supabase → SQL Editor → Run
-- Safe to re-run.

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  event_type text not null
    check (event_type in ('pageview', 'click', 'duration')),
  path text,
  label text,
  href text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  constraint site_events_duration_check
    check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 7200)),
  constraint site_events_visitor_len_check
    check (char_length(visitor_id) between 8 and 80 and char_length(session_id) between 8 and 80)
);

comment on table public.site_events is
  'Anonymous page views, content clicks, and time on site for the admin Database page';

create index if not exists site_events_created_at_idx
  on public.site_events (created_at desc);

create index if not exists site_events_type_idx
  on public.site_events (event_type);

alter table public.site_events enable row level security;

drop policy if exists "Anyone can insert site events" on public.site_events;
create policy "Anyone can insert site events"
  on public.site_events
  for insert
  to anon, authenticated
  with check (
    event_type in ('pageview', 'click', 'duration')
    and char_length(visitor_id) between 8 and 80
    and char_length(session_id) between 8 and 80
    and (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 7200))
  );

drop policy if exists "Admins can read site events" on public.site_events;
create policy "Admins can read site events"
  on public.site_events
  for select
  to authenticated
  using (public.is_site_admin());

grant insert on public.site_events to anon, authenticated;
grant select on public.site_events to authenticated;
