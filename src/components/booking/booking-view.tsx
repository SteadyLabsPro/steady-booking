"use client";

import { useMemo, useState } from "react";
import type { TenantWaiver } from "@/engine";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icons";
import { BookingSheet } from "@/components/booking/booking-sheet";

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
  /** e.g. "Tue 7 Jul". */
  dateLabel: string;
  /** e.g. "07:00". */
  time: string;
  /** e.g. "£18.00". */
  price: string;
  /** Unit price in minor units, for computing totals. */
  priceMinor: number;
  remaining: number;
  popular: boolean;
}

interface BookingViewProps {
  services: ServiceView[];
  slots: SlotView[];
  /** Today's yyyy-mm-dd in the tenant timezone (computed server-side). */
  todayKey: string;
  /** ISO 4217 currency code for totals. */
  currency: string;
  /** Waiver policy + copy (shown during checkout). */
  waiver: TenantWaiver;
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

function longDateLabel(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

const pad2 = (x: number) => String(x).padStart(2, "0");

/** A month-grid date picker. Past days are disabled; days with sessions show a
 * dot. Picking a day selects it (even if it's beyond the visible day scroller). */
function MonthCalendar({
  todayKey,
  daysWithSlots,
  selectedKey,
  onPick,
  locale,
}: {
  todayKey: string;
  daysWithSlots: Set<string>;
  selectedKey: string;
  onPick: (key: string) => void;
  locale: string;
}) {
  const [ty, tm] = todayKey.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm }); // m is 1-12

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.y, view.m - 1, 1, 12)));

  // Monday-first offset for the 1st of the month.
  const firstDow =
    (new Date(Date.UTC(view.y, view.m - 1, 1, 12)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0, 12)).getUTCDate();
  const cells: Array<number | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const canPrev = view.y > ty || (view.y === ty && view.m > tm);
  const prev = () =>
    setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  const next = () =>
    setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));

  return (
    <div className="mt-3 w-full max-w-[19rem] rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          onClick={next}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <span
            key={w}
            className="text-[10px] font-semibold uppercase tracking-wide text-muted"
          >
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`blank-${i}`} />;
          const key = `${view.y}-${pad2(view.m)}-${pad2(d)}`;
          const past = key < todayKey;
          const selected = key === selectedKey;
          const hasSlots = daysWithSlots.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={past}
              onClick={() => onPick(key)}
              aria-pressed={selected}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                past && "cursor-not-allowed text-muted/40",
                !past && !selected && "hover:bg-subtle",
                selected && "bg-accent font-semibold text-accent-foreground",
              )}
            >
              {d}
              {hasSlots && !selected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-highlight" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
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

function SlotCard({
  slot,
  onSelect,
}: {
  slot: SlotView;
  onSelect: (slot: SlotView) => void;
}) {
  const soldOut = slot.remaining === 0;
  const open = () => {
    if (!soldOut) onSelect(slot);
  };
  return (
    <div
      role="button"
      tabIndex={soldOut ? -1 : 0}
      aria-disabled={soldOut}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
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
  currency,
  waiver,
  locale = "en-GB",
}: BookingViewProps) {
  const [selectedSlot, setSelectedSlot] = useState<SlotView | null>(null);
  const serviceNameById = useMemo(
    () => new Map(services.map((s) => [s.id, s.name])),
    [services],
  );

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
  const [showCalendar, setShowCalendar] = useState(false);

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
    <section id="book" className="scroll-mt-4 bg-subtle pb-6 pt-2">
      <div className={cn(BOUNDS, "pt-8")}>
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

          {/* Calendar / month picker for dates beyond the scroller */}
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            aria-label="Open calendar"
            aria-expanded={showCalendar}
            className={cn(
              "flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 transition-colors",
              showCalendar
                ? "border-accent bg-accent text-accent-foreground"
                : "border-dashed border-border text-muted hover:bg-subtle",
            )}
          >
            <Icon name="calendar" className="h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {showCalendar ? "Close" : "More"}
            </span>
          </button>
        </div>

        {showCalendar && (
          <MonthCalendar
            todayKey={todayKey}
            daysWithSlots={daysWithSlots}
            selectedKey={selectedKey}
            locale={locale}
            onPick={(key) => {
              setSelectedKey(key);
              setShowCalendar(false);
            }}
          />
        )}

        {/* Selected day — heading + slots. Keyed on the date so it visibly
            re-renders (quick fade) whenever the chosen day changes. */}
        <div key={selectedKey} className="animate-slot-in">
          <div className="mt-8 flex items-baseline gap-2.5">
            <h2 className="font-serif text-2xl tracking-tight">
              {longDateLabel(selectedKey, locale)}
            </h2>
            <span className="text-sm text-muted">
              {daySlots.length > 0
                ? `${daySlots.length} session${daySlots.length === 1 ? "" : "s"}`
                : "No sessions"}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-10">
            {servicesForDay.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
                No sessions on this day. Try another date.
              </div>
            ) : (
              servicesForDay.map(({ service, slots: groupSlots }) => (
                <div key={service.id} className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-foreground">
                      <Icon name={service.icon} className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-semibold tracking-tight">
                          {service.name}
                        </h3>
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                          {service.durationMinutes} min
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-sm text-muted">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groupSlots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        onSelect={setSelectedSlot}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedSlot && (
        <BookingSheet
          slot={{
            id: selectedSlot.id,
            serviceName: serviceNameById.get(selectedSlot.serviceId) ?? "",
            dateLabel: selectedSlot.dateLabel,
            time: selectedSlot.time,
            priceMinor: selectedSlot.priceMinor,
            remaining: selectedSlot.remaining,
          }}
          currency={currency}
          waiver={waiver}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </section>
  );
}
