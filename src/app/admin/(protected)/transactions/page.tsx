import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminTransactions,
  revenueMinor,
  isDateKey,
  todayKey,
  type AdminTransaction,
} from "@/lib/admin/transactions";
import { addDaysKey, dayKeyWeekday } from "@/engine";

// Live financial data — never cache.
export const dynamic = "force-dynamic";

const PAYMENT: Record<string, { tone: BadgeTone; label: string }> = {
  paid: { tone: "success", label: "Paid" },
  complimentary: { tone: "neutral", label: "Complimentary" },
  refunded: { tone: "danger", label: "Refunded" },
};

/** Quick-range presets, resolved against today in the venue's timezone. */
function presets(today: string) {
  const weekday = dayKeyWeekday(today); // 0 = Sun … 6 = Sat
  const monday = addDaysKey(today, -((weekday + 6) % 7));
  const [y, m] = today.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  return [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: addDaysKey(today, -1), to: addDaysKey(today, -1) },
    { label: "This week", from: monday, to: today },
    { label: "This month", from: firstOfMonth, to: today },
    { label: "Last 30 days", from: addDaysKey(today, -29), to: today },
  ];
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Row({ t }: { t: AdminTransaction }) {
  const tz = tenant.timezone;
  const pay = PAYMENT[t.paymentStatus] ?? {
    tone: "neutral" as BadgeTone,
    label: t.paymentStatus,
  };
  const isPass = t.kind === "pass";

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium tabular-nums">
            {formatSessionDate(t.occurredAt, tz)} ·{" "}
            {formatSessionTime(t.occurredAt, tz)}
          </span>
          <Badge tone="neutral">
            {isPass
              ? `${t.quantity}-visit pass`
              : `Booking · ${t.quantity} guest${t.quantity === 1 ? "" : "s"}`}
          </Badge>
          <Badge tone={pay.tone}>{pay.label}</Badge>
        </div>
        <span className="text-sm text-muted">
          {t.customerName || "—"} · {t.email || "—"}
        </span>
        <span className="text-xs text-muted">
          {t.sessionStartsAt
            ? `Session ${formatSessionDate(t.sessionStartsAt, tz)} · ${formatSessionTime(t.sessionStartsAt, tz)}`
            : "Pass purchase"}
          {" · ref "}
          {t.reference}
          {t.stripeRef ? ` · Stripe ${t.stripeRef.slice(0, 14)}…` : " · not Stripe"}
        </span>
      </div>
      <span
        className={cn(
          "shrink-0 text-base font-semibold tabular-nums",
          t.amountMinor === 0 && "text-muted",
        )}
      >
        {formatPrice(t.amountMinor, tenant.currency)}
      </span>
    </div>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = todayKey();
  const from = isDateKey(sp.from) ? sp.from : today;
  const toRaw = isDateKey(sp.to) ? sp.to : from;
  const to = toRaw < from ? from : toRaw;

  const rows = await getAdminTransactions(from, to);
  const money = (minor: number) => formatPrice(minor, tenant.currency);

  const taken = revenueMinor(rows);
  const bookings = rows.filter((r) => r.kind === "booking");
  const passes = rows.filter((r) => r.kind === "pass");
  const exportHref = `/admin/transactions/export?from=${from}&to=${to}`;
  const ranges = presets(today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted">
          Money taken, by payment date — bookings and pass sales.
        </p>
      </div>

      {/* Date range picker — a plain GET form, no JS needed. */}
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
        <a href={exportHref} className="ml-auto">
          <Button type="button" variant="outline">
            Download CSV
          </Button>
        </a>
      </form>

      <div className="flex flex-wrap gap-2">
        {ranges.map((r) => {
          const active = r.from === from && r.to === to;
          return (
            <Link
              key={r.label}
              href={`/admin/transactions?from=${r.from}&to=${r.to}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface text-muted hover:bg-subtle",
              )}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Taken" value={money(taken)} />
        <Tile label="Transactions" value={String(rows.length)} />
        <Tile label="Bookings" value={String(bookings.length)} />
        <Tile label="Pass sales" value={String(passes.length)} />
      </div>

      <section className="rounded-xl border border-border bg-surface px-4">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No transactions in this period.
          </p>
        ) : (
          rows.map((t) => <Row key={`${t.kind}-${t.reference}-${t.occurredAt}`} t={t} />)
        )}
      </section>

      <p className="text-xs text-muted">
        {from === to
          ? `Showing ${formatSessionDate(sessionISO(from), tenant.timezone)}.`
          : `Showing ${formatSessionDate(sessionISO(from), tenant.timezone)} – ${formatSessionDate(sessionISO(to), tenant.timezone)}.`}{" "}
        &ldquo;Taken&rdquo; counts paid transactions only — complimentary and
        pass-redemption bookings are £0, so nothing double-counts.
      </p>
    </div>
  );
}

/** Midday ISO for a date key, purely for display formatting. */
function sessionISO(key: string): string {
  return `${key}T12:00:00.000Z`;
}
