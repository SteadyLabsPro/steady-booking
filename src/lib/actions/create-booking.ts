"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";

/** Everything the client collects during the booking flow. */
export interface CreateBookingInput {
  sessionId: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Full-name signature, or null if the waiver was skipped (already signed). */
  signatureName: string | null;
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; expiresAt: string }
  | {
      ok: false;
      reason: "sold_out" | "session_unavailable" | "waiver_required" | "error";
      message?: string;
    };

/**
 * Create a booking via the atomic create_booking() RPC. Runs server-side with
 * the service role. The RPC snapshots price from the DB and holds the spot as a
 * pending booking for the configured hold window.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const sb = createServiceClient();

  const { data, error } = await sb.rpc("create_booking", {
    p_session_id: input.sessionId,
    p_quantity: input.guests,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
    p_waiver_version: tenant.waiver.version,
    p_signature_name: input.signatureName,
    p_hold_minutes: tenant.booking.holdMinutes,
  });

  if (error) {
    const msg = error.message ?? "";
    const reason: Exclude<CreateBookingResult, { ok: true }>["reason"] =
      msg.includes("sold_out")
        ? "sold_out"
        : msg.includes("session_unavailable")
          ? "session_unavailable"
          : msg.includes("waiver_required")
            ? "waiver_required"
            : "error";
    return { ok: false, reason, message: msg };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.booking_id) {
    return { ok: false, reason: "error", message: "No booking returned" };
  }
  return { ok: true, bookingId: row.booking_id, expiresAt: row.expires_at };
}
