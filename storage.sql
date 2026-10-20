-- imMBA Faculty photo storage
-- Run in Supabase → SQL Editor → New query → Run
-- Success usually shows: Success. No rows returned.

-- 1) Public bucket for faculty photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faculty-photos',
  'faculty-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies (drop + recreate so re-running is safe)
drop policy if exists "Public read faculty photos" on storage.objects;
create policy "Public read faculty photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'faculty-photos');

drop policy if exists "Anyone can upload faculty photos" on storage.objects;
create policy "Anyone can upload faculty photos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'faculty-photos');

drop policy if exists "Anyone can update faculty photos" on storage.objects;
create policy "Anyone can update faculty photos"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'faculty-photos')
  with check (bucket_id = 'faculty-photos');

drop policy if exists "Anyone can delete faculty photos" on storage.objects;
create policy "Anyone can delete faculty photos"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'faculty-photos');

-- Note: these write policies are open for class setup (same idea as temp faculty table policies).
-- After Authentication is added, restrict insert/update/delete to authenticated admins only.
