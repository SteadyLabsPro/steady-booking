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
