"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { sendBookingConfirmation } from "@/lib/email/booking-confirmation";
import { createRefund, isStripeConfigured } from "@/lib/payments/stripe";
import { requireAdmin } from "./auth";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Whether this email still needs to sign/acknowledge the active waiver. */
async function customerNeedsWaiver(
  sb: ServiceClient,
  email: string,
): Promise<boolean> {
  const { data: c } = await sb
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!c) return true;
  const { data: w } = await sb
    .from("waivers")
    .select("version")
    .eq("customer_id", c.id);
  return !((w ?? []) as { version: number }[]).some(
    (x) => x.version === tenant.waiver.version,
  );
}

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Cancel a booking — sets status to 'cancelled' (never deletes); the spot frees
 * automatically. With `refund`, it also gives the money back: a Stripe refund
 * for a card booking, or the credit(s) returned for a pass redemption.
 */
export async function cancelBooking(
  id: string,
  opts?: { refund?: boolean },
): Promise<CancelResult> {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: bk } = await sb
    .from("bookings")
    .select(
      "quantity, total_minor, refunded_minor, payment_status, payment_intent_id, pass_id, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!bk) return { ok: false, error: "Booking not found." };
  if (bk.status === "cancelled") return { ok: true };

  const refund = opts?.refund === true;
  const canRefundMoney =
    !bk.pass_id &&
    bk.payment_status === "paid" &&
    !!bk.payment_intent_id &&
    (bk.refunded_minor ?? 0) < bk.total_minor;

  // Issue the Stripe refund first — if it fails we don't cancel, so nothing
  // goes out of sync.
  if (refund && canRefundMoney && isStripeConfigured()) {
    try {
      await createRefund(bk.payment_intent_id as string);
    } catch (e) {
      return {
        ok: false,
        error: `Refund failed: ${(e as Error).message}. Booking not cancelled.`,
      };
    }
  }

  const patch: Record<string, unknown> = { status: "cancelled" };
  // Optimistically net it out; the charge.refunded webhook confirms the same.
  if (refund && canRefundMoney) {
    patch.refunded_minor = bk.total_minor;
    patch.payment_status = "refunded";
  }

  const { error } = await sb
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .neq("status", "cancelled");
  if (error) return { ok: false, error: `Cancel failed: ${error.message}` };

  // Pass redemption: hand the credit(s) back to the pass.
  if (refund && bk.pass_id) {
    await sb.rpc("return_pass_credits", {
      p_pass_id: bk.pass_id,
      p_qty: bk.quantity,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

/** Admin's explicit payment choice for a manual booking. */
export type AdminPaymentChoice = "paid" | "complimentary" | "unpaid";

const PAYMENT_STATUS_BY_CHOICE: Record<AdminPaymentChoice, string> = {
  paid: "paid",
  complimentary: "complimentary",
  unpaid: "pending",
};

export interface AdminAddBookingInput {
  sessionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guests: number;
  /** Staff confirmation that the customer acknowledged the waiver terms. */
  acknowledgeWaiver: boolean;
  /** How the booking is being paid — drives revenue and the payment badge. */
  paymentChoice: AdminPaymentChoice;
}

export type AdminAddBookingResult =
  | { ok: true; bookingId: string }
  | {
      ok: false;
      reason: "waiver_required" | "sold_out" | "session_unavailable" | "error";
      message?: string;
    };

/**
 * Manually add a confirmed booking (capacity-checked). If the customer hasn't
 * signed the active waiver, staff must confirm the customer acknowledged the
 * terms; that acknowledgement is then recorded so it's on file going forward.
 */
export async function adminAddBooking(
  input: AdminAddBookingInput,
): Promise<AdminAddBookingResult> {
  await requireAdmin();

  const sb = createServiceClient();
  const email = input.email.trim().toLowerCase();

  const needsWaiver = await customerNeedsWaiver(sb, email);
  if (needsWaiver && !input.acknowledgeWaiver) {
    return { ok: false, reason: "waiver_required" };
  }

  const { data, error } = await sb.rpc("admin_create_booking", {
    p_session_id: input.sessionId,
    p_quantity: input.guests,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
    p_payment_status: PAYMENT_STATUS_BY_CHOICE[input.paymentChoice],
  });

  if (error) {
    const msg = error.message ?? "";
    const reason = msg.includes("sold_out")
      ? "sold_out"
      : msg.includes("session_unavailable")
        ? "session_unavailable"
        : "error";
    return { ok: false, reason, message: msg };
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Record the acknowledged waiver so the customer is on file next time.
  if (needsWaiver && input.acknowledgeWaiver) {
    const { data: cust } = await sb
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (cust) {
      await sb.from("waivers").upsert(
        {
          customer_id: cust.id,
          version: tenant.waiver.version,
          signature_name:
            `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
        },
        { onConflict: "customer_id,version", ignoreDuplicates: true },
      );
    }
  }

  // Confirmed manual booking → send the customer their confirmation.
  await sendBookingConfirmation(row.booking_id);

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, bookingId: row.booking_id };
}
