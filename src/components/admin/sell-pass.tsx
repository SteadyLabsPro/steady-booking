"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/engine";
import { tenant } from "@/config/tenant.config";
import {
  adminGrantPass,
  type AdminPassPayment,
} from "@/lib/admin/pass-actions";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls =
  "h-11 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent";

/** Sell/grant a pass to a customer (offline sale or comp). */
export function SellPass() {
  const bundle = tenant.bundles[0];
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState<AdminPassPayment>("paid");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ credits: number; expiresAt: string | null } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!bundle) return null;

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPayment("paid");
    setError(null);
    setDone(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function submit() {
    if (!firstName.trim() || !lastName.trim())
      return setError("Enter the customer's name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email.");
    setError(null);

    startTransition(async () => {
      const result = await adminGrantPass({
        firstName,
        lastName,
        email,
        phone,
        bundleId: bundle.id,
        payment,
      });
      if (result.ok) {
        setDone({ credits: result.credits, expiresAt: result.expiresAt });
        router.refresh();
      } else if (result.reason === "unknown_bundle") {
        setError("Pass type not found.");
      } else {
        setError("Couldn't create the pass. Please try again.");
      }
    });
  }

  const expiryLabel =
    bundle.validityMonths > 0
      ? `valid ${bundle.validityMonths} months`
      : "no expiry";

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Sell pass
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Sell pass"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-foreground/40"
          />
          <div className="relative z-10 mt-auto flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-5 sm:m-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Sell a pass</h3>
              <button
                type="button"
                onClick={close}
                className="text-sm text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

            {done ? (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-sm font-medium text-green-700">
                  Pass created ✓
                </p>
                <p className="text-sm text-muted">
                  {done.credits} credits added to {email.trim().toLowerCase()}.
                  {done.expiresAt &&
                    ` Valid until ${new Date(done.expiresAt).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}.`}
                </p>
                <Button size="lg" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-subtle/60 p-3 text-sm">
                  <p className="font-medium">
                    {bundle.sessions}-visit pass ·{" "}
                    {formatPrice(bundle.priceMinor, tenant.currency)}
                  </p>
                  <p className="text-xs text-muted">
                    1 credit = 1 person-session · {expiryLabel}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <input
                  className={inputCls}
                  type="email"
                  inputMode="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className={inputCls}
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">Payment</legend>
                  {(
                    [
                      ["paid", `Paid (${formatPrice(bundle.priceMinor, tenant.currency)})`],
                      ["complimentary", "Complimentary"],
                    ] as [AdminPassPayment, string][]
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="pass-payment"
                        checked={payment === value}
                        onChange={() => setPayment(value)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <p className="text-xs text-muted">
                    &ldquo;Paid&rdquo; counts to revenue at today&rsquo;s date.
                  </p>
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button size="lg" onClick={submit} disabled={pending}>
                  {pending ? "Creating…" : "Create pass"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
