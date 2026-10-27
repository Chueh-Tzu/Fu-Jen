-- imMBA Announcements / NEWS (sync AdminNews create & update)
-- Run in Supabase → SQL Editor → New query → Run
-- Requires: schema-auth.sql already applied (public.is_site_admin)

-- 1) Announcements table (matches assets/js/announcements.js fields)
create table if not exists public.announcements (
  id text primary key,
  date date not null,
  top boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  photo_url text,
  file_url text,
  file_name text,
  title_zh text not null default '',
  url_zh text,
  content_zh text,
  title_en text not null default '',
  url_en text,
  content_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.announcements is 'Bilingual NEWS / announcements for homepage + AdminNews';
comment on column public.announcements.id is 'Stable string id (e.g. official NID or generated id)';
comment on column public.announcements.published is 'false = hidden from homepage / news list';
comment on column public.announcements.sort_order is 'Lower numbers appear first';
comment on column public.announcements.photo_url is 'Public image URL (Storage or external)';
comment on column public.announcements.file_url is 'Optional attachment URL';

create index if not exists announcements_published_sort_idx
  on public.announcements (published, sort_order, date desc);
create index if not exists announcements_date_idx
  on public.announcements (date desc);
create index if not exists announcements_top_idx
  on public.announcements (top);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row
execute function public.set_updated_at();

-- 2) RLS
alter table public.announcements enable row level security;

-- Anyone can read published news (homepage / news.html)
drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (published = true or public.is_site_admin());

-- Admins manage all rows (including unpublished)
drop policy if exists "Admins can insert announcements" on public.announcements;
create policy "Admins can insert announcements"
  on public.announcements
  for insert
  to authenticated
  with check (public.is_site_admin());

drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
  on public.announcements
  for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
  on public.announcements
  for delete
  to authenticated
  using (public.is_site_admin());

-- 3) Seed default official imMBA news (same as site defaults)
-- Safe to re-run: on conflict do nothing
insert into public.announcements (
  id, date, top, published, sort_order,
  title_zh, url_zh, title_en, url_en
) values
  (
    '2689', '2026-08-19', true, true, 10,
    '(國際經管-全英MBA) 116甄試招生報名：2026/09/30-10/13',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2689',
    'Spring 2027, apply NOW!! (Sep 14 - Oct 14) - This track is open to international students only',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=187'
  ),
  (
    '2905', '2025-01-30', true, true, 20,
    '管理學院職涯平台-工作職缺',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2905',
    'College of Management Career Platform – Job Openings',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=398'
  ),
  (
    '3417', '2026-10-13', false, true, 30,
    '【下一站，澳洲黃金海岸？｜國際經管imMBA 與 Bond University 洽談 1+1 雙碩士合作】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3417',
    '【Next Stop: Australia''s Gold Coast? | imMBA × Bond University】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=428'
  ),
  (
    '3415', '2026-10-06', false, true, 40,
    '【國際經管 imMBA × UT Dallas｜雙碩士合作持續推進中】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3415',
    '【imMBA × UT Dallas | Dual Master''s Collaboration Moving Forward】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=426'
  ),
  (
    '3412', '2026-09-29', false, true, 50,
    '【 9/29 招生說明會重點回顧｜明天開始報名！】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3412',
    '【9/29 Admissions Info Session Recap｜Local Student Applications Open Tomorrow!】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=424'
  ),
  (
    '3408', '2026-09-22', false, true, 60,
    '【 碩士兩年，不只一個學位。】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3408',
    '【Two Years, More Than One Master''s Degree.】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=423'
  ),
  (
    '3402', '2026-09-15', false, true, 70,
    '【你身邊有正在考慮 MBA 的國際學生嗎？】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3402',
    '【International Students: Get to Know Fu Jen imMBA at Our Info Session!】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=422'
  ),
  (
    '3396', '2026-09-08', false, true, 80,
    '【碩士兩年，可以有多大可能？】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3396',
    '【How much is possible in two years?】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=421'
  ),
  (
    '3391', '2026-09-02', false, true, 90,
    '【90 Seconds with the Professor｜AI × Product】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3391',
    '【90 Seconds with the Professor｜AI × Product】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=420'
  ),
  (
    '3387', '2026-08-26', false, true, 100,
    '【New Course Spotlight｜Data Analytics for International Business】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3387',
    '【New Course Spotlight｜Data Analytics for International Business】',
    'https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=419'
  ),
  (
    '3383', '2026-08-19', false, true, 110,
    '【New Course Spotlight｜AI-Assisted Digital Product Development】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3383',
    '【New Course Spotlight｜AI-Assisted Digital Product Development】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3383'
  ),
  (
    '3379', '2026-08-05', false, true, 120,
    '【Summer Pause】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3379',
    '【Summer Pause】',
    'https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3379'
  )
on conflict (id) do nothing;
