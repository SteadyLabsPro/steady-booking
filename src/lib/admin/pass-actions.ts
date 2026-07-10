"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
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
  revalidatePath("/admin");
  return {
    ok: true,
    passId: row.pass_id,
    expiresAt: row.expires_at,
    credits: bundle.sessions,
  };
}
