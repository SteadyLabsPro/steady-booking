-- 0007_payment_choice_and_paid_revenue.sql
-- Admin manual bookings choose their payment status; revenue counts paid only.

-- New internal state for comped bookings.
alter type payment_status add value if not exists 'complimentary';

-- admin_create_booking now takes the payment status (Paid manually / comp /
-- unpaid-pay-on-arrival). Drop the old 6-arg overload first.
drop function if exists admin_create_booking(uuid, int, text, text, text, text);

create or replace function admin_create_booking(
  p_session_id     uuid,
  p_quantity       int,
  p_first_name     text,
  p_last_name      text,
  p_email          text,
  p_phone          text,
  p_payment_status payment_status
)
returns table (booking_id uuid)
language plpgsql
as $$
declare
  v_email       text := lower(trim(p_email));
  v_customer_id uuid;
  v_capacity    int;
  v_price       int;
  v_booked      int;
  v_booking_id  uuid;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  select id into v_customer_id from customers where lower(email) = v_email;
  if v_customer_id is null then
    insert into customers (email, first_name, last_name, phone)
    values (v_email, p_first_name, p_last_name, nullif(p_phone, ''))
    returning id into v_customer_id;
  else
    update customers
      set first_name = p_first_name,
          last_name  = p_last_name,
          phone      = nullif(p_phone, '')
      where id = v_customer_id;
  end if;

  select capacity, price_minor into v_capacity, v_price
  from sessions
  where id = p_session_id and is_active
  for update;

  if not found then
    raise exception 'session_unavailable';
  end if;

  select coalesce(sum(bookings.quantity), 0) into v_booked
  from bookings
  where bookings.session_id = p_session_id
    and (
      bookings.status = 'confirmed'
      or (bookings.status = 'pending' and bookings.expires_at > now())
    );

  if v_capacity - v_booked < p_quantity then
    raise exception 'sold_out';
  end if;

  insert into bookings
    (session_id, customer_id, quantity, unit_price_minor, status, payment_status)
  values
    (p_session_id, v_customer_id, p_quantity, v_price, 'confirmed', p_payment_status)
  returning id into v_booking_id;

  return query select v_booking_id;
end;
$$;

revoke all on function admin_create_booking(
  uuid, int, text, text, text, text, payment_status
) from public;
grant execute on function admin_create_booking(
  uuid, int, text, text, text, text, payment_status
) to service_role;

-- Revenue counts only genuinely paid bookings (not comp, not unpaid).
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
  select
    coalesce(sum(b.total_minor) filter (
      where (s.starts_at at time zone p_tz)::date = (now() at time zone p_tz)::date
    ), 0)::bigint,
    coalesce(sum(b.total_minor) filter (
      where date_trunc('week', s.starts_at at time zone p_tz)
          = date_trunc('week', now() at time zone p_tz)
    ), 0)::bigint,
    coalesce(sum(b.total_minor) filter (
      where date_trunc('month', s.starts_at at time zone p_tz)
          = date_trunc('month', now() at time zone p_tz)
    ), 0)::bigint,
    coalesce(sum(b.total_minor) filter (
      where date_trunc('year', s.starts_at at time zone p_tz)
          = date_trunc('year', now() at time zone p_tz)
    ), 0)::bigint
  from bookings b
  join sessions s on s.id = b.session_id
  where b.status = 'confirmed'
    and b.payment_status = 'paid';
$$;
