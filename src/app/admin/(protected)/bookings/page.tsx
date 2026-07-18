import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import {
  formatPrice,
  formatSessionDate,
  formatSessionTime,
  addDaysKey,
  dayKeyWeekday,
} from "@/engine";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminBookings,
  getBookableSessions,
  type AdminBookingStatus,
  type AdminBookingRow,
} from "@/lib/admin/bookings";
import { isDateKey, todayKey } from "@/lib/admin/transactions";
import { CancelBookingButton } from "@/components/admin/cancel-booking-button";
import { AddBooking } from "@/components/admin/add-booking";
import { SellPass } from "@/components/admin/sell-pass";

// Live booking data — never cache.
export const dynamic = "force-dynamic";

/** Quick date-range presets for the bookings list, by session date. */
function bookingPresets(today: string) {
  const weekday = dayKeyWeekday(today); // 0 = Sun … 6 = Sat
  const monday = addDaysKey(today, -((weekday + 6) % 7));
  return [
    { label: "Today", from: today, to: today },
    { label: "Tomorrow", from: addDaysKey(today, 1), to: addDaysKey(today, 1) },
    { label: "This week", from: monday, to: addDaysKey(monday, 6) },
    { label: "Next 7 days", from: today, to: addDaysKey(today, 6) },
    { label: "Next 30 days", from: today, to: addDaysKey(today, 29) },
    { label: "Next 90 days", from: today, to: addDaysKey(today, 89) },
  ];
}

const STATUS: Record<AdminBookingStatus, { tone: BadgeTone; label: string }> = {
  confirmed: { tone: "success", label: "Confirmed" },
  pending: { tone: "warning", label: "Pending" },
  expired: { tone: "neutral", label: "Expired" },
  cancelled: { tone: "danger", label: "Cancelled" },
};

const PAYMENT: Record<
  AdminBookingRow["paymentStatus"],
  { tone: BadgeTone; label: string }
> = {
  paid: { tone: "success", label: "Paid" },
  pending: { tone: "warning", label: "Unpaid" },
  complimentary: { tone: "neutral", label: "Complimentary" },
  failed: { tone: "danger", label: "Payment failed" },
  refunded: { tone: "neutral", label: "Refunded" },
  cancelled: { tone: "neutral", label: "Payment cancelled" },
};

function BookingRow({ r }: { r: AdminBookingRow }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium tabular-nums">
          {formatSessionDate(r.startsAt, tenant.timezone)} ·{" "}
          {formatSessionTime(r.startsAt, tenant.timezone)}
        </span>
        <span className="text-sm text-muted">
          {r.customerName || "—"} · {r.email}
          {r.phone ? ` · ${r.phone}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        <Badge tone={PAYMENT[r.paymentStatus].tone}>
          {PAYMENT[r.paymentStatus].label}
        </Badge>
        <Badge tone={r.waiverSigned ? "success" : "danger"}>
          {r.waiverSigned ? `Waiver v${tenant.waiver.version}` : "No waiver"}
        </Badge>
        <span className="text-sm text-muted">
          {r.guests} {r.guests === 1 ? "guest" : "guests"}
        </span>
        <span className="font-semibold tabular-nums">
          {formatPrice(r.totalMinor, tenant.currency)}
        </span>
        {(r.status === "confirmed" || r.status === "pending") && (
          <CancelBookingButton id={r.id} refundKind={r.refundKind} />
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = todayKey();
  const from = isDateKey(sp.from) ? sp.from : today;
  const toRaw = isDateKey(sp.to) ? sp.to : from;
  const to = toRaw < from ? from : toRaw;

  const [rows, bookableSessions] = await Promise.all([
    getAdminBookings(from, to),
    getBookableSessions(),
  ]);
  const presets = bookingPresets(today);

  // Expired holds are lapsed 15-min baskets — kept out of the main list.
  const active = rows.filter((r) => r.status !== "expired");
  const expired = rows.filter((r) => r.status === "expired");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Bookings</h2>
          <p className="text-sm text-muted">
            {active.length} booking{active.length === 1 ? "" : "s"} · by session
            date
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <SellPass />
          <AddBooking sessions={bookableSessions} />
        </div>
      </div>

      {/* Date-range filter, by session date */}
      <div className="flex flex-col gap-3">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <Button type="submit">Show</Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const activePreset = p.from === from && p.to === to;
            return (
              <Link
                key={p.label}
                href={`/admin/bookings?from=${p.from}&to=${p.to}`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  activePreset
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-muted hover:bg-subtle",
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No bookings in this date range.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((r) => (
            <BookingRow key={r.id} r={r} />
          ))}
        </div>
      )}

      {expired.length > 0 && (
        <details className="rounded-xl border border-border bg-subtle/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Expired holds ({expired.length})
          </summary>
          <p className="mt-1 text-xs text-muted">
            Baskets that weren&rsquo;t paid within the 15-minute hold — they
            don&rsquo;t take up any spaces.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {expired.map((r) => (
              <BookingRow key={r.id} r={r} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
