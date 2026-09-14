"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDayActive } from "@/lib/admin/closure-actions";

/**
 * Close / open a whole day at once (e.g. facility out of order). Closing warns
 * if guests are already booked across the day.
 */
export function DayBlockButtons({
  dateKey,
  anyActive,
  bookedGuests,
}: {
  dateKey: string;
  anyActive: boolean;
  bookedGuests: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (active: boolean) =>
    start(async () => {
      if (!active && bookedGuests > 0) {
        const ok = window.confirm(
          `${bookedGuests} guest${bookedGuests === 1 ? "" : "s"} already booked across this day.\n\n` +
            `Closing it stops NEW bookings but does NOT cancel existing ones.\n\n` +
            `Close the whole day anyway?`,
        );
        if (!ok) return;
      }
      const res = await setDayActive(dateKey, active);
      if (res?.ok) router.refresh();
      else window.alert(res?.error ?? "Something went wrong.");
    });

  return (
    <div className="flex gap-2">
      {anyActive && (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "Working…" : "Close whole day"}
        </button>
      )}
      <button
        type="button"
        onClick={() => run(true)}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-subtle disabled:opacity-50"
      >
        Open whole day
      </button>
    </div>
  );
}
