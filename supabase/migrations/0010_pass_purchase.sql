-- 0010_pass_purchase.sql
-- Online pass purchases (Stripe). record_pass_purchase is idempotent on the
-- Stripe session id, so a re-delivered webhook never creates a duplicate pass.

alter table passes add column if not exists purchase_ref text;

-- NULLs are distinct in Postgres, so granted passes (ref NULL) don't collide.
create unique index if not exists passes_purchase_ref_key
  on passes (purchase_ref);

create or replace function record_pass_purchase(
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_bundle_id        text,
  p_total_credits    int,
  p_price_paid_minor int,
  p_valid_months     int,
  p_purchase_ref     text
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
  -- Upsert the customer.
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

  -- Create the pass once per Stripe session (idempotent).
  insert into passes
    (customer_id, bundle_id, total_credits, remaining_credits,
     price_paid_minor, expires_at, purchase_ref)
  values
    (v_customer_id, p_bundle_id, p_total_credits, p_total_credits,
     p_price_paid_minor, v_expires, p_purchase_ref)
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

revoke all on function record_pass_purchase(text, text, text, text, text, int, int, int, text) from public;
grant execute on function record_pass_purchase(text, text, text, text, text, int, int, int, text) to service_role;
