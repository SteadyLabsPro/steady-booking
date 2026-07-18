import Link from "next/link";
import { Icon } from "@/components/icons";

// Admin landing — cards to the main areas. One row on desktop, stacked on mobile.
export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/admin/bookings",
    title: "Bookings",
    blurb: "View, refund & make bookings",
  },
  {
    href: "/admin/transactions",
    title: "Transactions",
    blurb: "Accounts, revenue & refunds",
  },
  {
    href: "/admin/tools/qr",
    title: "QR code",
    blurb: "Generate a QR code to the booking page",
  },
];

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-center text-xl font-semibold tracking-tight">
        Admin dashboard
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/40 hover:bg-subtle"
          >
            <h2 className="text-lg font-semibold tracking-tight">{c.title}</h2>
            <p className="flex-1 text-sm text-muted">{c.blurb}</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-transform group-hover:translate-x-0.5">
              <Icon name="arrow-right" className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
