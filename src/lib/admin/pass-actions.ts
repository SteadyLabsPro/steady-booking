"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { createRefund, isStripeConfigured } from "@/lib/payments/stripe";
import { requireAdmin } from "./auth";

/** How a granted pass was paid — "paid" counts to revenue, "complimentary" doesn't. */
export type AdminPassPayment = "paid" | "complimentary";

export interface AdminGrantPassInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bundleId: string;
  payment: AdminPassPayment;
}

export type AdminGrantPassResult =
  | { ok: true; passId: string; expiresAt: string | null; credits: number }
  | { ok: false; reason: "unknown_bundle" | "error"; message?: string };

/**
 * Grant/sell a pass to a customer (for cash/offline sales or comps). A "paid"
 * pass records its price so it counts to revenue at purchase; "complimentary"
 * records £0. Expiry comes from the bundle's validity window.
 */
export async function adminGrantPass(
  input: AdminGrantPassInput,
): Promise<AdminGrantPassResult> {
  await requireAdmin();

  const bundle = tenant.bundles.find((b) => b.id === input.bundleId);
  if (!bundle) return { ok: false, reason: "unknown_bundle" };

  const sb = createServiceClient();
  const priceMinor = input.payment === "paid" ? bundle.priceMinor : 0;

  const { data, error } = await sb.rpc("admin_grant_pass", {
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
    p_bundle_id: bundle.id,
    p_total_credits: bundle.sessions,
    p_price_paid_minor: priceMinor,
    p_valid_months: bundle.validityMonths,
  });

  if (error) return { ok: false, reason: "error", message: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/admin/bookings");
  return {
    ok: true,
    passId: row.pass_id,
    expiresAt: row.expires_at,
    credits: bundle.sessions,
  };
}

export interface RefundPassResult {
  ok: boolean;
  error?: string;
}

/**
 * Refund a card-purchased pass. Issues the Stripe refund first, then nets it out
 * and VOIDS the remaining credits so the pass can no longer be used — money back
 * and sessions cancelled in one action. Looked up by its Stripe purchase
 * reference (what the transactions view carries). Cash/comp passes (no card
 * payment on file) can't be refunded this way.
 */
export async function refundPass(
  purchaseRef: string,
): Promise<RefundPassResult> {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: pass } = await sb
    .from("passes")
    .select("id, price_paid_minor, refunded_minor, payment_intent_id")
    .eq("purchase_ref", purchaseRef)
    .maybeSingle();
  if (!pass) return { ok: false, error: "Pass not found." };
  if ((pass.refunded_minor ?? 0) >= pass.price_paid_minor) return { ok: true };
  if (!pass.payment_intent_id) {
    return { ok: false, error: "No card payment on file — refund manually." };
  }

  // Refund in Stripe first; if that fails, change nothing so we never drift.
  let refundId: string | null = null;
  if (isStripeConfigured()) {
    try {
      refundId = await createRefund(pass.payment_intent_id);
    } catch (e) {
      return {
        ok: false,
        error: `Refund failed: ${(e as Error).message}. Nothing changed.`,
      };
    }
  }

  // Net it out (the charge.refunded webhook confirms the same) and void the
  // remaining credits so the pass can't be redeemed after a refund.
  const patch: Record<string, unknown> = {
    refunded_minor: pass.price_paid_minor,
    remaining_credits: 0,
  };
  if (refundId) patch.refund_ref = refundId;

  const { error } = await sb.from("passes").update(patch).eq("id", pass.id);
  if (error) {
    return {
      ok: false,
      error: `Refunded in Stripe, but saving failed: ${error.message}`,
    };
  }

  revalidatePath("/admin/transactions");
  revalidatePath("/");
  return { ok: true };
}
