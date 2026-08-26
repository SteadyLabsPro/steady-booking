import Link from "next/link";
import { notFound } from "next/navigation";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import { getAdminPass, type AdminPassStatus } from "@/lib/admin/passes";

// Live pass data — never cache.
export const dynamic = "force-dynamic";

const STATUS: Record<AdminPassStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  used: { tone: "neutral", label: "Fully used" },
  expired: { tone: "warning", label: "Expired" },
  refunded: { tone: "danger", label: "Refunded" },
};

const BOOKING_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  confirmed: { tone: "success", label: "Confirmed" },
  pending: { tone: "warning", label: "Pending" },
  cancelled: { tone: "danger", label: "Cancelled" },
  expired: { tone: "neutral", label: "Expired" },
};

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

export default async function PassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pass = await getAdminPass(id);
  if (!pass) notFound();

  const tz = tenant.timezone;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/passes"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        ← Back to passes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {pass.customerName || "—"}
          </h1>
          <p className="text-sm text-muted">
            {pass.email || "—"}
            {pass.phone ? ` · ${pass.phone}` : ""}
          </p>
        </div>
        <Badge tone={STATUS[pass.status].tone}>{STATUS[pass.status].label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Credits left"
          value={`${pass.remainingCredits} of ${pass.totalCredits}`}
        />
        <Tile label="Used" value={String(pass.usedCredits)} />
        <Tile label="Paid" value={formatPrice(pass.priceMinor, tenant.currency)} />
        <Tile
          label="Expires"
          value={pass.expiresAt ? formatSessionDate(pass.expiresAt, tz) : "—"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">
          Sessions booked with this pass
        </h2>
        <section className="rounded-xl border border-border bg-surface px-4">
          {pass.bookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              No sessions booked on this pass yet.
            </div>
          ) : (
            pass.bookings.map((b) => {
              const s = BOOKING_STATUS[b.status] ?? {
                tone: "neutral" as BadgeTone,
                label: b.status,
              };
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium tabular-nums">
                      {b.startsAt
                        ? `${formatSessionDate(b.startsAt, tz)} · ${formatSessionTime(b.startsAt, tz)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-muted">
                      {b.guests} {b.guests === 1 ? "guest" : "guests"} ·{" "}
                      {b.guests} credit{b.guests === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
              );
            })
          )}
        </section>
        <p className="text-xs text-muted">
          To cancel a session and hand its credit back, open it on the{" "}
          <Link href="/admin/bookings" className="text-accent hover:underline">
            Bookings
          </Link>{" "}
          page and choose &ldquo;Cancel &amp; return credit&rdquo;.
        </p>
      </div>
    </div>
  );
}
