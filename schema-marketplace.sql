-- C2C marketplace: listings, orders, and a flat platform fee.
-- Run in Supabase → SQL Editor → Run.
-- Existing visitor, admin, and super_admin accounts stay as they are.

create table if not exists public.market_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  seller_name text,
  seller_email text,
  name text not null,
  name_zh text,
  name_en text,
  category text not null default 'Other',
  description text not null default '',
  description_zh text,
  description_en text,
  price integer not null check (price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  image_url text,
  image_urls jsonb not null default '[]'::jsonb,
  video_url text,
  status text not null default 'listed' check (status in ('listed', 'hidden', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  buyer_name text,
  buyer_email text,
  seller_id uuid references auth.users (id) on delete set null,
  seller_name text,
  seller_email text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'payment_confirmed', 'ready_to_ship', 'shipped', 'arrived', 'completed', 'cancelled')),
  cancel_reason text
    check (cancel_reason is null or cancel_reason in ('not_wanted', 'too_expensive', 'wrong_address')),
  shipping_method text not null default 'pickup'
    check (shipping_method in ('pickup', 'delivery')),
  ship_date date,
  arrival_date date,
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  subtotal integer not null default 0,
  shipping_fee integer not null default 0,
  platform_fee integer not null default 0,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.market_orders (id) on delete cascade,
  product_id uuid references public.market_products (id) on delete set null,
  product_name text not null,
  product_name_zh text,
  product_name_en text,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);

create table if not exists public.market_settings (
  id integer primary key default 1 check (id = 1),
  platform_fee integer not null default 4 check (platform_fee >= 0)
);

insert into public.market_settings (id, platform_fee)
values (1, 4)
on conflict (id) do nothing;

alter table public.market_products add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.market_products drop constraint if exists market_products_image_urls_limit;
alter table public.market_products add constraint market_products_image_urls_limit
  check (jsonb_typeof(image_urls) = 'array' and jsonb_array_length(image_urls) <= 10);
update public.market_products
set image_urls = jsonb_build_array(image_url)
where coalesce(btrim(image_url), '') <> ''
  and image_urls = '[]'::jsonb;

create index if not exists market_products_seller_idx on public.market_products (seller_id);
create index if not exists market_products_status_idx on public.market_products (status);
create index if not exists market_orders_buyer_idx on public.market_orders (buyer_id);
create index if not exists market_orders_seller_idx on public.market_orders (seller_id);
create index if not exists market_orders_status_idx on public.market_orders (status);
create index if not exists market_order_items_order_idx on public.market_order_items (order_id);

drop trigger if exists market_products_set_updated_at on public.market_products;
create trigger market_products_set_updated_at
before update on public.market_products
for each row execute function public.set_updated_at();

drop trigger if exists market_orders_set_updated_at on public.market_orders;
create trigger market_orders_set_updated_at
before update on public.market_orders
for each row execute function public.set_updated_at();

alter table public.market_products enable row level security;
alter table public.market_orders enable row level security;
alter table public.market_order_items enable row level security;
alter table public.market_settings enable row level security;

drop policy if exists "Public reads listed products" on public.market_products;
create policy "Public reads listed products"
  on public.market_products
  for select
  to anon, authenticated
  using (
    (status = 'listed' and quantity > 0)
    or seller_id = auth.uid()
    or public.is_site_admin()
  );

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

create or replace function public.guard_market_member_product_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  select role into actor from public.profiles where id = auth.uid();
  if actor not in ('market', 'both') then
    return new;
  end if;
  if new.name is distinct from old.name
    or new.name_zh is distinct from old.name_zh
    or new.name_en is distinct from old.name_en
    or new.price is distinct from old.price
  then
    raise exception 'Marketplace members cannot change the name or price of a listing';
  end if;
  return new;
end;
$$;

drop trigger if exists market_products_guard_member_update on public.market_products;
create trigger market_products_guard_member_update
before update on public.market_products
for each row execute function public.guard_market_member_product_update();

revoke all on function public.guard_market_member_product_update() from public;
revoke all on function public.guard_market_member_product_update() from anon, authenticated;

drop policy if exists "Read related orders" on public.market_orders;
create policy "Read related orders"
  on public.market_orders
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or public.is_site_admin()
  );

drop policy if exists "Read related order items" on public.market_order_items;
create policy "Read related order items"
  on public.market_order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.market_orders o
      where o.id = order_id
        and (
          o.buyer_id = auth.uid()
          or o.seller_id = auth.uid()
          or public.is_site_admin()
        )
    )
  );

drop policy if exists "Read platform fee" on public.market_settings;
create policy "Read platform fee"
  on public.market_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Super admin sets platform fee" on public.market_settings;
create policy "Super admin sets platform fee"
  on public.market_settings
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.place_market_order(
  p_items jsonb,
  p_shipping text,
  p_recipient text default null,
  p_phone text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  buyer public.profiles%rowtype;
  item jsonb;
  prod public.market_products%rowtype;
  seller uuid;
  seller_name text;
  seller_email text;
  order_id uuid;
  subtotal integer := 0;
  ship integer := 0;
  fee integer := 0;
  qty integer;
  recipient text := nullif(btrim(coalesce(p_recipient, '')), '');
  phone text := nullif(btrim(coalesce(p_phone, '')), '');
  address text := nullif(btrim(coalesce(p_address, '')), '');
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  select * into buyer from public.profiles where id = uid;
  if buyer.id is null then
    raise exception 'Profile not found';
  end if;
  if not public.is_market_buyer() then
    raise exception 'This account is not approved for the marketplace';
  end if;
  if p_shipping not in ('pickup', 'delivery') then
    raise exception 'Invalid shipping method';
  end if;
  if p_shipping = 'delivery' then
    if recipient is null or phone is null or address is null then
      raise exception 'Delivery needs a recipient, phone, and address';
    end if;
    if char_length(recipient) > 80 or char_length(phone) > 30 or char_length(address) > 300 then
      raise exception 'Delivery details are too long';
    end if;
  else
    recipient := null;
    phone := null;
    address := null;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    qty := (item->>'quantity')::integer;
    select * into prod from public.market_products where id = (item->>'product_id')::uuid for update;
    if prod.id is null or prod.status <> 'listed' then
      raise exception 'A product is no longer available';
    end if;
    if qty is null or qty < 1 or qty > prod.quantity then
      raise exception 'Not enough stock';
    end if;
    if seller is null then
      seller := prod.seller_id;
      seller_name := prod.seller_name;
      seller_email := prod.seller_email;
    elsif seller <> prod.seller_id then
      raise exception 'Checkout one seller at a time';
    end if;
    subtotal := subtotal + prod.price * qty;
  end loop;

  ship := case when p_shipping = 'delivery' then 80 else 0 end;
  select platform_fee into fee from public.market_settings where id = 1;
  fee := coalesce(fee, 4);

  insert into public.market_orders (
    buyer_id, buyer_name, buyer_email,
    seller_id, seller_name, seller_email,
    status, shipping_method, subtotal, shipping_fee, platform_fee, total,
    recipient_name, recipient_phone, recipient_address
  ) values (
    uid, buyer.display_name, buyer.email,
    seller, seller_name, seller_email,
    'awaiting_payment', p_shipping, subtotal, ship, fee, subtotal + ship + fee,
    recipient, phone, address
  ) returning id into order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    qty := (item->>'quantity')::integer;
    select * into prod from public.market_products where id = (item->>'product_id')::uuid for update;
    insert into public.market_order_items (
      order_id, product_id, product_name, product_name_zh, product_name_en, unit_price, quantity
    ) values (
      order_id, prod.id, coalesce(prod.name_en, prod.name), prod.name_zh, coalesce(prod.name_en, prod.name), prod.price, qty
    );
    perform set_config('app.market_change', 'order', true);
    update public.market_products
    set quantity = quantity - qty
    where id = prod.id;
  end loop;

  return order_id;
end;
$$;

drop function if exists public.advance_market_order(uuid, text);

create or replace function public.advance_market_order(
  p_order uuid,
  p_next text,
  p_ship_date date default null,
  p_arrival_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_status text;
  seller uuid;
  asked text;
  placed date;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  select status, seller_id, cancel_reason, (created_at at time zone 'Asia/Taipei')::date
    into current_status, seller, asked, placed
  from public.market_orders
  where id = p_order
  for update;
  if seller is null or seller <> uid then
    raise exception 'Only the seller can update this order';
  end if;
  if asked is not null and current_status <> 'cancelled' then
    if p_next = 'shipped' and current_status in ('awaiting_payment', 'payment_confirmed', 'ready_to_ship') then
      update public.market_orders
      set status = 'shipped', cancel_reason = null
      where id = p_order;
      return;
    end if;
    raise exception 'This order is waiting for the seller to confirm cancellation';
  end if;
  if current_status = 'awaiting_payment' and p_next = 'payment_confirmed' then
    update public.market_orders set status = p_next where id = p_order;
  elsif current_status in ('payment_confirmed', 'ready_to_ship') and p_next = 'ready_to_ship' then
    if p_ship_date is null or p_arrival_date is null then
      raise exception 'Choose a ship date and an arrival date';
    end if;
    if p_ship_date < placed then
      raise exception 'The ship date cannot be before the order date';
    end if;
    if p_arrival_date < placed + 1 then
      raise exception 'The arrival date must be at least the day after the order';
    end if;
    if p_arrival_date < p_ship_date then
      raise exception 'The arrival date must be on or after the ship date';
    end if;
    update public.market_orders
    set status = 'ready_to_ship', ship_date = p_ship_date, arrival_date = p_arrival_date
    where id = p_order;
  elsif current_status = 'ready_to_ship' and p_next = 'shipped' then
    update public.market_orders set status = p_next where id = p_order;
  elsif current_status = 'shipped' and p_next = 'arrived' then
    update public.market_orders set status = p_next where id = p_order;
  elsif current_status = 'arrived' and p_next = 'completed' then
    update public.market_orders set status = p_next where id = p_order;
  else
    raise exception 'This status change is not allowed';
  end if;
end;
$$;

alter table public.market_orders drop constraint if exists market_orders_status_check;
alter table public.market_orders add constraint market_orders_status_check
  check (status in ('awaiting_payment', 'payment_confirmed', 'ready_to_ship', 'shipped', 'arrived', 'completed', 'cancelled'));
alter table public.market_orders add column if not exists ship_date date;
alter table public.market_orders add column if not exists arrival_date date;
alter table public.market_orders add column if not exists cancel_reason text;
alter table public.market_orders drop constraint if exists market_orders_cancel_reason_check;
alter table public.market_orders add constraint market_orders_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('not_wanted', 'too_expensive', 'wrong_address'));

create or replace function public.cancel_market_order(p_order uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_status text;
  buyer uuid;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  if p_reason not in ('not_wanted', 'too_expensive', 'wrong_address') then
    raise exception 'Choose a cancellation reason';
  end if;
  select status, buyer_id into current_status, buyer
  from public.market_orders
  where id = p_order
  for update;
  if buyer is null or buyer <> uid then
    raise exception 'Only the buyer can cancel this order';
  end if;
  if current_status not in ('awaiting_payment', 'payment_confirmed', 'ready_to_ship') then
    raise exception 'This order can no longer be cancelled';
  end if;
  if exists (
    select 1 from public.market_orders
    where id = p_order and cancel_reason is not null
  ) then
    raise exception 'A cancellation request is already waiting';
  end if;
  update public.market_orders
  set cancel_reason = p_reason
  where id = p_order;
end;
$$;

create or replace function public.confirm_market_cancel(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_status text;
  seller uuid;
  asked text;
  line record;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  select status, seller_id, cancel_reason into current_status, seller, asked
  from public.market_orders
  where id = p_order
  for update;
  if seller is null or seller <> uid then
    raise exception 'Only the seller can confirm this cancellation';
  end if;
  if asked is null or current_status = 'cancelled' then
    raise exception 'There is no cancellation request';
  end if;
  if current_status not in ('awaiting_payment', 'payment_confirmed', 'ready_to_ship') then
    raise exception 'This order can no longer be cancelled';
  end if;
  for line in
    select product_id, quantity
    from public.market_order_items
    where order_id = p_order
  loop
    if line.product_id is not null then
      perform set_config('app.market_change', 'restock', true);
      update public.market_products
      set quantity = quantity + line.quantity
      where id = line.product_id;
    end if;
  end loop;
  update public.market_orders
  set status = 'cancelled'
  where id = p_order;
end;
$$;

revoke all on function public.place_market_order(jsonb, text, text, text, text) from public;
revoke all on function public.advance_market_order(uuid, text, date, date) from public;
revoke all on function public.cancel_market_order(uuid, text) from public;
revoke all on function public.confirm_market_cancel(uuid) from public;
grant execute on function public.place_market_order(jsonb, text, text, text, text) to authenticated;
grant execute on function public.advance_market_order(uuid, text, date, date) to authenticated;
grant execute on function public.cancel_market_order(uuid, text) to authenticated;
grant execute on function public.confirm_market_cancel(uuid) to authenticated;

grant select on public.market_products to anon, authenticated;
grant insert, update, delete on public.market_products to authenticated;
grant select on public.market_orders to authenticated;
grant select on public.market_order_items to authenticated;
grant select on public.market_settings to anon, authenticated;
grant update on public.market_settings to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market-photos',
  'market-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read market photos" on storage.objects;
create policy "Public read market photos"
  on storage.objects for select to public
  using (bucket_id = 'market-photos');

drop policy if exists "Market members upload product photos" on storage.objects;
create policy "Market members upload product photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'market-photos'
    and public.is_market_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Market members delete own product photos" on storage.objects;
create policy "Market members delete own product photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'market-photos'
    and public.is_market_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.market_change_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  seller_id uuid,
  seller_name text,
  product_id uuid,
  product_label text,
  action text not null,
  action_code text,
  actor_name text,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_change_logs_created_at_idx
  on public.market_change_logs (created_at desc);
create index if not exists market_change_logs_seller_idx
  on public.market_change_logs (seller_id, created_at desc);

alter table public.market_change_logs enable row level security;

drop policy if exists "Sellers read own change logs" on public.market_change_logs;
create policy "Sellers read own change logs"
  on public.market_change_logs
  for select
  to authenticated
  using (seller_id = auth.uid());

drop policy if exists "Super admins read all change logs" on public.market_change_logs;
create policy "Super admins read all change logs"
  on public.market_change_logs
  for select
  to authenticated
  using (public.is_super_admin());

revoke all on table public.market_change_logs from public, anon, authenticated;
grant select on public.market_change_logs to authenticated;

alter table public.market_change_logs add column if not exists action_code text;
alter table public.market_change_logs add column if not exists actor_name text;

create or replace function public.log_market_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diffs jsonb := '[]'::jsonb;
  row_data public.market_products;
  actor_name text;
  action_code text;
  reason text;
begin
  if tg_op = 'DELETE' then
    row_data := old;
    diffs := jsonb_build_array(
      jsonb_build_object('field', 'name_zh', 'from', old.name_zh),
      jsonb_build_object('field', 'price', 'from', old.price),
      jsonb_build_object('field', 'quantity', 'from', old.quantity),
      jsonb_build_object('field', 'status', 'from', old.status)
    );
  elsif tg_op = 'INSERT' then
    row_data := new;
    diffs := jsonb_build_array(
      jsonb_build_object('field', 'name_zh', 'to', new.name_zh),
      jsonb_build_object('field', 'name_en', 'to', new.name_en),
      jsonb_build_object('field', 'category', 'to', new.category),
      jsonb_build_object('field', 'description_zh', 'to', new.description_zh),
      jsonb_build_object('field', 'description_en', 'to', new.description_en),
      jsonb_build_object('field', 'price', 'to', new.price),
      jsonb_build_object('field', 'quantity', 'to', new.quantity),
      jsonb_build_object('field', 'image_url', 'to', new.image_url),
      jsonb_build_object('field', 'image_urls', 'to', new.image_urls),
      jsonb_build_object('field', 'video_url', 'to', new.video_url),
      jsonb_build_object('field', 'status', 'to', new.status)
    );
  else
    row_data := new;
    if new.name is distinct from old.name then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'name', 'from', old.name, 'to', new.name));
    end if;
    if new.name_zh is distinct from old.name_zh then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'name_zh', 'from', old.name_zh, 'to', new.name_zh));
    end if;
    if new.name_en is distinct from old.name_en then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'name_en', 'from', old.name_en, 'to', new.name_en));
    end if;
    if new.category is distinct from old.category then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'category', 'from', old.category, 'to', new.category));
    end if;
    if new.description is distinct from old.description then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'description', 'from', old.description, 'to', new.description));
    end if;
    if new.description_zh is distinct from old.description_zh then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'description_zh', 'from', old.description_zh, 'to', new.description_zh));
    end if;
    if new.description_en is distinct from old.description_en then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'description_en', 'from', old.description_en, 'to', new.description_en));
    end if;
    if new.price is distinct from old.price then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'price', 'from', old.price, 'to', new.price));
    end if;
    if new.quantity is distinct from old.quantity then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'quantity', 'from', old.quantity, 'to', new.quantity));
    end if;
    if new.image_url is distinct from old.image_url then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'image_url', 'from', old.image_url, 'to', new.image_url));
    end if;
    if new.image_urls is distinct from old.image_urls then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'image_urls', 'from', old.image_urls, 'to', new.image_urls));
    end if;
    if new.video_url is distinct from old.video_url then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'video_url', 'from', old.video_url, 'to', new.video_url));
    end if;
    if new.status is distinct from old.status then
      diffs := diffs || jsonb_build_array(jsonb_build_object('field', 'status', 'from', old.status, 'to', new.status));
    end if;
    if diffs = '[]'::jsonb then
      return new;
    end if;
  end if;

  reason := nullif(current_setting('app.market_change', true), '');
  if reason is null and tg_op = 'UPDATE' and new.quantity < old.quantity and exists (
    select 1
    from public.market_order_items i
    join public.market_orders o on o.id = i.order_id
    where i.product_id = new.id
      and o.buyer_id is not distinct from auth.uid()
      and o.created_at = transaction_timestamp()
  ) then
    reason := 'order';
  end if;
  select display_name into actor_name from public.profiles where id = auth.uid();
  actor_name := coalesce(nullif(btrim(actor_name), ''), row_data.seller_name, '會員');
  if reason = 'order' then
    action_code := 'order';
  elsif reason = 'restock' then
    action_code := 'restock';
  elsif tg_op = 'INSERT' then
    action_code := 'create';
  elsif tg_op = 'DELETE' then
    action_code := 'delete';
  elsif jsonb_array_length(diffs) = 1 and diffs->0->>'field' = 'status' and diffs->0->>'to' = 'hidden' then
    action_code := 'unlist';
  elsif jsonb_array_length(diffs) = 1 and diffs->0->>'field' = 'status' and diffs->0->>'to' = 'listed' then
    action_code := 'relist';
  elsif jsonb_array_length(diffs) = 1 and diffs->0->>'field' = 'quantity' then
    action_code := 'quantity';
  elsif jsonb_array_length(diffs) = 1 and diffs->0->>'field' = 'price' then
    action_code := 'price';
  elsif exists (
    select 1 from jsonb_array_elements(diffs) as item
    where item->>'field' = 'status' and item->>'to' = 'listed'
  ) and not exists (
    select 1 from jsonb_array_elements(diffs) as item
    where item->>'field' not in ('status', 'quantity')
  ) then
    action_code := 'relist';
  else
    action_code := 'edit';
  end if;

  insert into public.market_change_logs (
    actor_id, seller_id, seller_name, actor_name, product_id, product_label, action, action_code, changes
  ) values (
    auth.uid(),
    row_data.seller_id,
    row_data.seller_name,
    actor_name,
    row_data.id,
    coalesce(row_data.name_zh, row_data.name, row_data.name_en),
    tg_op,
    action_code,
    diffs
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists market_products_log_changes on public.market_products;
create trigger market_products_log_changes
after insert or update or delete on public.market_products
for each row execute function public.log_market_product_change();

revoke all on function public.log_market_product_change() from public, anon, authenticated;
