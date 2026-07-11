import { createServiceClient } from "./server";
import { tenant } from "@/config/tenant.config";
import { addDaysKey, zonedTimeToUtcISO } from "@/engine";
import type { Service, Session } from "@/engine";

/**
 * Server-side availability reads. Runs with the service role (never client
 * side) so the aggregated remaining-spaces view is accurate without exposing
 * individual bookings. Maps snake_case DB rows to the engine's camelCase
 * domain types here, so the rest of the app only speaks domain.
 */

export interface Availability {
  services: Service[];
  sessions: Session[];
  /** sessionId → remaining spaces (from the session_availability view). */
  remainingBySession: Record<string, number>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapService(r: any): Service {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSession(r: any): Session {
  return {
    id: r.id,
    serviceId: r.service_id,
    startsAt: r.starts_at,
    capacity: r.capacity,
    priceMinor: r.price_minor,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Active services + bookable sessions from now to `windowDays` ahead, with
 * remaining spaces. Past slots are excluded (lower bound is the current time).
 */
export async function getAvailability(
  todayKey: string,
  windowDays: number,
): Promise<Availability> {
  const startISO = new Date().toISOString();
  const endISO = zonedTimeToUtcISO(
    addDaysKey(todayKey, windowDays),
    "00:00",
    tenant.timezone,
  );
  return getAvailabilityBetween(startISO, endISO);
}

/**
 * Active services + bookable sessions in an explicit [startISO, endISO) range,
 * with remaining spaces. Used for both the initial near-term window and the
 * calendar's lazy per-month fetches.
 */
export async function getAvailabilityBetween(
  startISO: string,
  endISO: string,
): Promise<Availability> {
  const sb = createServiceClient();

  const { data: svc, error: svcErr } = await sb
    .from("services")
    .select("*")
    .eq("is_active", true);
  if (svcErr) throw new Error(`services read failed: ${svcErr.message}`);

  const { data: sess, error: sessErr } = await sb
    .from("sessions")
    .select("*")
    .eq("is_active", true)
    .gte("starts_at", startISO)
    .lt("starts_at", endISO)
    .order("starts_at", { ascending: true });
  if (sessErr) throw new Error(`sessions read failed: ${sessErr.message}`);

  const sessions = (sess ?? []).map(mapSession);

  const remainingBySession: Record<string, number> = {};
  if (sessions.length > 0) {
    const { data: avail, error: aErr } = await sb
      .from("session_availability")
      .select("session_id, remaining_spaces")
      .in(
        "session_id",
        sessions.map((s) => s.id),
      );
    if (aErr) throw new Error(`availability read failed: ${aErr.message}`);
    for (const row of avail ?? []) {
      remainingBySession[row.session_id] = row.remaining_spaces;
    }
  }

  return {
    services: (svc ?? []).map(mapService),
    sessions,
    remainingBySession,
  };
}
