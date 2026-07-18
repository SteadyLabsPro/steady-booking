import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/payments/stripe";

/** TEMPORARY diagnostic — reports only whether Stripe is wired up and the
 * (non-secret) key prefixes, to confirm live vs test before go-live. */
export async function GET() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    mode: secret.startsWith("sk_live_")
      ? "LIVE"
      : secret.startsWith("sk_test_")
        ? "TEST"
        : "unknown",
    secretKeyPrefix: secret.slice(0, 8) || "(empty)",
    secretKeyLength: secret.length,
    webhookSecretPrefix: webhook.slice(0, 6) || "(empty)",
    webhookSecretLength: webhook.length,
  });
}
