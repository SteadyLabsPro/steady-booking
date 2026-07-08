import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  paymentUpdateForEvent,
} from "@/lib/payments/stripe";
import { createServiceClient } from "@/lib/supabase/server";

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

  const update = paymentUpdateForEvent(event);
  if (update) {
    const sb = createServiceClient();
    const patch: { payment_status: string; status?: string } = {
      payment_status: update.paymentStatus,
    };
    if (update.confirmBooking) patch.status = "confirmed";
    await sb.from("bookings").update(patch).eq("payment_ref", update.ref);
  }

  return NextResponse.json({ received: true });
}
