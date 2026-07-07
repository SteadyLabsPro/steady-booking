import { createServiceClient } from "./server";
import { tenant } from "@/config/tenant.config";
import {
  slotStartTimes,
  activeDayKeys,
  zonedTimeToUtcISO,
  sessionDateKey,
} from "@/engine";

/**
 * Idempotent session generation from the tenant's config rules. Materialises
 * `sessions` rows for a rolling window so customers have real slots to book.
 * Re-running only inserts new slots (never duplicates, never clobbers per-
 * session price/capacity edits) thanks to the unique (service_id, starts_at)
 * index. The same engine helpers drive this and the UI, so DB and screen agree.
 */

// Stable id for the single seed service, so generation stays idempotent.
const SERVICE_ID = "b7c9d0e1-2f34-4a56-8b78-9c0d1e2f3a4b";
const GENERATION_DAYS = 60;
const CHUNK = 500;

// Initial service content (admin can edit later); its length is a config rule.
const SEED_SERVICE = {
  id: SERVICE_ID,
  name: "Sauna & Cold Plunge",
  description: "Traditional Finnish sauna and ice-cold plunge.",
  duration_minutes: tenant.scheduling.slotMinutes,
  is_active: true,
};

export async function generateSessions() {
  const sb = createServiceClient();

  // 1. Ensure the single service exists (idempotent via fixed id).
  const { error: svcErr } = await sb
    .from("services")
    .upsert(SEED_SERVICE, { onConflict: "id", ignoreDuplicates: true });
  if (svcErr) throw new Error(`service upsert failed: ${svcErr.message}`);

  // 2. Build session rows from config rules.
  const todayKey = sessionDateKey(new Date().toISOString(), tenant.timezone);
  const days = activeDayKeys(todayKey, GENERATION_DAYS, tenant.scheduling);
  const times = slotStartTimes(tenant.scheduling);

  const rows = days.flatMap((dateKey) =>
    times.map((time) => ({
      service_id: SERVICE_ID,
      starts_at: zonedTimeToUtcISO(dateKey, time, tenant.timezone),
      capacity: tenant.defaultCapacity,
      price_minor: tenant.pricing.sessionPriceMinor,
      is_active: true,
    })),
  );

  // 3. Idempotent insert in chunks — new slots only.
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await sb
      .from("sessions")
      .upsert(batch, {
        onConflict: "service_id,starts_at",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`session upsert failed: ${error.message}`);
  }

  // 4. Report.
  const { count } = await sb
    .from("sessions")
    .select("*", { head: true, count: "exact" });

  return {
    serviceId: SERVICE_ID,
    days: days.length,
    slotsPerDay: times.length,
    built: rows.length,
    totalSessions: count ?? null,
  };
}
