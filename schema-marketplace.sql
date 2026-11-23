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
  with check (seller_id = auth.uid());

drop policy if exists "Sellers update own products" on public.market_products;
create policy "Sellers update own products"
  on public.market_products
  for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "Sellers delete own products" on public.market_products;
create policy "Sellers delete own products"
  on public.market_products
  for delete
  to authenticated
  using (seller_id = auth.uid());

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
  if buyer.role = 'rejected' then
    raise exception 'This account cannot place orders';
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
    update public.market_products
    set quantity = quantity - qty
    where id = prod.id;
  end loop;

  return order_id;
end;
$$;

create or replace function public.advance_market_order(p_order uuid, p_next text)
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
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  select status, seller_id, cancel_reason into current_status, seller, asked
  from public.market_orders
  where id = p_order
  for update;
  if seller is null or seller <> uid then
    raise exception 'Only the seller can update this order';
  end if;
  if asked is not null and current_status <> 'cancelled' then
    raise exception 'This order is waiting for the seller to confirm cancellation';
  end if;
  if current_status = 'awaiting_payment' and p_next = 'payment_confirmed' then
    update public.market_orders set status = p_next where id = p_order;
  elsif current_status = 'payment_confirmed' and p_next = 'ready_to_ship' then
    update public.market_orders set status = p_next where id = p_order;
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
revoke all on function public.advance_market_order(uuid, text) from public;
revoke all on function public.cancel_market_order(uuid, text) from public;
revoke all on function public.confirm_market_cancel(uuid) from public;
grant execute on function public.place_market_order(jsonb, text, text, text, text) to authenticated;
grant execute on function public.advance_market_order(uuid, text) to authenticated;
grant execute on function public.cancel_market_order(uuid, text) to authenticated;
grant execute on function public.confirm_market_cancel(uuid) to authenticated;

grant select on public.market_products to anon, authenticated;
grant insert, update, delete on public.market_products to authenticated;
grant select on public.market_orders to authenticated;
grant select on public.market_order_items to authenticated;
grant select on public.market_settings to anon, authenticated;
grant update on public.market_settings to authenticated;
