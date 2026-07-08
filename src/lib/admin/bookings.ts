import { createServiceClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/supabase/availability";
import { tenant } from "@/config/tenant.config";
import {
  sessionDateKey,
  addDaysKey,
  dayKeyWeekday,
  zonedTimeToUtcISO,
  formatSessionDate,
  formatSessionTime,
} from "@/engine";

/**
 * Admin booking reads. Windows are by SESSION DATE (starts_at) in the tenant
 * timezone. Runs server-side with the service role. Booking status is derived
 * for display: an expired hold (pending past expires_at) shows as "expired".
 */

export type AdminWindow = "today" | "week" | "month";

export type AdminBookingStatus =
  | "confirmed"
  | "pending"
  | "expired"
  | "cancelled";

export interface AdminBookingRow {
  id: string;
  startsAt: string;
  guests: number;
  status: AdminBookingStatus;
  customerName: string;
  email: string;
  waiverSigned: boolean;
  totalMinor: number;
}

function windowBounds(window: AdminWindow): { startISO: string; endISO: string } {
  const tz = tenant.timezone;
  const todayKey = sessionDateKey(new Date().toISOString(), tz);

  if (window === "today") {
    return {
      startISO: zonedTimeToUtcISO(todayKey, "00:00", tz),
      endISO: zonedTimeToUtcISO(addDaysKey(todayKey, 1), "00:00", tz),
    };
  }

  if (window === "week") {
    // Calendar week, Monday–Sunday.
    const weekday = dayKeyWeekday(todayKey); // 0 = Sun … 6 = Sat
    const mondayKey = addDaysKey(todayKey, -((weekday + 6) % 7));
    return {
      startISO: zonedTimeToUtcISO(mondayKey, "00:00", tz),
      endISO: zonedTimeToUtcISO(addDaysKey(mondayKey, 7), "00:00", tz),
    };
  }

  // Calendar month.
  const [y, m] = todayKey.split("-").map(Number);
  const firstKey = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const firstNextKey = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return {
    startISO: zonedTimeToUtcISO(firstKey, "00:00", tz),
    endISO: zonedTimeToUtcISO(firstNextKey, "00:00", tz),
  };
}

export async function getAdminBookings(
  window: AdminWindow,
): Promise<AdminBookingRow[]> {
  const { startISO, endISO } = windowBounds(window);
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("bookings")
    .select(
      `id, quantity, total_minor, status, expires_at,
       sessions!inner ( starts_at ),
       customers ( first_name, last_name, email, waivers ( version ) )`,
    )
    .gte("sessions.starts_at", startISO)
    .lt("sessions.starts_at", endISO);

  if (error) throw new Error(`admin bookings read failed: ${error.message}`);

  const activeVersion = tenant.waiver.version;
  const now = Date.now();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows: AdminBookingRow[] = (data ?? []).map((b: any) => {
    const startsAt: string = b.sessions.starts_at;
    const customer = b.customers ?? {};
    const versions: number[] = (customer.waivers ?? []).map(
      (w: any) => w.version,
    );

    let status: AdminBookingStatus;
    if (b.status === "cancelled") status = "cancelled";
    else if (b.status === "confirmed") status = "confirmed";
    else
      status =
        b.expires_at && new Date(b.expires_at).getTime() > now
          ? "pending"
          : "expired";

    return {
      id: b.id,
      startsAt,
      guests: b.quantity,
      status,
      customerName:
        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
      email: customer.email ?? "",
      waiverSigned: versions.includes(activeVersion),
      totalMinor: b.total_minor,
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  rows.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  return rows;
}

/** Option for the manual-add session picker. */
export interface SessionOption {
  id: string;
  label: string;
  remaining: number;
}

/** Upcoming sessions with spaces left, for the manual-add picker. */
export async function getBookableSessions(): Promise<SessionOption[]> {
  const tz = tenant.timezone;
  const todayKey = sessionDateKey(new Date().toISOString(), tz);
  const { sessions, remainingBySession } = await getAvailability(todayKey, 14);

  return sessions
    .map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      remaining: remainingBySession[s.id] ?? s.capacity,
    }))
    .filter((s) => s.remaining > 0)
    .map((s) => ({
      id: s.id,
      remaining: s.remaining,
      label: `${formatSessionDate(s.startsAt, tz)} · ${formatSessionTime(
        s.startsAt,
        tz,
      )} — ${s.remaining} left`,
    }));
}
