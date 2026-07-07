"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { needsWaiver } from "@/engine";

/**
 * Whether this email still needs to sign the waiver. Customers who have already
 * signed the active version skip the waiver step (one-time per customer).
 * On any error we fail safe by requiring the waiver.
 */
export async function checkWaiverNeeded(
  email: string,
): Promise<{ needsWaiver: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { needsWaiver: true };

  try {
    const sb = createServiceClient();

    // Emails are stored normalised (lowercased) by create_booking.
    const { data: customer } = await sb
      .from("customers")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (!customer) return { needsWaiver: true };

    const { data: waivers } = await sb
      .from("waivers")
      .select("version")
      .eq("customer_id", customer.id);

    const signedVersions = (waivers ?? []).map((w) => w.version as number);
    return { needsWaiver: needsWaiver(signedVersions, tenant.waiver.version) };
  } catch {
    return { needsWaiver: true };
  }
}
