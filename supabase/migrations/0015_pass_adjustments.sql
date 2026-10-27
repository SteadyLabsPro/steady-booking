-- 0015_pass_adjustments.sql
-- Staff adjustments to a pass: add goodwill credits, extend expiry, refund
-- unused credits. Added credits are tracked apart from purchased ones, so a
-- refund of unused credits only ever pays back credits that were paid for.

alter table passes add column if not exists bonus_credits integer not null default 0
  check (bonus_credits >= 0);

-- Add goodwill credits to a pass, atomically. Returns the new balance.
create or replace function admin_add_pass_credits(p_pass_id uuid, p_qty int)
returns table (remaining int)
language plpgsql
as $$
begin
  if p_qty < 1 then
    raise exception 'invalid_quantity';
  end if;

  return query
  update passes
  set bonus_credits     = bonus_credits + p_qty,
      remaining_credits = remaining_credits + p_qty
  where id = p_pass_id
  returning remaining_credits;

  if not found then
    raise exception 'pass_not_found';
  end if;
end;
$$;

revoke all on function admin_add_pass_credits(uuid, int) from public;
grant execute on function admin_add_pass_credits(uuid, int) to service_role;

-- Returned credits may now go up to purchased + added, not just purchased.
create or replace function return_pass_credits(p_pass_id uuid, p_qty int)
returns void
language sql
as $$
  update passes
  set remaining_credits = least(total_credits + bonus_credits, remaining_credits + p_qty)
  where id = p_pass_id;
$$;

revoke all on function return_pass_credits(uuid, int) from public;
grant execute on function return_pass_credits(uuid, int) to service_role;
