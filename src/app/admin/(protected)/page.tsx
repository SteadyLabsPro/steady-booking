import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import {
  getAdminBookings,
  getBookableSessions,
  type AdminWindow,
  type AdminBookingStatus,
  type AdminBookingRow,
} from "@/lib/admin/bookings";
import { getRevenueSummary } from "@/lib/admin/revenue";
import { CancelBookingButton } from "@/components/admin/cancel-booking-button";
import { AddBooking } from "@/components/admin/add-booking";

// Live booking data — never cache.
export const dynamic = "force-dynamic";

const WINDOWS: { key: AdminWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const STATUS: Record<AdminBookingStatus, { tone: BadgeTone; label: string }> = {
  confirmed: { tone: "success", label: "Confirmed" },
  pending: { tone: "warning", label: "Pending" },
  expired: { tone: "neutral", label: "Expired" },
  cancelled: { tone: "danger", label: "Cancelled" },
};

function RevenueTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

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
          <CancelBookingButton id={r.id} />
        )}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const window: AdminWindow = (["today", "week", "month"] as const).includes(
    sp.window as AdminWindow,
  )
    ? (sp.window as AdminWindow)
    : "today";

  const [rows, revenue, bookableSessions] = await Promise.all([
    getAdminBookings(window),
    getRevenueSummary(),
    getBookableSessions(),
  ]);
  const money = (minor: number) => formatPrice(minor, tenant.currency);

  // Expired holds are lapsed 15-min baskets — kept out of the main list.
  const active = rows.filter((r) => r.status !== "expired");
  const expired = rows.filter((r) => r.status === "expired");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Revenue</h1>
          <p className="text-sm text-muted">Confirmed bookings only.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RevenueTile label="Today" value={money(revenue.todayMinor)} />
          <RevenueTile label="This week" value={money(revenue.weekMinor)} />
          <RevenueTile label="This month" value={money(revenue.monthMinor)} />
          <RevenueTile label="This year" value={money(revenue.yearMinor)} />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Bookings</h2>
          <p className="text-sm text-muted">
            {active.length} booking{active.length === 1 ? "" : "s"} · by session
            date
          </p>
        </div>
        <AddBooking sessions={bookableSessions} />
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border bg-subtle p-1">
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`/admin?window=${w.key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              window === w.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {w.label}
          </Link>
        ))}
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No bookings in this period.
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
