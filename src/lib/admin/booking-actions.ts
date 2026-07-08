"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "./auth";

/**
 * Cancel a booking — sets status to 'cancelled' (never deletes). The
 * availability view already excludes cancelled bookings, so the spot frees
 * automatically. Guarded; no-op if the booking is already cancelled.
 */
export async function cancelBooking(id: string): Promise<void> {
  await requireAdmin();

  const sb = createServiceClient();
  const { error } = await sb
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) throw new Error(`cancel failed: ${error.message}`);
  revalidatePath("/admin");
}

export interface AdminAddBookingInput {
  sessionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guests: number;
}

export type AdminAddBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "sold_out" | "session_unavailable" | "error"; message?: string };

/** Manually add a confirmed booking (capacity-checked, no waiver required). */
export async function adminAddBooking(
  input: AdminAddBookingInput,
): Promise<AdminAddBookingResult> {
  await requireAdmin();

  const sb = createServiceClient();
  const { data, error } = await sb.rpc("admin_create_booking", {
    p_session_id: input.sessionId,
    p_quantity: input.guests,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_email: input.email.trim(),
    p_phone: input.phone.trim(),
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
  revalidatePath("/admin");
  return { ok: true, bookingId: row.booking_id };
}
