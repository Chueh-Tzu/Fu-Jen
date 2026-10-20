-- Add bilingual faculty columns (safe to re-run)
-- Supabase → SQL Editor → Run
-- Keeps existing rows and photos (image_url unchanged)

alter table public.faculty add column if not exists name_zh text;
alter table public.faculty add column if not exists name_en text;
alter table public.faculty add column if not exists title_zh text;
alter table public.faculty add column if not exists title_en text;
alter table public.faculty add column if not exists education_zh text;
alter table public.faculty add column if not exists education_en text;
alter table public.faculty add column if not exists research_fields_zh text;
alter table public.faculty add column if not exists research_fields_en text;
alter table public.faculty add column if not exists phone_zh text;
alter table public.faculty add column if not exists phone_en text;

-- Backfill English from legacy single-language columns when empty
update public.faculty set name_en = name where coalesce(name_en, '') = '' and coalesce(name, '') <> '';
update public.faculty set title_en = title where coalesce(title_en, '') = '' and coalesce(title, '') <> '';
update public.faculty set education_en = education where coalesce(education_en, '') = '' and coalesce(education, '') <> '';
update public.faculty set research_fields_en = research_fields where coalesce(research_fields_en, '') = '' and coalesce(research_fields, '') <> '';
update public.faculty set phone_en = phone where coalesce(phone_en, '') = '' and coalesce(phone, '') <> '';
