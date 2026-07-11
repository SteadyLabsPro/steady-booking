"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/engine";
import { tenant } from "@/config/tenant.config";
import { cn } from "@/lib/utils";
import { startPassCheckout } from "@/lib/actions/buy-pass";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls =
  "h-11 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent";

interface BuyPassProps {
  canBuyOnline: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Buy-a-pass CTA. Opens a panel with the offer, collects the buyer's details,
 * and redirects to Stripe Checkout. When Stripe isn't live yet the panel shows
 * the offer and points buyers to buy in person.
 */
export function BuyPass({ canBuyOnline, className, children }: BuyPassProps) {
  const bundle = tenant.bundles[0];
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!bundle) return null;

  const price = formatPrice(bundle.priceMinor, tenant.currency);
  const perVisit = formatPrice(
    Math.round(bundle.priceMinor / bundle.sessions),
    tenant.currency,
  );
  const validity =
    bundle.validityMonths > 0 ? `${bundle.validityMonths} months` : null;

  function close() {
    setOpen(false);
    setError(null);
  }

  function submit() {
    if (!firstName.trim() || !lastName.trim())
      return setError("Enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email.");
    setError(null);

    startTransition(async () => {
      const result = await startPassCheckout({
        firstName,
        lastName,
        email,
        phone,
      });
      if (result.ok) {
        window.location.href = result.url;
      } else if (result.reason === "invalid") {
        setError("Please check your details and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Buy a pass"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-foreground/40"
          />
          <div className="relative z-10 mt-auto flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-surface p-6 sm:m-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-semibold tracking-tight">
                  {bundle.sessions}-visit pass
                </h3>
                <p className="text-sm text-muted">
                  {perVisit} a visit · use for yourself or bring guests
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="-m-1 shrink-0 p-1 text-sm text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>

            {/* Offer summary — expiry stated up front. */}
            <div className="flex items-baseline justify-between rounded-xl border border-accent/30 bg-accent/5 p-4">
              <span className="text-2xl font-semibold tracking-tight text-accent">
                {price}
              </span>
              <span className="text-right text-sm text-muted">
                {bundle.sessions} visits
                {validity && (
                  <>
                    <br />
                    valid {validity}
                  </>
                )}
              </span>
            </div>

            {canBuyOnline ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputCls}
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                  <input
                    className={inputCls}
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
                <input
                  className={inputCls}
                  type="email"
                  inputMode="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <input
                  className={inputCls}
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
                <p className="text-xs text-muted">
                  Your visits are linked to this email — book with it and choose
                  &ldquo;Use pass&rdquo;.
                  {validity && ` Credits are valid for ${validity} from purchase.`}
                </p>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button size="lg" onClick={submit} disabled={pending}>
                  {pending ? "Redirecting…" : `Buy pass · ${price}`}
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                <p>Online purchase is coming soon.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
