"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TenantWaiver } from "@/engine";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icons";
import { BookingSheet } from "@/components/booking/booking-sheet";
import { fetchMonthSlots } from "@/lib/actions/availability";
import { MAX_HORIZON_DAYS } from "@/lib/booking/constants";

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

function monthShort(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function longMonthYear(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

const pad2 = (x: number) => String(x).padStart(2, "0");

/** A month-grid date picker. Past days are disabled; days with sessions show a
 * dot. Picking a day selects it (even if it's beyond the visible day scroller). */
function MonthCalendar({
  todayKey,
  horizonKey,
  daysWithSlots,
  selectedKey,
  loading,
  onPick,
  onMonthView,
  locale,
}: {
  todayKey: string;
  horizonKey: string;
  daysWithSlots: Set<string>;
  selectedKey: string;
  loading: boolean;
  onPick: (key: string) => void;
  onMonthView: (year: number, month: number) => void;
  locale: string;
}) {
  const [ty, tm] = todayKey.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm }); // m is 1-12

  // Ask the parent to load this month's availability whenever it's shown.
  useEffect(() => {
    onMonthView(view.y, view.m);
  }, [view, onMonthView]);

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
  const nm = view.m === 12 ? { y: view.y + 1, m: 1 } : { y: view.y, m: view.m + 1 };
  const canNext = `${nm.y}-${pad2(nm.m)}-01` <= horizonKey;
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
        <span className="flex items-center gap-2 text-sm font-semibold">
          {monthLabel}
          {loading && (
            <span className="text-[10px] font-normal uppercase tracking-wide text-muted">
              Loading…
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>

      <div
        aria-busy={loading}
        className={cn(
          "mt-3 grid grid-cols-7 gap-1 text-center transition-opacity",
          loading && "opacity-50",
        )}
      >
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
  slots: initialSlots,
  todayKey,
  currency,
  waiver,
  locale = "en-GB",
}: BookingViewProps) {
  // Slots start with the near-term window from the server, then grow as the
  // calendar lazily loads whole months on demand.
  const [slots, setSlots] = useState(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState<SlotView | null>(null);
  const serviceNameById = useMemo(
    () => new Map(services.map((s) => [s.id, s.name])),
    [services],
  );

  const horizonKey = useMemo(
    () => addDaysKey(todayKey, MAX_HORIZON_DAYS),
    [todayKey],
  );
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  const [monthLoading, setMonthLoading] = useState(false);

  const ensureMonth = useCallback(async (y: number, m: number) => {
    const mk = `${y}-${pad2(m)}`;
    if (loadedMonthsRef.current.has(mk)) return;
    loadedMonthsRef.current.add(mk); // mark up front to dedupe in-flight loads
    setMonthLoading(true);
    try {
      const fetched = await fetchMonthSlots(y, m);
      setSlots((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const add = fetched.filter((s) => !seen.has(s.id));
        return add.length ? [...prev, ...add] : prev;
      });
    } catch {
      loadedMonthsRef.current.delete(mk); // allow a retry if it failed
    } finally {
      setMonthLoading(false);
    }
  }, []);

  const tomorrowKey = useMemo(() => addDaysKey(todayKey, 1), [todayKey]);

  // The scroller shows a paged window of DAYS_VISIBLE days; arrows move it
  // across the whole bookable horizon, loading each month lazily as it enters.
  const [windowStart, setWindowStart] = useState(todayKey);

  const dateKeys = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < DAYS_VISIBLE; i++) {
      const k = addDaysKey(windowStart, i);
      if (k > horizonKey) break;
      out.push(k);
    }
    return out;
  }, [windowStart, horizonKey]);

  const lastVisibleKey = dateKeys[dateKeys.length - 1] ?? windowStart;
  const canPageBack = windowStart > todayKey;
  const canPageForward = lastVisibleKey < horizonKey;

  // Month(s) currently in view — shown above the strip so paging is legible.
  const rangeLabel = useMemo(() => {
    if (dateKeys.length === 0) return "";
    const first = dateKeys[0];
    const last = dateKeys[dateKeys.length - 1];
    const [fy, fm] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    if (fy === ly && fm === lm) return longMonthYear(first, locale);
    if (fy !== ly)
      return `${longMonthYear(first, locale)} – ${longMonthYear(last, locale)}`;
    const firstMonth = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(fy, fm - 1, 15, 12)));
    return `${firstMonth} – ${longMonthYear(last, locale)}`;
  }, [dateKeys, locale]);
  const pageBack = () =>
    setWindowStart((s) => {
      const back = addDaysKey(s, -DAYS_VISIBLE);
      return back < todayKey ? todayKey : back;
    });
  const pageForward = () => setWindowStart((s) => addDaysKey(s, DAYS_VISIBLE));

  // Load availability for whichever month(s) the visible window covers.
  useEffect(() => {
    if (dateKeys.length === 0) return;
    const first = dateKeys[0];
    const last = dateKeys[dateKeys.length - 1];
    const [fy, fm] = first.split("-").map(Number);
    ensureMonth(fy, fm);
    const [ly, lm] = last.split("-").map(Number);
    if (ly !== fy || lm !== fm) ensureMonth(ly, lm);
  }, [dateKeys, ensureMonth]);

  const daysWithSlots = useMemo(
    () => new Set(slots.map((s) => s.dateKey)),
    [slots],
  );

  const [selectedKey, setSelectedKey] = useState(
    () =>
      Array.from({ length: DAYS_VISIBLE }, (_, i) => addDaysKey(todayKey, i)).find(
        (k) => daysWithSlots.has(k),
      ) ?? todayKey,
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
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
            Choose a date
          </p>
          {rangeLabel && (
            <span className="text-sm font-semibold tracking-tight">
              {rangeLabel}
            </span>
          )}
        </div>

        {/* Paged date scroller: arrows step across the full booking window */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={pageBack}
            disabled={!canPageBack}
            aria-label="Earlier dates"
            className="flex h-[4.25rem] w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-30"
          >
            <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
          </button>

          <div
            className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1"
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
                  "relative flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors",
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
                <span className="text-lg font-semibold leading-none tabular-nums">
                  {dayNumber(key)}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    selected ? "text-accent-foreground/75" : "text-muted",
                  )}
                >
                  {monthShort(key, locale)}
                </span>
                {hasSlots && (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                      selected ? "bg-accent-foreground" : "bg-highlight",
                    )}
                  />
                )}
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

          <button
            type="button"
            onClick={pageForward}
            disabled={!canPageForward}
            aria-label="Later dates"
            className="flex h-[4.25rem] w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-30"
          >
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        </div>

        {showCalendar && (
          <MonthCalendar
            todayKey={todayKey}
            horizonKey={horizonKey}
            daysWithSlots={daysWithSlots}
            selectedKey={selectedKey}
            loading={monthLoading}
            locale={locale}
            onMonthView={ensureMonth}
            onPick={(key) => {
              setSelectedKey(key);
              setWindowStart(key < todayKey ? todayKey : key);
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
