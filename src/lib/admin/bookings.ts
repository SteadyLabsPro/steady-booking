import { createServiceClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/supabase/availability";
import { tenant } from "@/config/tenant.config";
import type { PaymentStatus } from "@/lib/payments/types";
import {
  sessionDateKey,
  addDaysKey,
  zonedTimeToUtcISO,
  formatSessionDate,
  formatSessionTime,
} from "@/engine";

/**
 * Admin booking reads by SESSION DATE (starts_at) in the tenant timezone, over
 * a from/to range. Runs server-side with the service role. Booking status is
 * derived for display: an expired hold (pending past expires_at) shows as
 * "expired".
 */

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
  phone: string;
  waiverSigned: boolean;
  paymentStatus: PaymentStatus;
  totalMinor: number;
  /** What "refund on cancel" would do: give money back, return a credit, or nothing. */
  refundKind: "money" | "credit" | null;
}

/** Bookings whose SESSION falls in [fromKey, toKey] (both inclusive). */
export async function getAdminBookings(
  fromKey: string,
  toKey: string,
): Promise<AdminBookingRow[]> {
  const tz = tenant.timezone;
  const startISO = zonedTimeToUtcISO(fromKey, "00:00", tz);
  const endISO = zonedTimeToUtcISO(addDaysKey(toKey, 1), "00:00", tz);
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("bookings")
    .select(
      `id, quantity, total_minor, status, payment_status, expires_at,
       pass_id, payment_intent_id, refunded_minor,
       sessions!inner ( starts_at ),
       customers ( first_name, last_name, email, phone, waivers ( version ) )`,
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

    let refundKind: "money" | "credit" | null = null;
    if (b.status !== "cancelled") {
      if (b.pass_id) refundKind = "credit";
      else if (
        b.payment_status === "paid" &&
        b.payment_intent_id &&
        (b.refunded_minor ?? 0) < b.total_minor
      )
        refundKind = "money";
    }

    return {
      id: b.id,
      startsAt,
      guests: b.quantity,
      status,
      customerName:
        `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      waiverSigned: versions.includes(activeVersion),
      paymentStatus: (b.payment_status ?? "pending") as PaymentStatus,
      totalMinor: b.total_minor,
      refundKind,
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
