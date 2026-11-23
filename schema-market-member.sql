-- Marketplace members are approved separately from site admins.
-- role market can order, list items, and switch buyer/seller.
-- role market cannot pass is_site_admin() or open the announcement back office.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('visitor', 'pending', 'rejected', 'market', 'admin', 'super_admin'));

alter table public.profiles add column if not exists signup_channel text not null default 'site';
alter table public.profiles drop constraint if exists profiles_signup_channel_check;
alter table public.profiles add constraint profiles_signup_channel_check
  check (signup_channel in ('site', 'market'));

alter table public.login_logs drop constraint if exists login_logs_role_check;
alter table public.login_logs add constraint login_logs_role_check
  check (role in ('visitor', 'pending', 'rejected', 'market', 'admin', 'super_admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, signup_channel)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'pending',
    case when new.raw_user_meta_data->>'signup_channel' = 'market' then 'market' else 'site' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_market_member()
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
      and p.role in ('market', 'admin', 'super_admin')
  );
$$;

create or replace function public.keep_signup_channel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_super_admin() then
    new.signup_channel := old.signup_channel;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_signup_channel on public.profiles;
create trigger profiles_keep_signup_channel
before update on public.profiles
for each row
execute function public.keep_signup_channel();

grant execute on function public.is_market_member() to anon, authenticated;

drop policy if exists "Sellers insert own products" on public.market_products;
create policy "Sellers insert own products"
  on public.market_products
  for insert
  to authenticated
  with check (seller_id = auth.uid() and public.is_market_member());

drop policy if exists "Sellers update own products" on public.market_products;
create policy "Sellers update own products"
  on public.market_products
  for update
  to authenticated
  using (seller_id = auth.uid() and public.is_market_member())
  with check (seller_id = auth.uid() and public.is_market_member());

drop policy if exists "Sellers delete own products" on public.market_products;
create policy "Sellers delete own products"
  on public.market_products
  for delete
  to authenticated
  using (seller_id = auth.uid() and public.is_market_member());

notify pgrst, 'reload schema';
