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
