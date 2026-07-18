import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { addDaysKey, sessionDateKey, zonedTimeToUtcISO } from "@/engine";
import type { PaymentStatus } from "@/lib/payments/types";

/**
 * Admin transactions: money movements by PAYMENT date (not session date),
 * unifying session bookings and pass sales so takings reconcile against Stripe.
 * Server-only (service role).
 */

export interface AdminTransaction {
  kind: "booking" | "pass";
  /** When the money was taken. */
  occurredAt: string;
  customerName: string;
  email: string;
  phone: string;
  /** Session start (bookings only; null for a pass sale). */
  sessionStartsAt: string | null;
  /** Guests for a booking; credits for a pass. */
  quantity: number;
  amountMinor: number;
  /** How much of amountMinor was refunded (0 if none). */
  refundedMinor: number;
  paymentStatus: PaymentStatus;
  status: string;
  /** Short internal reference (what the customer sees). */
  reference: string;
  /** Stripe Checkout Session id — blank for non-Stripe (admin/comp/granted). */
  stripeRef: string;
  /** Stripe refund id (re_…) — blank if not refunded. */
  refundRef: string;
  /** Full booking id (bookings only; null for a pass sale) — for refunds. */
  bookingId: string | null;
}

/** yyyy-mm-dd. */
export function isDateKey(v: string | undefined | null): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function todayKey(): string {
  return sessionDateKey(new Date().toISOString(), tenant.timezone);
}

/** Transactions in a payment-date range. Both dates are inclusive. */
export async function getAdminTransactions(
  fromKey: string,
  toKey: string,
): Promise<AdminTransaction[]> {
  const tz = tenant.timezone;
  const fromISO = zonedTimeToUtcISO(fromKey, "00:00", tz);
  // End is exclusive: midnight at the start of the day after `toKey`.
  const toISO = zonedTimeToUtcISO(addDaysKey(toKey, 1), "00:00", tz);

  const sb = createServiceClient();
  const { data, error } = await sb.rpc("admin_transactions", {
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw new Error(`admin transactions read failed: ${error.message}`);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    kind: r.kind as "booking" | "pass",
    occurredAt: r.occurred_at,
    customerName: r.customer_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    sessionStartsAt: r.session_starts_at ?? null,
    quantity: r.quantity ?? 0,
    amountMinor: r.amount_minor ?? 0,
    refundedMinor: r.refunded_minor ?? 0,
    paymentStatus: (r.payment_status ?? "pending") as PaymentStatus,
    status: r.status ?? "",
    reference: r.reference ?? "",
    stripeRef: r.stripe_ref ?? "",
    refundRef: r.refund_ref ?? "",
    bookingId: r.booking_id ?? null,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Free-text filter across customer name, email, phone, our booking/pass
 * reference and the Stripe ref. Applied to whatever the date range returned,
 * so the on-screen list and the CSV always match.
 */
export function filterTransactions(
  rows: AdminTransaction[],
  q: string | undefined | null,
): AdminTransaction[] {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    [r.customerName, r.email, r.phone, r.reference, r.stripeRef].some((f) =>
      f.toLowerCase().includes(needle),
    ),
  );
}

/** Money actually kept in the range: gross minus anything refunded, so it
 * reconciles with Stripe. */
export function revenueMinor(rows: AdminTransaction[]): number {
  return rows.reduce((sum, r) => sum + (r.amountMinor - r.refundedMinor), 0);
}

/** Total refunded in the range. */
export function refundedMinor(rows: AdminTransaction[]): number {
  return rows.reduce((sum, r) => sum + r.refundedMinor, 0);
}
