-- 0002_passes_and_idempotency.sql
-- Makes the schema pass-ready and session generation idempotent.
--
-- NOTE: the `passes` table and `bookings.pass_id` are added now so the 10-visit
-- block offer slots in later WITHOUT reworking bookings. The purchase/redemption
-- flow is NOT built yet — these are schema only.

-- passes -------------------------------------------------------------------
-- A prepaid bundle purchased by a customer (e.g. 10 visits for £80). Credits
-- are decremented as sessions are booked against the pass. Redeemed by email
-- (no customer accounts in the MVP).
create table if not exists passes (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers (id) on delete cascade,
  bundle_id         text not null, -- matches a bundle id in tenant config
  total_credits     integer not null check (total_credits > 0),
  remaining_credits integer not null check (remaining_credits >= 0),
  price_paid_minor  integer not null check (price_paid_minor >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint passes_remaining_lte_total check (remaining_credits <= total_credits)
);

create index if not exists passes_customer_id_idx on passes (customer_id);

drop trigger if exists passes_set_updated_at on passes;
create trigger passes_set_updated_at
  before update on passes
  for each row execute function set_updated_at();

alter table passes enable row level security;
-- No anon/auth policies: reached only via the service role.

-- bookings.pass_id ---------------------------------------------------------
-- A booking redeemed via a pass references it here; a pass-redeemed booking
-- records £0 and decrements a credit. Nullable — PAYGO bookings leave it null.
alter table bookings
  add column if not exists pass_id uuid references passes (id) on delete set null;

create index if not exists bookings_pass_id_idx on bookings (pass_id);

-- Idempotent session generation -------------------------------------------
-- One session per (service, start time), so generation can safely
-- `insert ... on conflict (service_id, starts_at) do nothing` — re-running
-- never duplicates slots and never clobbers per-session price/capacity edits.
create unique index if not exists sessions_service_starts_unique
  on sessions (service_id, starts_at);
