"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icons";

/**
 * Interactive booking view: a horizontal date scroller with a day-at-a-time
 * list of session slots. All engine work (pricing, remaining spaces, timezone
 * formatting) happens on the server; this component receives ready-to-render
 * view models and only owns the selected-date interaction.
 */

const DAYS_VISIBLE = 14;
const LOW_STOCK_THRESHOLD = 2;
const BOUNDS = "mx-auto w-full max-w-6xl px-5 sm:px-8";

export interface ServiceView {
  id: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  icon: IconName;
}

export interface SlotView {
  id: string;
  serviceId: string;
  /** yyyy-mm-dd in the tenant timezone. */
  dateKey: string;
  /** e.g. "07:00". */
  time: string;
  /** e.g. "£18.00". */
  price: string;
  remaining: number;
  popular: boolean;
}

interface BookingViewProps {
  services: ServiceView[];
  slots: SlotView[];
  /** Today's yyyy-mm-dd in the tenant timezone (computed server-side). */
  todayKey: string;
  locale?: string;
}

/** Add `n` days to a yyyy-mm-dd key using UTC noon to sidestep DST edges. */
function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

function dayNumber(key: string): number {
  return Number(key.split("-")[2]);
}

function weekdayShort(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function RemainingBadge({ remaining }: { remaining: number }) {
  if (remaining === 0) {
    return <span className="text-sm text-muted">Fully booked</span>;
  }
  if (remaining <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="text-sm font-medium text-highlight">
        Only {remaining} left
      </span>
    );
  }
  return <span className="text-sm text-muted">{remaining} spaces left</span>;
}

function SlotCard({ slot }: { slot: SlotView }) {
  const soldOut = slot.remaining === 0;
  return (
    <div
      role="button"
      tabIndex={soldOut ? -1 : 0}
      aria-disabled={soldOut}
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors",
        soldOut
          ? "opacity-60"
          : "cursor-pointer hover:border-accent/30 active:scale-[0.99]",
      )}
    >
      {/* Reserved badge row keeps time baselines aligned across cards */}
      <div className="h-5">
        {slot.popular && (
          <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
            Popular
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold tabular-nums">{slot.time}</span>
          <RemainingBadge remaining={slot.remaining} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tabular-nums">
            {slot.price}
          </span>
          {!soldOut && (
            <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-muted" />
          )}
        </div>
      </div>
    </div>
  );
}

export function BookingView({
  services,
  slots,
  todayKey,
  locale = "en-GB",
}: BookingViewProps) {
  const tomorrowKey = useMemo(() => addDaysKey(todayKey, 1), [todayKey]);

  const dateKeys = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDaysKey(todayKey, i)),
    [todayKey],
  );

  const daysWithSlots = useMemo(
    () => new Set(slots.map((s) => s.dateKey)),
    [slots],
  );

  const [selectedKey, setSelectedKey] = useState(
    () => dateKeys.find((k) => daysWithSlots.has(k)) ?? todayKey,
  );
  const [showMoreHint, setShowMoreHint] = useState(false);

  const label = (key: string) =>
    key === todayKey
      ? "Today"
      : key === tomorrowKey
        ? "Tmrw"
        : weekdayShort(key, locale);

  const daySlots = slots
    .filter((s) => s.dateKey === selectedKey)
    .sort((a, b) => a.time.localeCompare(b.time));

  const servicesForDay = services
    .map((service) => ({
      service,
      slots: daySlots.filter((s) => s.serviceId === service.id),
    }))
    .filter((group) => group.slots.length > 0);

  return (
    <section id="book" className="scroll-mt-4 pt-2">
      <div className={cn(BOUNDS, "border-t border-border pt-8")}>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          Choose a date
        </p>

        {/* Horizontal date scroller */}
        <div
          className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Choose a date"
        >
          {dateKeys.map((key) => {
            const selected = key === selectedKey;
            const hasSlots = daysWithSlots.has(key);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setSelectedKey(key)}
                className={cn(
                  "flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-colors",
                  selected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-foreground hover:bg-subtle",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    selected ? "text-accent-foreground/75" : "text-muted",
                  )}
                >
                  {label(key)}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {dayNumber(key)}
                </span>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    hasSlots
                      ? selected
                        ? "bg-accent-foreground"
                        : "bg-highlight"
                      : "bg-transparent",
                  )}
                />
              </button>
            );
          })}

          {/* Placeholder entry point for a future calendar / month picker */}
          <button
            type="button"
            onClick={() => setShowMoreHint((v) => !v)}
            aria-label="More dates"
            className="flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-3 text-muted transition-colors hover:bg-subtle"
          >
            <Icon name="calendar" className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              More
            </span>
          </button>
        </div>

        {showMoreHint && (
          <p className="mt-2 text-xs text-muted">
            A full calendar picker will open here.
          </p>
        )}

        {/* Slots for the selected day */}
        <div className="mt-8 flex flex-col gap-10">
          {servicesForDay.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
              No sessions on this day. Try another date.
            </div>
          ) : (
            servicesForDay.map(({ service, slots: groupSlots }) => (
              <div key={service.id} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-subtle text-foreground">
                    <Icon name={service.icon} className="h-5 w-5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {service.name}
                      </h2>
                      <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-muted">
                        {service.durationMinutes} min
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted">{service.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupSlots.map((slot) => (
                    <SlotCard key={slot.id} slot={slot} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
