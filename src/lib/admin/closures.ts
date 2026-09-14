import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { addDaysKey, zonedTimeToUtcISO } from "@/engine";

/**
 * Admin closures view: all sessions on a given day (active or blocked), each
 * with how many guests are already booked — so staff can block a slot for
 * maintenance/deep-clean and see who (if anyone) is affected before doing it.
 * Server-only (service role).
 */

export interface AdminDaySession {
  id: string;
  startsAt: string;
  capacity: number;
  isActive: boolean;
  /** Confirmed guests already booked on this session. */
  bookedGuests: number;
}

/** Every session on `dateKey` (yyyy-mm-dd), ordered by time. */
export async function getDaySessions(
  dateKey: string,
): Promise<AdminDaySession[]> {
  const tz = tenant.timezone;
  const fromISO = zonedTimeToUtcISO(dateKey, "00:00", tz);
  const toISO = zonedTimeToUtcISO(addDaysKey(dateKey, 1), "00:00", tz);

  const sb = createServiceClient();
  const { data: sess, error } = await sb
    .from("sessions")
    .select("id, starts_at, capacity, is_active")
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`day sessions read failed: ${error.message}`);

  const sessions = sess ?? [];
  const bookedBy: Record<string, number> = {};
  if (sessions.length > 0) {
    const { data: bks } = await sb
      .from("bookings")
      .select("session_id, quantity, status")
      .in(
        "session_id",
        sessions.map((s) => s.id),
      )
      .eq("status", "confirmed");
    for (const b of bks ?? []) {
      bookedBy[b.session_id] = (bookedBy[b.session_id] ?? 0) + (b.quantity ?? 0);
    }
  }

  return sessions.map((s) => ({
    id: s.id,
    startsAt: s.starts_at,
    capacity: s.capacity,
    isActive: s.is_active,
    bookedGuests: bookedBy[s.id] ?? 0,
  }));
}
