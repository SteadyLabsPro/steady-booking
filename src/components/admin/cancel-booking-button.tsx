"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/lib/admin/booking-actions";

/**
 * Cancel control with an inline confirm. When the booking has money or a credit
 * to give back, it offers "cancel & refund"/"cancel & return credit" alongside
 * a plain "cancel only".
 */
export function CancelBookingButton({
  id,
  refundKind = null,
}: {
  id: string;
  refundKind?: "money" | "credit" | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (refund: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await cancelBooking(id, { refund });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
      setConfirming(false);
    });

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

  const refundLabel =
    refundKind === "money"
      ? "Cancel & refund"
      : refundKind === "credit"
        ? "Cancel & return credit"
        : null;

  return (
    <span className="flex flex-col items-end gap-1 text-sm">
      <span className="flex items-center gap-2">
        <span className="text-muted">Cancel?</span>
        {refundLabel && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(true)}
            className="font-medium text-red-600 transition-colors hover:underline disabled:opacity-50"
          >
            {pending ? "Working…" : refundLabel}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="font-medium text-red-600 transition-colors hover:underline disabled:opacity-50"
        >
          {refundLabel ? "Cancel only" : pending ? "Cancelling…" : "Yes"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          {refundLabel ? "Keep" : "No"}
        </button>
      </span>
      {error && <span className="text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
