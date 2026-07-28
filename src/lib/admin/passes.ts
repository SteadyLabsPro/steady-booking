import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin passes view: each pass with its credit usage, so staff can answer
 * "how many sessions have I got left?" at a glance. Server-only (service role).
 */

export type AdminPassStatus = "active" | "used" | "expired" | "refunded";

export interface AdminPass {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  totalCredits: number;
  remainingCredits: number;
  usedCredits: number;
  priceMinor: number;
  refundedMinor: number;
  purchasedAt: string;
  expiresAt: string | null;
  status: AdminPassStatus;
}

/** All passes, newest first, with credits used/remaining and a derived status. */
export async function getAdminPasses(): Promise<AdminPass[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("passes")
    .select(
      "id, total_credits, remaining_credits, price_paid_minor, refunded_minor, created_at, expires_at, customers(first_name, last_name, email, phone)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`admin passes read failed: ${error.message}`);

  const now = Date.now();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((p: any) => {
    const c = p.customers ?? {};
    const total = p.total_credits ?? 0;
    const remaining = p.remaining_credits ?? 0;
    const price = p.price_paid_minor ?? 0;
    const refunded = p.refunded_minor ?? 0;
    const expired = p.expires_at
      ? new Date(p.expires_at).getTime() < now
      : false;
    const status: AdminPassStatus =
      refunded >= price && price > 0
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
      remainingCredits: remaining,
      usedCredits: total - remaining,
      priceMinor: price,
      refundedMinor: refunded,
      purchasedAt: p.created_at,
      expiresAt: p.expires_at ?? null,
      status,
    } as AdminPass;
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
