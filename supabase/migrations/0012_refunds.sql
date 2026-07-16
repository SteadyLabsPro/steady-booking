-- 0012_refunds.sql
-- Refund reconciliation. Stripe is the source of truth: when a refund happens
-- there, a charge.refunded webhook nets it out here so our figures match
-- Stripe. Refunds reference the PaymentIntent (not the checkout session), so we
-- stamp payment_intent_id at completion to match them back.

alter table bookings add column if not exists payment_intent_id text;
alter table bookings add column if not exists refunded_minor integer not null default 0
  check (refunded_minor >= 0);
alter table passes add column if not exists payment_intent_id text;
alter table passes add column if not exists refunded_minor integer not null default 0
  check (refunded_minor >= 0);

create index if not exists bookings_payment_intent_idx on bookings (payment_intent_id);
create index if not exists passes_payment_intent_idx on passes (payment_intent_id);

-- Revenue = money actually kept (net of refunds). Counts anything paid,
-- regardless of a booking's confirmed/cancelled status — Stripe only knows
-- paid vs refunded, so this reconciles with it (a cancelled-but-not-refunded
-- booking is money kept; a refund reduces the net).
create or replace function admin_revenue_summary(p_tz text)
returns table (
  today_minor bigint,
  week_minor  bigint,
  month_minor bigint,
  year_minor  bigint
)
language sql
stable
as $$
  with revenue as (
    select (b.total_minor - b.refunded_minor) as amount, s.starts_at as ts
    from bookings b
    join sessions s on s.id = b.session_id
    where b.payment_status in ('paid', 'refunded')
    union all
    select (p.price_paid_minor - p.refunded_minor) as amount, p.created_at as ts
    from passes p
  )
  select
    coalesce(sum(amount) filter (
      where (ts at time zone p_tz)::date = (now() at time zone p_tz)::date
    ), 0)::bigint,
    coalesce(sum(amount) filter (
      where date_trunc('week', ts at time zone p_tz)
          = date_trunc('week', now() at time zone p_tz)
    ), 0)::bigint,
    coalesce(sum(amount) filter (
      where date_trunc('month', ts at time zone p_tz)
          = date_trunc('month', now() at time zone p_tz)
    ), 0)::bigint,
    coalesce(sum(amount) filter (
      where date_trunc('year', ts at time zone p_tz)
          = date_trunc('year', now() at time zone p_tz)
    ), 0)::bigint
  from revenue;
$$;

-- Transactions now expose the refunded amount so the list/CSV/Taken can net it.
-- Return shape changed (added refunded_minor), so drop before recreating.
drop function if exists admin_transactions(timestamptz, timestamptz);

create function admin_transactions(
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
  refunded_minor    int,
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
    b.refunded_minor,
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
    p.refunded_minor,
    case
      when p.refunded_minor >= p.price_paid_minor and p.price_paid_minor > 0
      then 'refunded' else 'paid'
    end,
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

-- record_pass_purchase now also stores the PaymentIntent id, so a pass refund
-- can be matched back to the pass.
drop function if exists record_pass_purchase(text, text, text, text, text, int, int, int, text);

create or replace function record_pass_purchase(
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_bundle_id        text,
  p_total_credits    int,
  p_price_paid_minor int,
  p_valid_months     int,
  p_purchase_ref     text,
  p_payment_intent   text
)
returns table (pass_id uuid, created boolean)
language plpgsql
as $$
declare
  v_email       text := lower(trim(p_email));
  v_customer_id uuid;
  v_pass_id     uuid;
  v_expires     timestamptz := case
    when p_valid_months > 0 then now() + make_interval(months => p_valid_months)
    else null end;
begin
  select id into v_customer_id from customers where lower(email) = v_email;
  if v_customer_id is null then
    insert into customers (email, first_name, last_name, phone)
    values (v_email, p_first_name, p_last_name, nullif(p_phone, ''))
    returning id into v_customer_id;
  else
    update customers
      set first_name = p_first_name, last_name = p_last_name,
          phone = nullif(p_phone, '')
      where id = v_customer_id;
  end if;

  insert into passes
    (customer_id, bundle_id, total_credits, remaining_credits,
     price_paid_minor, expires_at, purchase_ref, payment_intent_id)
  values
    (v_customer_id, p_bundle_id, p_total_credits, p_total_credits,
     p_price_paid_minor, v_expires, p_purchase_ref, p_payment_intent)
  on conflict (purchase_ref) do nothing
  returning id into v_pass_id;

  if v_pass_id is not null then
    return query select v_pass_id, true;
  else
    select id into v_pass_id from passes where purchase_ref = p_purchase_ref;
    return query select v_pass_id, false;
  end if;
end;
$$;

revoke all on function record_pass_purchase(text, text, text, text, text, int, int, int, text, text) from public;
grant execute on function record_pass_purchase(text, text, text, text, text, int, int, int, text, text) to service_role;

-- Return credits to a pass (when a pass-redeemed booking is cancelled/refunded),
-- never exceeding the pass total.
create or replace function return_pass_credits(p_pass_id uuid, p_qty int)
returns void
language sql
as $$
  update passes
  set remaining_credits = least(total_credits, remaining_credits + p_qty)
  where id = p_pass_id;
$$;

revoke all on function return_pass_credits(uuid, int) from public;
grant execute on function return_pass_credits(uuid, int) to service_role;
