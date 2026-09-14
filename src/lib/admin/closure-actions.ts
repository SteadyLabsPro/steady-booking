"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { addDaysKey, zonedTimeToUtcISO } from "@/engine";
import { requireAdmin } from "./auth";

export interface ClosureResult {
  ok: boolean;
  error?: string;
}

/**
 * Block or unblock a single session. Blocking sets is_active=false, which
 * removes it from the customer booking flow immediately. It does NOT touch any
 * existing bookings on the session — those are handled separately on Bookings.
 */
export async function setSessionActive(
  sessionId: string,
  active: boolean,
): Promise<ClosureResult> {
  await requireAdmin();
  const sb = createServiceClient();
  const { error } = await sb
    .from("sessions")
    .update({ is_active: active })
    .eq("id", sessionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/closures");
  revalidatePath("/");
  return { ok: true };
}

/** Block or unblock every session on a whole day (e.g. facility out of order). */
export async function setDayActive(
  dateKey: string,
  active: boolean,
): Promise<ClosureResult> {
  await requireAdmin();
  const tz = tenant.timezone;
  const fromISO = zonedTimeToUtcISO(dateKey, "00:00", tz);
  const toISO = zonedTimeToUtcISO(addDaysKey(dateKey, 1), "00:00", tz);

  const sb = createServiceClient();
  const { error } = await sb
    .from("sessions")
    .update({ is_active: active })
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/closures");
  revalidatePath("/");
  return { ok: true };
}
