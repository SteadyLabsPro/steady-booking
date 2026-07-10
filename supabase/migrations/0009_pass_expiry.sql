-- 0009_pass_expiry.sql
-- Passes expire after a validity window (6 months). Redemption rejects expired
-- passes; grant sets the expiry from the configured window.

alter table passes add column if not exists expires_at timestamptz;

-- redeem_pass: reject expired passes.
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
  v_expires     timestamptz;
  v_capacity    int;
  v_booked      int;
  v_booking_id  uuid;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  select remaining_credits, customer_id, expires_at
    into v_remaining, v_customer_id, v_expires
  from passes where id = p_pass_id for update;
  if not found then
    raise exception 'pass_not_found';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'pass_expired';
  end if;
  if v_remaining < p_quantity then
    raise exception 'insufficient_credits';
  end if;

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

-- admin_grant_pass: now takes a validity window (months) and sets expires_at.
drop function if exists admin_grant_pass(text, text, text, text, text, int, int);

create or replace function admin_grant_pass(
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_bundle_id        text,
  p_total_credits    int,
  p_price_paid_minor int,
  p_valid_months     int
)
returns table (pass_id uuid, expires_at timestamptz)
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
    (customer_id, bundle_id, total_credits, remaining_credits, price_paid_minor, expires_at)
  values
    (v_customer_id, p_bundle_id, p_total_credits, p_total_credits, p_price_paid_minor, v_expires)
  returning id into v_pass_id;

  return query select v_pass_id, v_expires;
end;
$$;

revoke all on function admin_grant_pass(text, text, text, text, text, int, int, int) from public;
grant execute on function admin_grant_pass(text, text, text, text, text, int, int, int) to service_role;
