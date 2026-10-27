"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/engine";
import { tenant } from "@/config/tenant.config";
import {
  addPassCredits,
  refundUnusedPassCredits,
  setPassExpiry,
  type PassAdjustResult,
} from "@/lib/admin/pass-actions";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-9 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent";

/**
 * Staff adjustments on a pass: add goodwill credits, change the expiry date,
 * and refund only the unused paid credits. Each is a small inline form with
 * its own feedback; the page refreshes on success.
 */
export function PassAdjustments({
  passId,
  expiryKey,
  todayKey,
  unusedRefundMinor,
  unusedPaidCredits,
}: {
  passId: string;
  /** Current expiry as yyyy-mm-dd (venue timezone), or "" if none. */
  expiryKey: string;
  todayKey: string;
  /** 0 hides the refund control (no card payment, or nothing left to refund). */
  unusedRefundMinor: number;
  unusedPaidCredits: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [credits, setCredits] = useState("1");
  const [expiry, setExpiry] = useState(expiryKey);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (action: () => Promise<PassAdjustResult>, done: string) =>
    startTransition(async () => {
      setMsg(null);
      const res = await action();
      if (!res.ok) {
        setMsg({ ok: false, text: res.error ?? "Something went wrong." });
        return;
      }
      setMsg({ ok: true, text: done });
      setConfirmRefund(false);
      router.refresh();
    });

  const qty = Number(credits);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Adjust this pass</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="add-credits" className="text-xs font-medium text-muted">
          Add credits (goodwill: never refunded as money)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="add-credits"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className={`${inputCls} w-20`}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !(qty >= 1)}
            onClick={() =>
              run(
                () => addPassCredits(passId, qty),
                `Added ${qty} credit${qty === 1 ? "" : "s"}.`,
              )
            }
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="expiry" className="text-xs font-medium text-muted">
          Expiry date (pass works until the end of this day)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="expiry"
            type="date"
            min={todayKey}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className={inputCls}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !expiry || expiry === expiryKey}
            onClick={() =>
              run(() => setPassExpiry(passId, expiry), "Expiry date updated.")
            }
          >
            Save
          </Button>
        </div>
      </div>

      {unusedRefundMinor > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">
            Refund unused credits ({unusedPaidCredits} paid credit
            {unusedPaidCredits === 1 ? "" : "s"} →{" "}
            {formatPrice(unusedRefundMinor, tenant.currency)} to their card)
          </span>
          {!confirmRefund ? (
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              disabled={pending}
              onClick={() => setConfirmRefund(true)}
            >
              Refund {formatPrice(unusedRefundMinor, tenant.currency)}
            </Button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">
                Refund and void all remaining credits?
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => refundUnusedPassCredits(passId),
                    "Refunded. Remaining credits voided.",
                  )
                }
                className="font-medium text-red-600 transition-colors hover:underline disabled:opacity-50"
              >
                {pending ? "Working…" : "Refund"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmRefund(false)}
                className="text-muted transition-colors hover:text-foreground disabled:opacity-50"
              >
                Keep
              </button>
            </span>
          )}
        </div>
      )}

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-accent" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
