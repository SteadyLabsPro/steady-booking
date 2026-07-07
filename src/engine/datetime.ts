/**
 * Date/time formatting for sessions. Everything is formatted in the tenant's
 * timezone (from config) so customers always see local times regardless of
 * where the server runs. Inputs are ISO 8601 strings.
 */

/** e.g. "Tue 7 Jul". */
export function formatSessionDate(
  iso: string,
  timezone: string,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** e.g. "07:00". */
export function formatSessionTime(
  iso: string,
  timezone: string,
  locale = "en-GB",
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** Stable yyyy-mm-dd key in the tenant timezone, for grouping sessions by day. */
export function sessionDateKey(iso: string, timezone: string): string {
  // en-CA formats as yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** Add `n` days to a yyyy-mm-dd key using UTC noon to sidestep DST edges. */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Day of week for a date key in that calendar date (0 = Sunday … 6 = Saturday). */
export function dayKeyWeekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Milliseconds a timezone is ahead of UTC at a given instant (handles DST). */
function tzOffsetMs(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // en-US may render midnight as hour 24; normalise to 0.
  const hour = get("hour") % 24;
  const asLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asLocal - utcMs;
}

/**
 * Convert a wall-clock time on a given date in `timezone` to a UTC ISO string.
 * e.g. ("2026-07-07", "06:00", "Europe/London") → "2026-07-07T05:00:00.000Z".
 */
export function zonedTimeToUtcISO(
  dateKey: string,
  hhmm: string,
  timezone: string,
): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // Correct the guess by the zone offset at that instant.
  const offset = tzOffsetMs(guess, timezone);
  return new Date(guess - offset).toISOString();
}
