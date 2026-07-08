-- 0004_admin_revenue.sql
-- Admin revenue summary: totals from CONFIRMED bookings only, grouped by
-- session date in the tenant timezone (passed in, so it stays config-driven).

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
  where b.status = 'confirmed';
$$;

-- Server-side (service role) only.
revoke all on function admin_revenue_summary(text) from public;
grant execute on function admin_revenue_summary(text) to service_role;
