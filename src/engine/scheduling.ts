import type { SchedulingRules } from "./types";
import { addDaysKey, dayKeyWeekday } from "./datetime";

/**
 * Turns scheduling rules into a concrete slot grid. The engine never hard-codes
 * hours, slot length, turnaround, or active days — they all come from config.
 */

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(h)}:${p(m)}`;
}

/** Minutes between consecutive slot starts (session length + turnaround). */
export function slotCadenceMinutes(rules: SchedulingRules): number {
  return rules.slotMinutes + rules.turnaroundMinutes;
}

/**
 * Wall-clock slot start times ("HH:MM") from openTime to lastSlotTime at the
 * configured cadence, e.g. 06:00 … 21:00 hourly.
 */
export function slotStartTimes(rules: SchedulingRules): string[] {
  const open = toMinutes(rules.openTime);
  const last = toMinutes(rules.lastSlotTime);
  const cadence = slotCadenceMinutes(rules);
  const times: string[] = [];
  for (let m = open; m <= last; m += cadence) times.push(toHHMM(m));
  return times;
}

/**
 * The next `count` day keys starting from `todayKey`, keeping only days the
 * business is open (per `daysOfWeek`).
 */
export function activeDayKeys(
  todayKey: string,
  count: number,
  rules: SchedulingRules,
): string[] {
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = addDaysKey(todayKey, i);
    if (rules.daysOfWeek.includes(dayKeyWeekday(key))) days.push(key);
  }
  return days;
}
