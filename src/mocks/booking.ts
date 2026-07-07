import type { Service, Session, Booking } from "@/engine";
import { slotStartTimes, activeDayKeys, zonedTimeToUtcISO } from "@/engine";
import { tenant } from "@/config/tenant.config";

/**
 * Mock, schema-shaped data for the booking screen. There is no backend yet, but
 * sessions are GENERATED from the tenant's scheduling/pricing/capacity rules —
 * no hard-coded hours, prices, or capacities. Swapping this for real Supabase
 * reads (and the Stage 6 slot generator seeded from the same rules) is a
 * drop-in change.
 *
 * Times are stored as UTC ISO strings (as Supabase would return them); the UI
 * renders them in the tenant timezone.
 */

const STAMP = "2026-07-06T12:00:00.000Z";
const DAYS_AHEAD = 14;

/** The single active service. Its length comes from the scheduling rules. */
export const MOCK_SERVICE: Service = {
  id: "svc_sauna_plunge",
  name: "Sauna & Cold Plunge",
  description: "Traditional Finnish sauna and ice-cold plunge.",
  durationMinutes: tenant.scheduling.slotMinutes,
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
};

/** Slot times (e.g. "18:00") flagged as popular — presentation only. */
export const POPULAR_SLOT_TIMES = new Set<string>(["18:00"]);

type DemoBooking = Pick<Booking, "sessionId" | "quantity" | "status">;

function slotId(dateKey: string, time: string): string {
  return `${MOCK_SERVICE.id}_${dateKey}_${time.replace(":", "")}`;
}

/**
 * Build the mock catalogue relative to `todayKey`, generated entirely from
 * config. A little demo occupancy on the first open day gives the UI variety
 * (a full slot, a nearly-full slot, and a partly-booked slot).
 */
export function buildMockBooking(todayKey: string): {
  service: Service;
  sessions: Session[];
  bookings: DemoBooking[];
} {
  const times = slotStartTimes(tenant.scheduling);
  const days = activeDayKeys(todayKey, DAYS_AHEAD, tenant.scheduling);
  const capacity = tenant.defaultCapacity;
  const priceMinor = tenant.pricing.sessionPriceMinor;

  const sessions: Session[] = [];
  for (const dateKey of days) {
    for (const time of times) {
      sessions.push({
        id: slotId(dateKey, time),
        serviceId: MOCK_SERVICE.id,
        startsAt: zonedTimeToUtcISO(dateKey, time, tenant.timezone),
        capacity,
        priceMinor,
        isActive: true,
        createdAt: STAMP,
        updatedAt: STAMP,
      });
    }
  }

  // Demo occupancy on the first open day: slot 1 full, slot 2 nearly full,
  // slot 4 partly booked. A cancelled booking proves it doesn't consume a spot.
  const bookings: DemoBooking[] = [];
  const firstDay = days[0];
  if (firstDay) {
    const occupancy: Record<number, number> = {
      1: capacity, // fully booked
      2: capacity - 1, // only 1 left
      4: 3, // a few left
    };
    for (const [idx, booked] of Object.entries(occupancy)) {
      const time = times[Number(idx)];
      if (!time || booked <= 0) continue;
      bookings.push({
        sessionId: slotId(firstDay, time),
        quantity: booked,
        status: "confirmed",
      });
    }
    if (times[2]) {
      bookings.push({
        sessionId: slotId(firstDay, times[2]),
        quantity: 2,
        status: "cancelled",
      });
    }
  }

  return { service: MOCK_SERVICE, sessions, bookings };
}
