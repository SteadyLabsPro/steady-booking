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
  paymentStatus: PaymentStatus;
  status: string;
  /** Short internal reference (what the customer sees). */
  reference: string;
  /** Stripe Checkout Session id — blank for non-Stripe (admin/comp/granted). */
  stripeRef: string;
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
    paymentStatus: (r.payment_status ?? "pending") as PaymentStatus,
    status: r.status ?? "",
    reference: r.reference ?? "",
    stripeRef: r.stripe_ref ?? "",
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Money actually taken in the range (excludes £0 comps and refunds). */
export function revenueMinor(rows: AdminTransaction[]): number {
  return rows
    .filter((r) => r.paymentStatus === "paid")
    .reduce((sum, r) => sum + r.amountMinor, 0);
}
