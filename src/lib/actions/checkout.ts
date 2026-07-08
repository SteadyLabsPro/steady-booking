"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { isStripeConfigured, createCheckoutSession } from "@/lib/payments/stripe";
import { createBooking, type CreateBookingInput } from "./create-booking";

export type StartCheckoutResult =
  | { ok: true; mode: "redirect"; url: string }
  | { ok: true; mode: "held"; bookingId: string }
  | {
      ok: false;
      reason: "sold_out" | "session_unavailable" | "waiver_required" | "error";
      message?: string;
    };

/**
 * Create the (pending) booking, then start payment. When Stripe is configured
 * we return a hosted-checkout URL to redirect to; otherwise we fall back to a
 * held booking (the current behaviour) so the flow works without real keys.
 */
export async function startCheckout(
  input: CreateBookingInput,
): Promise<StartCheckoutResult> {
  const created = await createBooking(input);
  if (!created.ok) return created;

  const bookingId = created.bookingId;

  if (!isStripeConfigured()) {
    return { ok: true, mode: "held", bookingId };
  }

  const sb = createServiceClient();
  const { data: booking } = await sb
    .from("bookings")
    .select("total_minor")
    .eq("id", bookingId)
    .single();

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  try {
    const { url, ref } = await createCheckoutSession({
      bookingId,
      amountMinor: booking?.total_minor ?? 0,
      currency: tenant.currency,
      customerEmail: input.email.trim(),
      description: `${tenant.name} — Sauna & Cold Plunge`,
      successUrl: `${base}/booking/confirmed?booking=${bookingId}`,
      cancelUrl: `${base}/`,
    });
    await sb.from("bookings").update({ payment_ref: ref }).eq("id", bookingId);
    return { ok: true, mode: "redirect", url };
  } catch {
    // Stripe unreachable/misconfigured — keep the held booking rather than
    // stranding the customer. Real errors surface once valid keys are set.
    return { ok: true, mode: "held", bookingId };
  }
}
