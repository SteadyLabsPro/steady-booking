import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin passes view: each pass with its credit usage, so staff can answer
 * "how many sessions have I got left?" at a glance, and drill into a pass to
 * see which sessions its credits were spent on. Server-only (service role).
 */

export type AdminPassStatus = "active" | "used" | "expired" | "refunded";

export interface AdminPass {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  /** Credits paid for (the bundle size). */
  totalCredits: number;
  /** Goodwill credits added by staff on top of the purchase. */
  bonusCredits: number;
  remainingCredits: number;
  usedCredits: number;
  priceMinor: number;
  refundedMinor: number;
  /** Bought by card online, so Stripe refunds are possible. */
  hasCardPayment: boolean;
  /** What "refund unused credits" would pay back now, in minor units. */
  unusedRefundMinor: number;
  purchasedAt: string;
  expiresAt: string | null;
  status: AdminPassStatus;
}

/** A session booked using this pass's credits. */
export interface AdminPassBooking {
  id: string;
  startsAt: string | null;
  guests: number;
  status: string;
  bookedAt: string;
}

export interface AdminPassDetail extends AdminPass {
  bookings: AdminPassBooking[];
}

/**
 * Money owed back for a pass's unused, paid-for credits, pro rata to the price
 * paid. Goodwill (bonus) credits are treated as spent last and never refunded,
 * so e.g. 11 left on a 10-credit £80 pass with 2 bonus → 9 paid unused → £72.
 * Capped at what hasn't already been refunded.
 */
export function unusedPaidRefundMinor(p: {
  totalCredits: number;
  remainingCredits: number;
  bonusCredits: number;
  priceMinor: number;
  refundedMinor: number;
}): number {
  if (p.totalCredits <= 0 || p.priceMinor <= 0) return 0;
  const unusedPaid = Math.min(
    p.totalCredits,
    Math.max(0, p.remainingCredits - p.bonusCredits),
  );
  const owed = Math.round((p.priceMinor * unusedPaid) / p.totalCredits);
  return Math.max(0, Math.min(owed, p.priceMinor - p.refundedMinor));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Shape one raw passes row (with embedded customer) into an AdminPass. */
function derivePass(p: any): AdminPass {
  const c = p.customers ?? {};
  const total = p.total_credits ?? 0;
  const bonus = p.bonus_credits ?? 0;
  const remaining = p.remaining_credits ?? 0;
  const price = p.price_paid_minor ?? 0;
  const refunded = p.refunded_minor ?? 0;
  const expired = p.expires_at
    ? new Date(p.expires_at).getTime() < Date.now()
    : false;
  // Fully refunded, or part-refunded with its credits voided.
  const status: AdminPassStatus =
    refunded > 0 && (refunded >= price || remaining <= 0)
      ? "refunded"
      : remaining <= 0
        ? "used"
        : expired
          ? "expired"
          : "active";
  return {
    id: p.id,
    customerName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    email: c.email ?? "",
    phone: c.phone ?? "",
    totalCredits: total,
    bonusCredits: bonus,
    remainingCredits: remaining,
    usedCredits: Math.max(0, total + bonus - remaining),
    priceMinor: price,
    refundedMinor: refunded,
    hasCardPayment: !!p.payment_intent_id,
    unusedRefundMinor: p.payment_intent_id
      ? unusedPaidRefundMinor({
          totalCredits: total,
          remainingCredits: remaining,
          bonusCredits: bonus,
          priceMinor: price,
          refundedMinor: refunded,
        })
      : 0,
    purchasedAt: p.created_at,
    expiresAt: p.expires_at ?? null,
    status,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PASS_SELECT =
  "id, total_credits, bonus_credits, remaining_credits, price_paid_minor, refunded_minor, payment_intent_id, created_at, expires_at, customers(first_name, last_name, email, phone)";

/** All passes, newest first, with credits used/remaining and a derived status. */
export async function getAdminPasses(): Promise<AdminPass[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("passes")
    .select(PASS_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`admin passes read failed: ${error.message}`);
  return (data ?? []).map(derivePass);
}

/** One pass with the sessions its credits were spent on. Null if not found. */
export async function getAdminPass(
  id: string,
): Promise<AdminPassDetail | null> {
  const sb = createServiceClient();
  const { data: p, error } = await sb
    .from("passes")
    .select(PASS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin pass read failed: ${error.message}`);
  if (!p) return null;

  const { data: bks } = await sb
    .from("bookings")
    .select("id, quantity, status, created_at, sessions(starts_at)")
    .eq("pass_id", id)
    .order("created_at", { ascending: false });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const bookings: AdminPassBooking[] = (bks ?? []).map((b: any) => ({
    id: b.id,
    startsAt: b.sessions?.starts_at ?? null,
    guests: b.quantity ?? 0,
    status: b.status ?? "",
    bookedAt: b.created_at,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { ...derivePass(p), bookings };
}
