import { tenant } from "@/config/tenant.config";

/**
 * Stage 1 placeholder. Its only job is to prove the tenant config is
 * wired through to the UI. The real booking journey arrives in a later stage.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
        Steady Labs · Booking Engine
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {tenant.name}
      </h1>
      <p className="text-base text-muted">{tenant.tagline}</p>
      <div className="mt-2 rounded-md border border-border bg-subtle px-4 py-2 text-sm text-muted">
        Stage 1 foundation · configuration wired
      </div>
    </main>
  );
}
