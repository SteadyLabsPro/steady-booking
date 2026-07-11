import {
  formatPrice,
  formatSessionDate,
  formatSessionTime,
  sessionDateKey,
} from "@/engine";
import { tenant } from "@/config/tenant.config";
import type { Availability } from "@/lib/supabase/availability";
import type { SlotView } from "@/components/booking/booking-view";

// Presentation-only: slot times flagged as popular.
const POPULAR_SLOT_TIMES = new Set<string>(["18:00"]);

/** Map raw availability to the client's ready-to-render slot view models.
 * Shared by the initial server render and the calendar's per-month fetches so
 * both produce identical shapes. */
export function toSlotViews(av: Availability): SlotView[] {
  const activeServiceIds = new Set(av.services.map((s) => s.id));
  return av.sessions
    .filter((s) => activeServiceIds.has(s.serviceId))
    .map((s) => {
      const time = formatSessionTime(s.startsAt, tenant.timezone);
      return {
        id: s.id,
        serviceId: s.serviceId,
        dateKey: sessionDateKey(s.startsAt, tenant.timezone),
        dateLabel: formatSessionDate(s.startsAt, tenant.timezone),
        time,
        price: formatPrice(s.priceMinor, tenant.currency),
        priceMinor: s.priceMinor,
        remaining: av.remainingBySession[s.id] ?? s.capacity,
        popular: POPULAR_SLOT_TIMES.has(time),
      };
    });
}
