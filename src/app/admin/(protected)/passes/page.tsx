import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { formatSessionDate } from "@/engine";
import { Badge, type BadgeTone } from "@/components/admin/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { getAdminPasses, type AdminPassStatus } from "@/lib/admin/passes";

// Live pass data — never cache.
export const dynamic = "force-dynamic";

const STATUS: Record<AdminPassStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  used: { tone: "neutral", label: "Fully used" },
  expired: { tone: "warning", label: "Expired" },
  refunded: { tone: "danger", label: "Refunded" },
};

export default async function PassesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const all = await getAdminPasses();
  const passes = q
    ? all.filter((p) =>
        [p.customerName, p.email, p.phone].some((f) =>
          f.toLowerCase().includes(q),
        ),
      )
    : all;

  const tz = tenant.timezone;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Passes</h1>
        <p className="text-sm text-muted">
          Credits used and remaining on each pass.
        </p>
      </div>

      {/* Search — a plain GET form, no JS needed. */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Name, email or phone"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <Button type="submit">Show</Button>
      </form>

      <section className="rounded-xl border border-border bg-surface px-4">
        {passes.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted">
            {q ? `No passes matching “${sp.q}”.` : "No passes sold yet."}
          </div>
        ) : (
          passes.map((p) => (
            <Link
              key={p.id}
              href={`/admin/passes/${p.id}`}
              className="-mx-4 flex flex-col gap-2 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-subtle sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{p.customerName || "—"}</span>
                <span className="text-sm text-muted">
                  {p.email || "—"}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium tabular-nums">
                  {p.usedCredits} of {p.totalCredits} used ·{" "}
                  <span className="text-accent">{p.remainingCredits} remain</span>
                </span>
                {p.expiresAt && (
                  <span className="text-xs text-muted">
                    {p.status === "expired" ? "Expired" : "Expires"}{" "}
                    {formatSessionDate(p.expiresAt, tz)}
                  </span>
                )}
                <Badge tone={STATUS[p.status].tone}>
                  {STATUS[p.status].label}
                </Badge>
                <Icon
                  name="chevron-right"
                  className="hidden h-4 w-4 text-muted sm:block"
                />
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
