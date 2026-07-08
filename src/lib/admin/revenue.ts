import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";

/**
 * Revenue totals from confirmed bookings only, by session date in the tenant
 * timezone. Server-side (service role) via the admin_revenue_summary RPC.
 */
export interface RevenueSummary {
  todayMinor: number;
  weekMinor: number;
  monthMinor: number;
  yearMinor: number;
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("admin_revenue_summary", {
    p_tz: tenant.timezone,
  });
  if (error) throw new Error(`revenue read failed: ${error.message}`);

  // bigint comes back as a string from PostgREST.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    todayMinor: Number(row?.today_minor ?? 0),
    weekMinor: Number(row?.week_minor ?? 0),
    monthMinor: Number(row?.month_minor ?? 0),
    yearMinor: Number(row?.year_minor ?? 0),
  };
}
