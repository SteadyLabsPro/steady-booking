-- 0008_passes_redeem_grant_revenue.sql
-- Pass foundation: atomic redemption, admin grant, and revenue including pass
-- sales. 1 credit = 1 person-session; redeemed bookings are recorded at £0 so
-- revenue (counted at purchase) isn't double-counted.

-- Redeem credits from a pass for a session (atomic, capacity-checked).
create or replace function redeem_pass(
  p_pass_id    uuid,
  p_session_id uuid,
  p_quantity   int
)
returns table (booking_id uuid, remaining int)
language plpgsql
as $$
declare
  v_remaining   int;
  v_customer_id uuid;
  v_capacity    int;
  v_booked      int;
  v_booking_id  uuid;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  -- Lock the pass and check the balance.
  select remaining_credits, customer_id into v_remaining, v_customer_id
  from passes where id = p_pass_id for update;
  if not found then
    raise exception 'pass_not_found';
  end if;
  if v_remaining < p_quantity then
    raise exception 'insufficient_credits';
  end if;

  -- Lock the session and capacity-check.
  select capacity into v_capacity
  from sessions
  where id = p_session_id and is_active and starts_at > now()
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

  -- Confirmed, paid (via pass), £0, linked to the pass.
  insert into bookings
    (session_id, customer_id, quantity, unit_price_minor, status, payment_status, pass_id)
  values
    (p_session_id, v_customer_id, p_quantity, 0, 'confirmed', 'paid', p_pass_id)
  returning id into v_booking_id;

  update passes
  set remaining_credits = remaining_credits - p_quantity
  where id = p_pass_id;

  return query select v_booking_id, v_remaining - p_quantity;
end;
$$;

-- Admin: grant/sell a pass to a customer (paid or comp via price_paid_minor).
create or replace function admin_grant_pass(
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_bundle_id        text,
  p_total_credits    int,
  p_price_paid_minor int
)
returns table (pass_id uuid)
language plpgsql
as $$
declare
  v_email       text := lower(trim(p_email));
  v_customer_id uuid;
  v_pass_id     uuid;
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
    (customer_id, bundle_id, total_credits, remaining_credits, price_paid_minor)
  values
    (v_customer_id, p_bundle_id, p_total_credits, p_total_credits, p_price_paid_minor)
  returning id into v_pass_id;

  return query select v_pass_id;
end;
$$;

-- Revenue now includes pass sales (by purchase date) alongside paid confirmed
-- bookings (by session date). Redeemed bookings are £0 so they don't add twice.
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
    select b.total_minor as amount, s.starts_at as ts
    from bookings b
    join sessions s on s.id = b.session_id
    where b.status = 'confirmed' and b.payment_status = 'paid'
    union all
    select p.price_paid_minor as amount, p.created_at as ts
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

-- Server-side (service role) only.
revoke all on function redeem_pass(uuid, uuid, int) from public;
grant execute on function redeem_pass(uuid, uuid, int) to service_role;
revoke all on function admin_grant_pass(text, text, text, text, text, int, int) from public;
grant execute on function admin_grant_pass(text, text, text, text, text, int, int) to service_role;
