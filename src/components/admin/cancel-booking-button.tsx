"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/lib/admin/booking-actions";

/** Cancel control with a two-step inline confirm, to avoid accidental cancels. */
export function CancelBookingButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-muted transition-colors hover:text-red-600"
      >
        Cancel
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted">Cancel?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await cancelBooking(id);
            router.refresh();
            setConfirming(false);
          })
        }
        className="font-medium text-red-600 transition-colors hover:underline disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Yes"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        No
      </button>
    </span>
  );
}
