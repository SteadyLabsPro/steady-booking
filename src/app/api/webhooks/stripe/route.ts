import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  paymentUpdateForEvent,
  passPurchaseForEvent,
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
    } = {
      payment_status: update.paymentStatus,
    };
    if (update.confirmBooking) patch.status = "confirmed";
    // Stamp when the money actually landed, so accounting reconciles with Stripe.
    if (update.paymentStatus === "paid") patch.paid_at = new Date().toISOString();
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
