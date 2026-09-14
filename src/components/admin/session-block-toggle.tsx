"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSessionActive } from "@/lib/admin/closure-actions";
import { cn } from "@/lib/utils";

/**
 * Block / unblock a single session. Warns first if the session already has
 * guests booked (blocking stops new bookings but doesn't cancel existing ones).
 */
export function SessionBlockToggle({
  id,
  active,
  bookedGuests,
}: {
  id: string;
  active: boolean;
  bookedGuests: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () =>
    start(async () => {
      if (active && bookedGuests > 0) {
        const ok = window.confirm(
          `This session already has ${bookedGuests} guest${bookedGuests === 1 ? "" : "s"} booked.\n\n` +
            `Blocking stops NEW bookings but does NOT cancel existing ones — cancel & refund those on the Bookings page if the closure affects them.\n\n` +
            `Block this session anyway?`,
        );
        if (!ok) return;
      }
      const res = await setSessionActive(id, !active);
      if (res?.ok) router.refresh();
      else window.alert(res?.error ?? "Something went wrong.");
    });

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={cn(
        "text-sm font-medium transition-colors hover:underline disabled:opacity-50",
        active ? "text-red-600" : "text-accent",
      )}
    >
      {pending ? "…" : active ? "Block" : "Unblock"}
    </button>
  );
}
