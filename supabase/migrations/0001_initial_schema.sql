-- 0001_initial_schema.sql
-- Booking engine core schema — business-agnostic and reusable across tenants.
--
-- One tenant per deployment: tenant-level values (currency, active waiver
-- version) live in application config, NOT in the database. The schema uses
-- generic entities (services, sessions, customers, bookings, waivers) so it
-- fits any business, not just The Tide House.

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- Enums --------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum ('pending', 'confirmed', 'cancelled');
  end if;
end
$$;

-- updated_at helper --------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- services -----------------------------------------------------------------
-- A bookable offering type (e.g. a 60-minute sauna). Generic on purpose.
create table if not exists services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  duration_minutes integer not null check (duration_minutes > 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists services_set_updated_at on services;
create trigger services_set_updated_at
  before update on services
  for each row execute function set_updated_at();

-- sessions -----------------------------------------------------------------
-- A concrete, schedulable slot of a service. Each session carries its OWN
-- editable price in integer minor units (e.g. pence). Currency is supplied by
-- tenant config, so it is deliberately NOT stored per row. When sessions are
-- later generated from templates, the template price is copied here and stays
-- independently editable — the session is the source of truth for its price.
--
-- `capacity` is the maximum number of spots that can be booked on this
-- session. Remaining spots are derived from bookings (see session_availability
-- view below), never stored, so they can't drift out of sync.
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references services (id) on delete restrict,
  starts_at   timestamptz not null,
  capacity    integer not null check (capacity >= 0),
  price_minor integer not null check (price_minor >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sessions_starts_at_idx  on sessions (starts_at);
create index if not exists sessions_service_id_idx on sessions (service_id);

drop trigger if exists sessions_set_updated_at on sessions;
create trigger sessions_set_updated_at
  before update on sessions
  for each row execute function set_updated_at();

-- customers ----------------------------------------------------------------
-- No customer accounts in the MVP — a customer is a contact record created at
-- booking time. Waivers link here (see below).
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  first_name text not null,
  last_name  text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one customer per email, case-insensitive
create unique index if not exists customers_email_unique on customers (lower(email));

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- bookings -----------------------------------------------------------------
-- A customer holding one or more spots on a session. unit_price_minor is a
-- SNAPSHOT of the session price at booking time, so later price edits never
-- rewrite historical bookings. total_minor is derived and always consistent.
create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions (id) on delete restrict,
  customer_id      uuid not null references customers (id) on delete restrict,
  quantity         integer not null default 1 check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  total_minor      integer generated always as (quantity * unit_price_minor) stored,
  status           booking_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bookings_session_id_idx  on bookings (session_id);
create index if not exists bookings_customer_id_idx on bookings (customer_id);

drop trigger if exists bookings_set_updated_at on bookings;
create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- waivers ------------------------------------------------------------------
-- One-time per customer and versioned. A waiver links to the CUSTOMER, never
-- to a booking or session. The active waiver version lives in tenant config;
-- a customer must (re)sign only when they have not signed the active version.
-- The unique (customer_id, version) constraint enforces one signature per
-- version per customer.
create table if not exists waivers (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers (id) on delete cascade,
  version        integer not null check (version > 0),
  signed_at      timestamptz not null default now(),
  signature_name text not null,
  created_at     timestamptz not null default now(),
  unique (customer_id, version)
);

create index if not exists waivers_customer_id_idx on waivers (customer_id);

-- Row Level Security -------------------------------------------------------
-- Public availability (active services + sessions) is readable with the anon
-- key. Customers, bookings, and waivers have RLS enabled with NO anon/auth
-- policies, so they are denied by default; server code uses the service role,
-- which bypasses RLS.
alter table services  enable row level security;
alter table sessions  enable row level security;
alter table customers enable row level security;
alter table bookings  enable row level security;
alter table waivers   enable row level security;

drop policy if exists "public reads active services" on services;
create policy "public reads active services"
  on services for select
  using (is_active);

drop policy if exists "public reads active sessions" on sessions;
create policy "public reads active sessions"
  on sessions for select
  using (is_active);

-- Derived availability -----------------------------------------------------
-- Remaining spots per session, computed from bookings. Cancelled bookings do
-- NOT consume capacity (we never delete bookings to free space — status is the
-- source of truth). Read server-side via the service role; keeps the count
-- always consistent with actual bookings instead of storing a mutable counter.
create or replace view session_availability as
select
  s.id       as session_id,
  s.capacity as capacity,
  coalesce(
    sum(b.quantity) filter (where b.status <> 'cancelled'), 0
  )::int as booked_spaces,
  greatest(
    s.capacity - coalesce(
      sum(b.quantity) filter (where b.status <> 'cancelled'), 0
    ),
    0
  )::int as remaining_spaces
from sessions s
left join bookings b on b.session_id = s.id
group by s.id, s.capacity;
