import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/payments/stripe";

/**
 * TEMPORARY diagnostic — reports only whether Stripe is wired up and the
 * (non-secret) key prefixes, so we can see what the server actually reads from
 * the environment. Remove once Stripe is confirmed live.
 */
export async function GET() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    secretKeyPrefix: secret.slice(0, 8) || "(empty)",
    secretKeyLength: secret.length,
    webhookSecretPrefix: webhook.slice(0, 6) || "(empty)",
    webhookSecretLength: webhook.length,
  });
}
