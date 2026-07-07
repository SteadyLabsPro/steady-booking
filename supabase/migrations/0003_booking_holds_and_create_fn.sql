-- 0003_booking_holds_and_create_fn.sql
-- Booking writes: a hold window so abandoned pending bookings free their spot,
-- and an atomic create_booking() function (customer upsert + waiver + capacity
-- check + insert) that prevents overbooking under races.

-- Hold window --------------------------------------------------------------
-- Pending (unpaid) bookings expire; availability stops counting them once past.
alter table bookings add column if not exists expires_at timestamptz;

-- Availability -------------------------------------------------------------
-- A spot is consumed by confirmed bookings and by pending bookings that are
-- still within their hold window. Expired pending bookings free the spot with
-- no cron needed.
create or replace view session_availability as
select
  s.id       as session_id,
  s.capacity as capacity,
  coalesce(
    sum(b.quantity) filter (
      where b.status = 'confirmed'
         or (b.status = 'pending' and b.expires_at > now())
    ),
    0
  )::int as booked_spaces,
  greatest(
    s.capacity - coalesce(
      sum(b.quantity) filter (
        where b.status = 'confirmed'
           or (b.status = 'pending' and b.expires_at > now())
      ),
      0
    ),
    0
  )::int as remaining_spaces
from sessions s
left join bookings b on b.session_id = s.id
group by s.id, s.capacity;

-- Atomic booking creation --------------------------------------------------
-- All-or-nothing: upsert customer, record waiver (idempotent), lock the
-- session row, capacity-check against live holds, insert a pending booking.
-- Price is snapshotted from the DB session, never trusted from the client.
create or replace function create_booking(
  p_session_id     uuid,
  p_quantity       int,
  p_first_name     text,
  p_last_name      text,
  p_email          text,
  p_phone          text,
  p_waiver_version int,
  p_signature_name text,
  p_hold_minutes   int
)
returns table (booking_id uuid, booking_status text, expires_at timestamptz)
language plpgsql
as $$
declare
  v_email       text := lower(trim(p_email));
  v_customer_id uuid;
  v_capacity    int;
  v_price       int;
  v_booked      int;
  v_expires     timestamptz;
  v_booking_id  uuid;
begin
  if p_quantity < 1 then
    raise exception 'invalid_quantity';
  end if;

  -- 1. Upsert customer by email (case-insensitive).
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

  -- 2. Record the waiver if signed this session (idempotent per version).
  if p_signature_name is not null and length(trim(p_signature_name)) > 0 then
    insert into waivers (customer_id, version, signature_name)
    values (v_customer_id, p_waiver_version, trim(p_signature_name))
    on conflict (customer_id, version) do nothing;
  end if;

  -- Defensive: a booking can never exist without a valid waiver.
  if not exists (
    select 1 from waivers
    where customer_id = v_customer_id and version = p_waiver_version
  ) then
    raise exception 'waiver_required';
  end if;

  -- 3. Lock the session and capacity-check against live holds.
  select capacity, price_minor into v_capacity, v_price
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

  -- 4. Insert the pending booking with its hold.
  v_expires := now() + make_interval(mins => p_hold_minutes);
  insert into bookings
    (session_id, customer_id, quantity, unit_price_minor, status, expires_at)
  values
    (p_session_id, v_customer_id, p_quantity, v_price, 'pending', v_expires)
  returning id into v_booking_id;

  return query select v_booking_id, 'pending'::text, v_expires;
end;
$$;

-- Restrict the RPC to server-side (service role) callers only.
revoke all on function create_booking(
  uuid, int, text, text, text, text, int, text, int
) from public;
grant execute on function create_booking(
  uuid, int, text, text, text, text, int, text, int
) to service_role;
