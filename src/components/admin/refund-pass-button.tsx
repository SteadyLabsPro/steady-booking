"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundPass } from "@/lib/admin/pass-actions";

/**
 * Refund control for a card-purchased pass, with an inline confirm. Refunds the
 * money in Stripe and voids the remaining credits. Mirrors CancelBookingButton
 * so the transactions list reads consistently.
 */
export function RefundPassButton({
  purchaseRef,
  label = "Refund",
}: {
  purchaseRef: string;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      setError(null);
      const res = await refundPass(purchaseRef);
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
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1 text-sm">
      <span className="flex items-center gap-2">
        <span className="text-muted">Refund &amp; void credits?</span>
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className="font-medium text-red-600 transition-colors hover:underline disabled:opacity-50"
        >
          {pending ? "Working…" : "Refund"}
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
          Keep
        </button>
      </span>
      {error && <span className="text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
