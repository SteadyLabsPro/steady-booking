"use server";

import { tenant } from "@/config/tenant.config";
import { addDaysKey, sessionDateKey, zonedTimeToUtcISO } from "@/engine";
import { getAvailabilityBetween } from "@/lib/supabase/availability";
import { toSlotViews } from "@/lib/booking/slots";
import { MAX_HORIZON_DAYS } from "@/lib/booking/constants";
import type { SlotView } from "@/components/booking/booking-view";

const pad2 = (x: number) => String(x).padStart(2, "0");

/**
 * Slots for a single calendar month (1-12), clamped to [today, horizon]. The
 * calendar calls this lazily as the user switches months, so we never ship
 * three months of availability up front.
 */
export async function fetchMonthSlots(
  year: number,
  month: number,
): Promise<SlotView[]> {
  const now = new Date();
  const todayKey = sessionDateKey(now.toISOString(), tenant.timezone);
  const horizonKey = addDaysKey(todayKey, MAX_HORIZON_DAYS);

  const firstKey = `${year}-${pad2(month)}-01`;
  const nm = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextFirstKey = `${nm.y}-${pad2(nm.m)}-01`;

  // Clamp to the bookable range.
  const startKey = firstKey < todayKey ? todayKey : firstKey;
  const endKey = nextFirstKey > horizonKey ? horizonKey : nextFirstKey;
  if (startKey >= endKey) return [];

  const startISO =
    startKey === todayKey
      ? now.toISOString()
      : zonedTimeToUtcISO(startKey, "00:00", tenant.timezone);
  const endISO = zonedTimeToUtcISO(endKey, "00:00", tenant.timezone);

  const av = await getAvailabilityBetween(startISO, endISO);
  return toSlotViews(av);
}
