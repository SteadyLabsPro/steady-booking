import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { tenant } from "@/config/tenant.config";
import { formatPrice, formatSessionDate, formatSessionTime } from "@/engine";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadBooking(id: string | undefined) {
  if (!id) return null;
  const sb = createServiceClient();
  const { data } = await sb
    .from("bookings")
    .select(
      "quantity, total_minor, payment_status, status, sessions ( starts_at )",
    )
    .eq("id", id)
    .maybeSingle();
  return data as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: id } = await searchParams;
  const booking = await loadBooking(id);
  const paid = booking?.payment_status === "paid";
  const tz = tenant.timezone;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon name="check" className="h-7 w-7" />
      </span>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {paid ? "Payment received" : "You're booked"}
        </h1>
        <p className="text-sm text-muted">
          {paid
            ? "Your booking is confirmed. See you soon."
            : "Your spot is held. We'll confirm once payment settles."}
        </p>
      </div>

      {booking?.sessions?.starts_at && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">When</span>
            <span className="font-medium">
              {formatSessionDate(booking.sessions.starts_at, tz)} ·{" "}
              {formatSessionTime(booking.sessions.starts_at, tz)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Guests</span>
            <span className="font-medium tabular-nums">{booking.quantity}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-muted">Total</span>
            <span className="font-semibold tabular-nums">
              {formatPrice(booking.total_minor, tenant.currency)}
            </span>
          </div>
        </div>
      )}

      <Link
        href="/"
        className="text-sm font-medium text-accent transition-colors hover:underline"
      >
        Back to {tenant.name}
      </Link>
    </main>
  );
}
