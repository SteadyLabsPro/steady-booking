-- 0006_payment_status.sql
-- Internal payment states, decoupled from any provider. The booking system
-- reasons about these; Stripe-specific logic maps into them at the edge.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending', 'paid', 'failed', 'refunded', 'cancelled'
    );
  end if;
end
$$;

alter table bookings
  add column if not exists payment_status payment_status not null default 'pending';

-- Provider reference to correlate webhooks (e.g. Stripe checkout session id).
alter table bookings
  add column if not exists payment_ref text;

create index if not exists bookings_payment_ref_idx on bookings (payment_ref);

-- Manual admin bookings are recorded as already paid (settled offline).
create or replace function admin_create_booking(
  p_session_id uuid,
  p_quantity   int,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text
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
    (p_session_id, v_customer_id, p_quantity, v_price, 'confirmed', 'paid')
  returning id into v_booking_id;

  return query select v_booking_id;
end;
$$;

revoke all on function admin_create_booking(
  uuid, int, text, text, text, text
) from public;
grant execute on function admin_create_booking(
  uuid, int, text, text, text, text
) to service_role;
