import Stripe from "stripe";
import type {
  CheckoutParams,
  CheckoutResult,
  PaymentUpdate,
  RefundInfo,
} from "./types";

/**
 * Stripe adapter — the ONLY place with Stripe-specific logic. Everything else
 * uses the internal PaymentStatus/PaymentUpdate contracts. Built for test mode;
 * with placeholder env vars the module imports fine but live calls throw until
 * real keys are supplied.
 */

let client: Stripe | null = null;

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(key);
  return client;
}

/** Whether a real Stripe secret key is configured (sk_test_/sk_live_). */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return typeof key === "string" && key.startsWith("sk_");
}

/** Create a hosted Checkout session for a booking. */
export async function createCheckoutSession(
  p: CheckoutParams,
): Promise<CheckoutResult> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: p.currency.toLowerCase(),
          unit_amount: p.amountMinor,
          product_data: { name: p.description },
        },
      },
    ],
    customer_email: p.customerEmail,
    metadata: { bookingId: p.bookingId, ...(p.metadata ?? {}) },
    ...(p.statementDescriptor
      ? {
          payment_intent_data: {
            statement_descriptor_suffix: p.statementDescriptor,
          },
        }
      : {}),
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
  });

  return { url: session.url ?? "", ref: session.id };
}

/** Create a hosted Checkout session for an online pass purchase. The metadata
 * (type=pass + customer details) is read back by the webhook to grant the pass. */
export async function createPassCheckoutSession(p: {
  amountMinor: number;
  currency: string;
  customerEmail: string;
  description: string;
  metadata: Record<string, string>;
  statementDescriptor?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: p.currency.toLowerCase(),
          unit_amount: p.amountMinor,
          product_data: { name: p.description },
        },
      },
    ],
    customer_email: p.customerEmail,
    metadata: p.metadata,
    ...(p.statementDescriptor
      ? {
          payment_intent_data: {
            statement_descriptor_suffix: p.statementDescriptor,
          },
        }
      : {}),
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
  });

  return { url: session.url ?? "", ref: session.id };
}

/** A completed online pass purchase, or null if the event isn't one. */
export interface PassPurchase {
  ref: string;
  paymentIntentId: string | null;
  bundleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export function passPurchaseForEvent(event: Stripe.Event): PassPurchase | null {
  if (event.type !== "checkout.session.completed") return null;
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.metadata?.type !== "pass") return null;
  return {
    ref: s.id,
    paymentIntentId:
      typeof s.payment_intent === "string"
        ? s.payment_intent
        : (s.payment_intent?.id ?? null),
    bundleId: s.metadata.bundleId ?? "",
    firstName: s.metadata.firstName ?? "",
    lastName: s.metadata.lastName ?? "",
    email: s.metadata.email ?? s.customer_email ?? "",
    phone: s.metadata.phone ?? "",
  };
}

/** A refund from a charge.refunded event, matched by PaymentIntent. */
export function refundForEvent(event: Stripe.Event): RefundInfo | null {
  if (event.type !== "charge.refunded") return null;
  const c = event.data.object as Stripe.Charge;
  const pi =
    typeof c.payment_intent === "string"
      ? c.payment_intent
      : (c.payment_intent?.id ?? null);
  if (!pi) return null;
  const refunded = c.amount_refunded ?? 0;
  const total = c.amount ?? 0;
  return {
    paymentIntentId: pi,
    amountRefundedMinor: refunded,
    chargeAmountMinor: total,
    fullyRefunded: total > 0 && refunded >= total,
    // Latest refund on the charge (Stripe lists newest first).
    refundRef: c.refunds?.data?.[0]?.id ?? null,
  };
}

/** Refund a payment in full (used by the admin cancel-and-refund action).
 * Returns the refund id (re_…). */
export async function createRefund(
  paymentIntentId: string,
): Promise<string | null> {
  const r = await stripe().refunds.create({ payment_intent: paymentIntentId });
  return r.id ?? null;
}

/** Verify and parse a webhook payload (throws on bad signature). */
export function constructWebhookEvent(
  payload: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}

/** Map a Stripe event to an internal payment update, or null if irrelevant. */
export function paymentUpdateForEvent(
  event: Stripe.Event,
): PaymentUpdate | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const pi =
        typeof s.payment_intent === "string"
          ? s.payment_intent
          : (s.payment_intent?.id ?? null);
      return {
        ref: s.id,
        paymentStatus: "paid",
        confirmBooking: true,
        paymentIntentId: pi,
      };
    }
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      return { ref: s.id, paymentStatus: "failed", confirmBooking: false };
    }
    // Refunds are handled by an admin action for now (see roadmap).
    default:
      return null;
  }
}
