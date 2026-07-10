import Link from "next/link";
import { tenant } from "@/config/tenant.config";

/** Shared shell for legal pages (privacy, terms). */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-[#c2a06a]/70 bg-[#f5eee6]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
          >
            {tenant.name}
          </Link>
          <Link
            href="/"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            &larr; Back to booking
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>

        <div className="mt-6 rounded-lg border border-dashed border-[#c2a06a]/60 bg-accent/5 p-4 text-sm text-muted">
          This is a working draft to get you started. Please review and finalise
          it (ideally with your own legal advice) before launch.
        </div>

        <div className="mt-8 flex flex-col gap-7 text-sm leading-relaxed text-foreground/90">
          {children}
        </div>
      </main>
    </div>
  );
}

/** A titled section within a legal page. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}
