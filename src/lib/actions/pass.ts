"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { sendBookingConfirmation } from "@/lib/email/booking-confirmation";

/** An active (unexpired, non-empty) pass for a customer, found by email. */
export async function getActivePass(
  email: string,
): Promise<{
  passId: string;
  remaining: number;
  expiresAt: string | null;
} | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const sb = createServiceClient();
    const { data: customer } = await sb
      .from("customers")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (!customer) return null;

    // Soonest-to-expire pass first, so credits are spent before they lapse.
    const nowIso = new Date().toISOString();
    const { data: pass } = await sb
      .from("passes")
      .select("id, remaining_credits, expires_at")
      .eq("customer_id", customer.id)
      .gt("remaining_credits", 0)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!pass) return null;

    return {
      passId: pass.id,
      remaining: pass.remaining_credits,
      expiresAt: pass.expires_at,
    };
  } catch {
    return null;
  }
}

export interface RedeemPassInput {
  passId: string;
  sessionId: string;
  guests: number;
  email: string;
  /** Signature if the waiver was signed this session (null if already on file). */
  signatureName: string | null;
  groupConsent: boolean;
}

export type RedeemPassResult =
  | { ok: true; bookingId: string; remaining: number }
  | {
      ok: false;
      reason:
        | "insufficient_credits"
        | "pass_expired"
        | "sold_out"
        | "session_unavailable"
        | "group_consent_required"
        | "error";
      message?: string;
    };

/** Redeem pass credits for a session — a confirmed, £0 booking. */
export async function redeemPass(
  input: RedeemPassInput,
): Promise<RedeemPassResult> {
  if (input.guests >= 2 && !input.groupConsent) {
    return { ok: false, reason: "group_consent_required" };
  }

  const sb = createServiceClient();

  // Record the waiver if signed in this session (idempotent).
  if (input.signatureName && input.signatureName.trim()) {
    const { data: customer } = await sb
      .from("customers")
      .select("id")
      .eq("email", input.email.trim().toLowerCase())
      .maybeSingle();
    if (customer) {
      await sb.from("waivers").upsert(
        {
          customer_id: customer.id,
          version: tenant.waiver.version,
          signature_name: input.signatureName.trim(),
        },
        { onConflict: "customer_id,version", ignoreDuplicates: true },
      );
    }
  }

  const { data, error } = await sb.rpc("redeem_pass", {
    p_pass_id: input.passId,
    p_session_id: input.sessionId,
    p_quantity: input.guests,
  });

  if (error) {
    const msg = error.message ?? "";
    const reason = msg.includes("insufficient_credits")
      ? "insufficient_credits"
      : msg.includes("pass_expired")
        ? "pass_expired"
        : msg.includes("sold_out")
          ? "sold_out"
          : msg.includes("session_unavailable")
            ? "session_unavailable"
            : "error";
    return { ok: false, reason, message: msg };
  }

  const row = Array.isArray(data) ? data[0] : data;
  await sendBookingConfirmation(row.booking_id);
  return { ok: true, bookingId: row.booking_id, remaining: row.remaining };
}
