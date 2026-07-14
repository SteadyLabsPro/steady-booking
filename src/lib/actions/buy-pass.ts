"use server";

import { headers } from "next/headers";
import { tenant } from "@/config/tenant.config";
import {
  isStripeConfigured,
  createPassCheckoutSession,
} from "@/lib/payments/stripe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BuyPassInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export type BuyPassResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unavailable" | "invalid" | "error"; message?: string };

/**
 * Start an online pass purchase. Creates a Stripe Checkout session for the
 * bundle price; the pass itself is created by the webhook once payment
 * succeeds. Returns "unavailable" when Stripe isn't configured yet.
 */
export async function startPassCheckout(
  input: BuyPassInput,
): Promise<BuyPassResult> {
  const bundle = tenant.bundles[0];
  if (!bundle) return { ok: false, reason: "error" };

  if (!input.firstName.trim() || !input.lastName.trim())
    return { ok: false, reason: "invalid" };
  if (!EMAIL_RE.test(input.email.trim()))
    return { ok: false, reason: "invalid" };

  if (!isStripeConfigured()) return { ok: false, reason: "unavailable" };

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  try {
    const { url } = await createPassCheckoutSession({
      amountMinor: bundle.priceMinor,
      currency: tenant.currency,
      customerEmail: input.email.trim(),
      description: `${tenant.name} — ${bundle.sessions}-visit pass`,
      metadata: {
        type: "pass",
        business: tenant.slug,
        bundleId: bundle.id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
      },
      statementDescriptor: tenant.payments?.statementDescriptor,
      successUrl: `${base}/pass/confirmed`,
      cancelUrl: `${base}/`,
    });
    return { ok: true, url };
  } catch {
    return { ok: false, reason: "error" };
  }
}
