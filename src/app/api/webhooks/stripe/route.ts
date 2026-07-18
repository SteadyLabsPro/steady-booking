import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  paymentUpdateForEvent,
  passPurchaseForEvent,
  refundForEvent,
} from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { sendBookingConfirmation } from "@/lib/email/booking-confirmation";
import { sendPassConfirmation } from "@/lib/email/pass-confirmation";

/**
 * Stripe webhook. Verifies the signature, maps the event to an internal
 * payment update, and applies it to the booking (payment_status, and confirm
 * on success). This is the only inbound Stripe surface.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Refund (from Stripe or our cancel-and-refund) — net it out on the matching
  // booking or pass so figures reconcile with Stripe.
  const refund = refundForEvent(event);
  if (refund) {
    const sb = createServiceClient();
    const table =
      (
        await sb
          .from("bookings")
          .update({
            refunded_minor: refund.amountRefundedMinor,
            ...(refund.fullyRefunded ? { payment_status: "refunded" } : {}),
          })
          .eq("payment_intent_id", refund.paymentIntentId)
          .select("id")
      ).data?.length
        ? "bookings"
        : "passes";
    // If no booking matched, it's a pass purchase.
    if (table === "passes") {
      await sb
        .from("passes")
        .update({ refunded_minor: refund.amountRefundedMinor })
        .eq("payment_intent_id", refund.paymentIntentId);
    }
    // Store the refund reference (best-effort — no-op if the column predates 0014).
    if (refund.refundRef) {
      await sb
        .from(table)
        .update({ refund_ref: refund.refundRef })
        .eq("payment_intent_id", refund.paymentIntentId);
    }
    return NextResponse.json({ received: true });
  }

  // Online pass purchase: grant the pass (idempotent) and email the buyer.
  const pass = passPurchaseForEvent(event);
  if (pass) {
    const bundle = tenant.bundles.find((b) => b.id === pass.bundleId);
    if (bundle) {
      const sb = createServiceClient();
      const { data } = await sb.rpc("record_pass_purchase", {
        p_first_name: pass.firstName,
        p_last_name: pass.lastName,
        p_email: pass.email,
        p_phone: pass.phone,
        p_bundle_id: bundle.id,
        p_total_credits: bundle.sessions,
        p_price_paid_minor: bundle.priceMinor,
        p_valid_months: bundle.validityMonths,
        p_purchase_ref: pass.ref,
        p_payment_intent: pass.paymentIntentId,
      });
      const row = Array.isArray(data) ? data[0] : data;
      // Only email on first creation, not on a re-delivered webhook.
      if (row?.created && row?.pass_id) {
        await sendPassConfirmation(row.pass_id);
      }
    }
    return NextResponse.json({ received: true });
  }

  const update = paymentUpdateForEvent(event);
  if (update) {
    const sb = createServiceClient();
    const patch: {
      payment_status: string;
      status?: string;
      paid_at?: string;
      payment_intent_id?: string;
    } = {
      payment_status: update.paymentStatus,
    };
    if (update.confirmBooking) patch.status = "confirmed";
    // Stamp when the money actually landed, so accounting reconciles with Stripe.
    if (update.paymentStatus === "paid") patch.paid_at = new Date().toISOString();
    // Store the PaymentIntent so a later refund can be matched back.
    if (update.paymentIntentId) patch.payment_intent_id = update.paymentIntentId;
    const { data } = await sb
      .from("bookings")
      .update(patch)
      .eq("payment_ref", update.ref)
      .select("id");

    // Email the customer once the booking is confirmed by payment.
    if (update.confirmBooking && data?.[0]?.id) {
      await sendBookingConfirmation(data[0].id);
    }
  }

  return NextResponse.json({ received: true });
}
