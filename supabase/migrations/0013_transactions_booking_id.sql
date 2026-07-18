-- 0013_transactions_booking_id.sql
-- Expose the full booking id in the transactions view so the admin can refund a
-- booking directly from the Transactions list (pass sales stay Stripe-only).

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
  stripe_ref        text,
  booking_id        uuid
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
    coalesce(b.payment_ref, ''),
    b.id
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
    coalesce(p.purchase_ref, ''),
    null::uuid
  from passes p
  left join customers c on c.id = p.customer_id
  where p.created_at >= p_from
    and p.created_at <  p_to

  order by 2;
$$;

revoke all on function admin_transactions(timestamptz, timestamptz) from public;
grant execute on function admin_transactions(timestamptz, timestamptz) to service_role;
