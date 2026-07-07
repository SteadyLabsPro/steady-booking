import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import {
  getAdminBookings,
  type AdminWindow,
  type AdminBookingStatus,
} from "@/lib/admin/bookings";

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

  const rows = await getAdminBookings(window);
  const tz = tenant.timezone;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted">
          {rows.length} booking{rows.length === 1 ? "" : "s"} · by session date
        </p>
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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No bookings in this period.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium tabular-nums">
                  {formatSessionDate(r.startsAt, tz)} ·{" "}
                  {formatSessionTime(r.startsAt, tz)}
                </span>
                <span className="text-sm text-muted">
                  {r.customerName || "—"} · {r.email}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge tone={STATUS[r.status].tone}>
                  {STATUS[r.status].label}
                </Badge>
                <Badge tone={r.waiverSigned ? "success" : "danger"}>
                  {r.waiverSigned
                    ? `Waiver v${tenant.waiver.version}`
                    : "No waiver"}
                </Badge>
                <span className="text-sm text-muted">
                  {r.guests} {r.guests === 1 ? "guest" : "guests"}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatPrice(r.totalMinor, tenant.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
