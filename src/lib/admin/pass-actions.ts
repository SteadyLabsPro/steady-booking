"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { createRefund, isStripeConfigured } from "@/lib/payments/stripe";
import { zonedTimeToUtcISO } from "@/engine";
import { requireAdmin } from "./auth";
import { unusedPaidRefundMinor } from "./passes";

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

export interface PassAdjustResult {
  ok: boolean;
  error?: string;
}

function revalidatePass(passId: string) {
  revalidatePath(`/admin/passes/${passId}`);
  revalidatePath("/admin/passes");
  revalidatePath("/admin/transactions");
}

/**
 * Add goodwill credits to a pass (e.g. compensation for downtime). They're
 * tracked as bonus credits, separate from the ones paid for, so they never
 * count towards a money refund.
 */
export async function addPassCredits(
  passId: string,
  qty: number,
): Promise<PassAdjustResult> {
  await requireAdmin();
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
    return { ok: false, error: "Enter a number of credits from 1 to 50." };
  }

  const sb = createServiceClient();
  const { error } = await sb.rpc("admin_add_pass_credits", {
    p_pass_id: passId,
    p_qty: qty,
  });
  if (error) return { ok: false, error: `Couldn't add credits: ${error.message}` };

  revalidatePass(passId);
  return { ok: true };
}

/**
 * Set a pass's expiry to the end of `dateKey` (yyyy-mm-dd) in the venue's
 * timezone — usable all that day. Can extend or shorten.
 */
export async function setPassExpiry(
  passId: string,
  dateKey: string,
): Promise<PassAdjustResult> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "Pick a valid date." };
  }

  const expiresAt = zonedTimeToUtcISO(dateKey, "23:59", tenant.timezone);
  if (new Date(expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Pick today or a later date." };
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("passes")
    .update({ expires_at: expiresAt })
    .eq("id", passId);
  if (error) return { ok: false, error: `Couldn't change expiry: ${error.message}` };

  revalidatePass(passId);
  return { ok: true };
}

/**
 * Refund only the unused, paid-for credits on a card-purchased pass, pro rata
 * to what was paid (e.g. 9 of 10 unused on an £80 pass → £72), then void the
 * remaining credits. Goodwill credits are never paid back. Stripe first; if
 * that fails nothing changes.
 */
export async function refundUnusedPassCredits(
  passId: string,
): Promise<PassAdjustResult> {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: pass } = await sb
    .from("passes")
    .select(
      "id, total_credits, remaining_credits, bonus_credits, price_paid_minor, refunded_minor, payment_intent_id",
    )
    .eq("id", passId)
    .maybeSingle();
  if (!pass) return { ok: false, error: "Pass not found." };
  if (!pass.payment_intent_id) {
    return { ok: false, error: "No card payment on file — refund manually." };
  }

  const amount = unusedPaidRefundMinor({
    totalCredits: pass.total_credits,
    remainingCredits: pass.remaining_credits,
    bonusCredits: pass.bonus_credits ?? 0,
    priceMinor: pass.price_paid_minor,
    refundedMinor: pass.refunded_minor ?? 0,
  });
  if (amount <= 0) return { ok: false, error: "Nothing left to refund." };

  let refundId: string | null = null;
  if (isStripeConfigured()) {
    try {
      refundId = await createRefund(pass.payment_intent_id, amount);
    } catch (e) {
      return {
        ok: false,
        error: `Refund failed: ${(e as Error).message}. Nothing changed.`,
      };
    }
  }

  // Net it out (the charge.refunded webhook confirms the same total) and void
  // the remaining credits.
  const patch: Record<string, unknown> = {
    refunded_minor: (pass.refunded_minor ?? 0) + amount,
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

  revalidatePass(passId);
  revalidatePath("/");
  return { ok: true };
}
