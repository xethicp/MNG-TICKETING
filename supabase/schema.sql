-- MNG TICKETING: production-oriented starting schema
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('customer','reseller','scanner','support','marketing','finance','event_manager','admin','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.event_status as enum ('draft','published','sold_out','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('reserved','paid','issued','used','cancelled','refunded','invalid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('created','authorized','captured','failed','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  description text,
  artist text,
  venue text,
  location text,
  event_date date,
  start_time time,
  hero_image_url text,
  poster_image_url text,
  mobile_banner_url text,
  tags text[] not null default '{}',
  status public.event_status not null default 'draft',
  featured boolean not null default false,
  show_on_home boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pass_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_paise bigint not null check (price_paise >= 0),
  inventory integer not null check (inventory >= 0),
  sold integer not null default 0 check (sold >= 0),
  sales_start timestamptz,
  sales_end timestamptz,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  partner_code text unique not null,
  display_name text not null,
  phone text,
  status text not null default 'active' check (status in ('active','suspended','inactive')),
  commission_type text not null default 'fixed' check (commission_type in ('fixed','percentage','custom')),
  commission_value numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reseller_event_access (
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  enabled boolean not null default true,
  primary key (reseller_id,event_id)
);

create table if not exists public.reseller_pass_pricing (
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  pass_type_id uuid not null references public.pass_types(id) on delete cascade,
  price_paise bigint,
  commission_paise bigint,
  primary key (reseller_id,pass_type_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references public.profiles(id),
  reseller_id uuid references public.resellers(id),
  event_id uuid not null references public.events(id),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  amount_paise bigint not null check (amount_paise >= 0),
  payment_status public.payment_status not null default 'created',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  pass_type_id uuid not null references public.pass_types(id) on delete restrict,
  ticket_number text unique not null,
  qr_token text unique not null default encode(gen_random_bytes(24),'hex'),
  status public.ticket_status not null default 'reserved',
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  pass_type_id uuid not null references public.pass_types(id) on delete cascade,
  old_price_paise bigint,
  new_price_paise bigint not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- IMPORTANT: enable RLS on all exposed tables.
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.pass_types enable row level security;
alter table public.resellers enable row level security;
alter table public.reseller_event_access enable row level security;
alter table public.reseller_pass_pricing enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.price_history enable row level security;
alter table public.audit_logs enable row level security;

-- Public storefront can read published events and active pass types.
create policy "public read published events" on public.events for select using (status = 'published');
create policy "public read active passes" on public.pass_types for select using (active = true and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));

-- All checkout mutations and privileged admin/reseller reads/writes should be
-- implemented through authenticated server functions with service-role keys.
-- Never put the service-role key in VITE_* variables.
