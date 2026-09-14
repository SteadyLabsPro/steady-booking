import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import {
  formatSessionDate,
  formatSessionTime,
  addDaysKey,
} from "@/engine";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/ui/button";
import { getDaySessions } from "@/lib/admin/closures";
import { isDateKey, todayKey } from "@/lib/admin/transactions";
import { SessionBlockToggle } from "@/components/admin/session-block-toggle";
import { DayBlockButtons } from "@/components/admin/day-block-buttons";

// Live availability data — never cache.
export const dynamic = "force-dynamic";

/** Midday ISO for a date key, purely for display formatting. */
function sessionISO(key: string): string {
  return `${key}T12:00:00.000Z`;
}

export default async function ClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayKey();
  const date = isDateKey(sp.date) ? sp.date : today;
  const sessions = await getDaySessions(date);
  const tz = tenant.timezone;

  const anyActive = sessions.some((s) => s.isActive);
  const blockedCount = sessions.filter((s) => !s.isActive).length;
  const bookedOnActive = sessions.reduce(
    (n, s) => n + (s.isActive ? s.bookedGuests : 0),
    0,
  );

  const quick = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDaysKey(today, 1) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Closures</h1>
        <p className="text-sm text-muted">
          Block sessions so customers can&rsquo;t book them — e.g. maintenance or
          a deep clean. Blocking removes a slot from the booking page instantly.
        </p>
      </div>

      {/* Date picker + whole-day actions */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <Button type="submit">Show</Button>
        {sessions.length > 0 && (
          <div className="ml-auto">
            <DayBlockButtons
              dateKey={date}
              anyActive={anyActive}
              bookedGuests={bookedOnActive}
            />
          </div>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <Link
            key={q.label}
            href={`/admin/closures?date=${q.date}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              q.date === date
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface text-muted hover:bg-subtle",
            )}
          >
            {q.label}
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-surface px-4">
        {sessions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            No sessions on {formatSessionDate(sessionISO(date), tz)}.
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    !s.isActive && "text-muted line-through",
                  )}
                >
                  {formatSessionTime(s.startsAt, tz)}
                </span>
                {!s.isActive && <Badge tone="danger">Blocked</Badge>}
                {s.bookedGuests > 0 && (
                  <Badge tone="warning">
                    {s.bookedGuests} booked
                  </Badge>
                )}
              </div>
              <SessionBlockToggle
                id={s.id}
                active={s.isActive}
                bookedGuests={s.bookedGuests}
              />
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-muted">
        {blockedCount > 0
          ? `${blockedCount} session${blockedCount === 1 ? "" : "s"} blocked on this day. `
          : ""}
        A blocked session disappears from the customer booking page immediately.
        Anyone already booked keeps their booking — cancel &amp; refund those on
        the{" "}
        <Link href="/admin/bookings" className="text-accent hover:underline">
          Bookings
        </Link>{" "}
        page if the closure affects them.
      </p>
    </div>
  );
}
