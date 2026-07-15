-- 0011_transactions.sql
-- Accounting view: money movements by PAYMENT date (not session date), unifying
-- session bookings and pass sales so the venue can reconcile against Stripe.

-- When a booking was actually paid. Falls back to created_at for anything that
-- predates this column (payment ~= creation in every existing flow).
alter table bookings add column if not exists paid_at timestamptz;

update bookings
set paid_at = created_at
where paid_at is null
  and payment_status in ('paid', 'complimentary', 'refunded');

create index if not exists bookings_paid_at_idx on bookings (paid_at);
create index if not exists passes_created_at_idx on passes (created_at);

-- Unified transactions within a payment-date range. Bookings use paid_at
-- (falling back to created_at); pass sales use their purchase time. Pass
-- redemptions appear as £0 bookings, so revenue never double-counts.
create or replace function admin_transactions(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  kind              text,
  occurred_at       timestamptz,
  customer_name     text,
  email             text,
  phone             text,
  session_starts_at timestamptz,
  quantity          int,
  amount_minor      int,
  payment_status    text,
  status            text,
  reference         text,
  stripe_ref        text
)
language sql
stable
as $$
  select
    'booking'::text,
    coalesce(b.paid_at, b.created_at),
    btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
    coalesce(c.email, ''),
    coalesce(c.phone, ''),
    s.starts_at,
    b.quantity,
    b.total_minor,
    b.payment_status::text,
    b.status::text,
    left(b.id::text, 8),
    coalesce(b.payment_ref, '')
  from bookings b
  join sessions s on s.id = b.session_id
  left join customers c on c.id = b.customer_id
  where b.payment_status in ('paid', 'complimentary', 'refunded')
    and coalesce(b.paid_at, b.created_at) >= p_from
    and coalesce(b.paid_at, b.created_at) <  p_to

  union all

  select
    'pass'::text,
    p.created_at,
    btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
    coalesce(c.email, ''),
    coalesce(c.phone, ''),
    null::timestamptz,
    p.total_credits,
    p.price_paid_minor,
    'paid'::text,
    'confirmed'::text,
    left(p.id::text, 8),
    coalesce(p.purchase_ref, '')
  from passes p
  left join customers c on c.id = p.customer_id
  where p.created_at >= p_from
    and p.created_at <  p_to

  order by 2;
$$;

revoke all on function admin_transactions(timestamptz, timestamptz) from public;
grant execute on function admin_transactions(timestamptz, timestamptz) to service_role;
