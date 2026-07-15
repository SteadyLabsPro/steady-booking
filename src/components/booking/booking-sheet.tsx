"use client";

import { useEffect, useState } from "react";
import { formatPrice, type TenantWaiver } from "@/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { startCheckout } from "@/lib/actions/checkout";
import { checkWaiverNeeded } from "@/lib/actions/check-waiver";
import { getActivePass, redeemPass } from "@/lib/actions/pass";
import { AccessNotice } from "@/components/booking/access-notice";

/**
 * Booking sheet — the step-based flow that opens when a slot is selected.
 * Bottom sheet on mobile, right-hand drawer on desktop.
 *
 * Steps: guests → details → review. Waiver and payment are later sub-stages;
 * the review step's payment button is a stub for now.
 */

export interface BookingSheetSlot {
  id: string;
  serviceName: string;
  dateLabel: string; // e.g. "Tue 7 Jul"
  time: string; // e.g. "09:30"
  priceMinor: number;
  remaining: number;
}

interface BookingSheetProps {
  slot: BookingSheetSlot;
  currency: string;
  waiver: TenantWaiver;
  onClose: () => void;
}

type Step = "guests" | "details" | "waiver" | "review" | "confirmation";

interface Details {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/** Waiver fields captured client-side, mirrored to the DB on submit. */
interface WaiverSignature {
  version: number;
  signatureName: string;
  agreed: boolean;
}

const EMPTY_DETAILS: Details = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Clear booking summary, shown on the details and review steps. */
function BookingSummary({
  slot,
  guests,
  currency,
}: {
  slot: BookingSheetSlot;
  guests: number;
  currency: string;
}) {
  const unit = formatPrice(slot.priceMinor, currency);
  const total = formatPrice(slot.priceMinor * guests, currency);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-subtle/60 p-4 text-sm">
      <p className="text-base font-semibold tracking-tight">
        {slot.serviceName}
      </p>
      <div className="flex flex-col gap-1">
        <SummaryRow label="Date" value={slot.dateLabel} />
        <SummaryRow label="Time" value={slot.time} />
        <SummaryRow label="Guests" value={String(guests)} />
      </div>
      <div className="mt-1 border-t border-border pt-2">
        <SummaryRow label={`${unit} × ${guests}`} value={total} strong />
      </div>
    </div>
  );
}

function StepperButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: "plus" | "minus";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: "text" | "email" | "tel";
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-11 rounded-md border bg-surface px-3 text-base outline-none transition-colors focus:border-accent",
          error ? "border-red-400" : "border-border",
        )}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function BookingSheet({
  slot,
  currency,
  waiver,
  onClose,
}: BookingSheetProps) {
  const [step, setStep] = useState<Step>("guests");
  const [guests, setGuests] = useState(1);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>(
    {},
  );
  const [agreed, setAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [groupConsent, setGroupConsent] = useState(false);
  const [waiverError, setWaiverError] = useState<{
    agree?: string;
    signature?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [checkingWaiver, setCheckingWaiver] = useState(false);
  const [waiverAlreadySigned, setWaiverAlreadySigned] = useState(false);
  const [passInfo, setPassInfo] = useState<{
    passId: string;
    remaining: number;
    expiresAt: string | null;
  } | null>(null);
  const [paidWithPass, setPaidWithPass] = useState(false);
  const [passRemaining, setPassRemaining] = useState<number | null>(null);
  const max = Math.max(1, slot.remaining);
  const canUsePass = passInfo !== null && passInfo.remaining >= guests;

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const setField = (key: keyof Details) => (value: string) => {
    setDetails((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validateDetails(): boolean {
    const next: Partial<Record<keyof Details, string>> = {};
    if (!details.firstName.trim()) next.firstName = "Enter your first name";
    if (!details.lastName.trim()) next.lastName = "Enter your last name";
    if (!EMAIL_RE.test(details.email.trim()))
      next.email = "Enter a valid email";
    if (details.phone.replace(/[^\d]/g, "").length < 7)
      next.phone = "Enter a valid phone number";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateWaiver(): boolean {
    const next: { agree?: string; signature?: string } = {};
    if (!agreed)
      next.agree = "Please confirm you've read and agree to the waiver";
    if (!signatureName.trim()) next.signature = "Type your full name to sign";
    setWaiverError(next);
    return Object.keys(next).length === 0;
  }

  // The waiver signature we would persist at Stage 6 (held client-side for now).
  const waiverSignature: WaiverSignature = {
    version: waiver.version,
    signatureName: signatureName.trim(),
    agreed,
  };

  // From details: skip the waiver step if this email already signed the active
  // version (one-time per customer); otherwise show it.
  async function continueFromDetails() {
    if (!validateDetails()) return;
    setCheckingWaiver(true);
    try {
      const [waiverRes, pass] = await Promise.all([
        checkWaiverNeeded(details.email),
        getActivePass(details.email),
      ]);
      setWaiverAlreadySigned(!waiverRes.needsWaiver);
      setPassInfo(pass);
      setStep(waiverRes.needsWaiver ? "waiver" : "review");
    } catch {
      setWaiverAlreadySigned(false);
      setPassInfo(null);
      setStep("waiver");
    } finally {
      setCheckingWaiver(false);
    }
  }

  // Redeem a pass credit instead of paying.
  async function proceedWithPass() {
    if (!passInfo) return;
    if (guests >= 2 && !groupConsent) {
      setSubmitError(
        "Please confirm you have consent from everyone in your group.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await redeemPass({
      passId: passInfo.passId,
      sessionId: slot.id,
      guests,
      email: details.email,
      signatureName: signatureName.trim() || null,
      groupConsent,
    });
    setSubmitting(false);
    if (result.ok) {
      setPaidWithPass(true);
      setPassRemaining(result.remaining);
      setBookingRef(result.bookingId);
      setStep("confirmation");
      return;
    }
    if (result.reason === "sold_out") {
      setSubmitError("Sorry — that slot just filled up. Please choose another.");
    } else if (result.reason === "insufficient_credits") {
      setSubmitError("Your pass doesn't have enough credits for this booking.");
    } else if (result.reason === "pass_expired") {
      setSubmitError("Your pass has expired. Please pay for this session.");
    } else {
      setSubmitError("Something went wrong. Please try again.");
    }
  }

  const goBack = () =>
    setStep((s) =>
      s === "review"
        ? waiverAlreadySigned
          ? "details"
          : "waiver"
        : s === "waiver"
          ? "details"
          : "guests",
    );

  // "Proceed to payment": create the pending booking, then start payment. When
  // Stripe is configured we redirect to hosted checkout; otherwise the booking
  // is held and we show the confirmation step.
  async function proceedToPayment() {
    if (guests >= 2 && !groupConsent) {
      setSubmitError(
        "Please confirm you have consent from everyone in your group.",
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await startCheckout({
      sessionId: slot.id,
      guests,
      firstName: details.firstName,
      lastName: details.lastName,
      email: details.email,
      phone: details.phone,
      signatureName: signatureName.trim() || null,
      groupConsent,
    });

    if (result.ok) {
      if (result.mode === "redirect") {
        window.location.href = result.url;
        return;
      }
      setSubmitting(false);
      setBookingRef(result.bookingId);
      setStep("confirmation");
      return;
    }
    setSubmitting(false);
    if (result.reason === "sold_out") {
      setSubmitError(
        "Sorry — that slot just filled up. Please go back and choose another time.",
      );
    } else if (result.reason === "session_unavailable") {
      setSubmitError("That session is no longer available. Please pick another.");
    } else {
      setSubmitError("Something went wrong creating your booking. Please try again.");
    }
  }

  const title =
    step === "guests"
      ? slot.serviceName
      : step === "details"
        ? "Your details"
        : step === "waiver"
          ? "Waiver"
          : step === "review"
            ? "Review"
            : "Booking ready";

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={`Book ${slot.serviceName}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />

      <div
        className={cn(
          "relative z-10 mt-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface",
          "sm:ml-auto sm:mt-0 sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-t-none sm:rounded-l-2xl",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border p-5">
          {step !== "guests" && step !== "confirmation" && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="-ml-1 rounded-md p-1 text-muted transition-colors hover:bg-subtle hover:text-foreground"
            >
              <Icon name="chevron-right" className="h-5 w-5 rotate-180" />
            </button>
          )}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {step === "guests" && (
              <p className="text-sm text-muted">
                {slot.dateLabel} · {slot.time}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto -m-1 rounded-md p-1 text-muted transition-colors hover:bg-subtle hover:text-foreground"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "guests" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Guests</span>
                  <span className="text-xs text-muted">
                    {slot.remaining} {slot.remaining === 1 ? "space" : "spaces"}{" "}
                    left
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <StepperButton
                    label="Remove guest"
                    icon="minus"
                    disabled={guests <= 1}
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  />
                  <span className="w-6 text-center text-lg font-semibold tabular-nums">
                    {guests}
                  </span>
                  <StepperButton
                    label="Add guest"
                    icon="plus"
                    disabled={guests >= max}
                    onClick={() => setGuests((g) => Math.min(max, g + 1))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted">
                  {formatPrice(slot.priceMinor, currency)} × {guests}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {formatPrice(slot.priceMinor * guests, currency)}
                </span>
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="flex flex-col gap-5">
              <BookingSummary slot={slot} guests={guests} currency={currency} />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="firstName"
                  label="First name"
                  value={details.firstName}
                  onChange={setField("firstName")}
                  error={errors.firstName}
                  autoComplete="given-name"
                />
                <Field
                  id="lastName"
                  label="Last name"
                  value={details.lastName}
                  onChange={setField("lastName")}
                  error={errors.lastName}
                  autoComplete="family-name"
                />
              </div>
              <Field
                id="email"
                label="Email"
                type="email"
                inputMode="email"
                value={details.email}
                onChange={setField("email")}
                error={errors.email}
                autoComplete="email"
              />
              <Field
                id="phone"
                label="Phone"
                type="tel"
                inputMode="tel"
                value={details.phone}
                onChange={setField("phone")}
                error={errors.phone}
                autoComplete="tel"
              />
            </div>
          )}

          {step === "waiver" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  Please read and agree to the waiver.
                </p>
                <a
                  href={waiver.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium text-accent hover:underline"
                >
                  Open PDF
                </a>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-border bg-subtle/40 p-4 text-sm leading-relaxed">
                <p>{waiver.intro}</p>
                {waiver.sections.map((section, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <p className="font-semibold">{section.heading}</p>
                    <ul className="flex list-disc flex-col gap-1 pl-5">
                      {section.items.map((item, j) => (
                        <li key={j}>
                          {item.text}
                          {item.sub && (
                            <ul className="mt-1 flex list-[circle] flex-col gap-1 pl-5">
                              {item.sub.map((s, k) => (
                                <li key={k}>{s}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="font-medium">{waiver.closing}</p>
              </div>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    setWaiverError((err) => ({ ...err, agree: undefined }));
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                />
                <span>I have read and agree to The Tide House waiver.</span>
              </label>
              {waiverError.agree && (
                <span className="-mt-3 text-xs text-red-600">
                  {waiverError.agree}
                </span>
              )}

              <Field
                id="signature"
                label="Type your full name to sign"
                value={signatureName}
                onChange={(v) => {
                  setSignatureName(v);
                  setWaiverError((e) => ({ ...e, signature: undefined }));
                }}
                error={waiverError.signature}
                autoComplete="name"
              />
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-5">
              <BookingSummary slot={slot} guests={guests} currency={currency} />
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-medium">Your details</p>
                <div className="flex flex-col gap-1 text-muted">
                  <span>
                    {details.firstName} {details.lastName}
                  </span>
                  <span>{details.email}</span>
                  <span>{details.phone}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium">Waiver</p>
                <p className="text-muted">
                  {waiverAlreadySigned
                    ? `Already on file (v${waiver.version})`
                    : `Signed by ${waiverSignature.signatureName} (v${waiverSignature.version})`}
                </p>
              </div>

              {guests >= 2 && (
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={groupConsent}
                    onChange={(e) => {
                      setGroupConsent(e.target.checked);
                      setSubmitError(null);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                  />
                  <span>
                    I confirm I&rsquo;ve shown the waiver to everyone in my group
                    and have their consent to book on their behalf.
                  </span>
                </label>
              )}

              {canUsePass && passInfo && (
                <div className="flex flex-col gap-0.5 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
                  <p className="font-medium text-accent">
                    You have a 10-visit pass
                  </p>
                  <p className="text-muted">
                    {passInfo.remaining} credit
                    {passInfo.remaining === 1 ? "" : "s"} left · this booking
                    uses {guests}.
                    {passInfo.expiresAt &&
                      ` Valid until ${new Date(
                        passInfo.expiresAt,
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "confirmation" && (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight/15 text-highlight">
                <Icon name="check" className="h-6 w-6" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  You&rsquo;re all set, {details.firstName}
                </h3>
                <p className="text-sm text-muted">
                  {paidWithPass ? "Your booking is confirmed." : "Your spot is held."}
                </p>
              </div>
              <div className="w-full text-left">
                <BookingSummary
                  slot={slot}
                  guests={guests}
                  currency={currency}
                />
              </div>
              {bookingRef && (
                <p className="text-xs text-muted">
                  Booking reference{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {bookingRef.slice(0, 8)}
                  </span>
                </p>
              )}
              <AccessNotice />

              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">
                {paidWithPass
                  ? `Paid with your 10-visit pass — ${passRemaining} credit${passRemaining === 1 ? "" : "s"} left. A confirmation email is on its way.`
                  : "Your spot is held while payment is set up. Card payment (Stripe) and your confirmation email (Resend) arrive when configured — nothing has been charged yet."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-5">
          {step === "guests" && (
            <Button fullWidth size="lg" onClick={() => setStep("details")}>
              Continue
            </Button>
          )}
          {step === "details" && (
            <Button
              fullWidth
              size="lg"
              onClick={continueFromDetails}
              disabled={checkingWaiver}
            >
              {checkingWaiver ? "Checking…" : "Continue"}
            </Button>
          )}
          {step === "waiver" && (
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                if (validateWaiver()) setStep("review");
              }}
            >
              Agree & continue
            </Button>
          )}
          {step === "review" && (
            <>
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              {canUsePass ? (
                <>
                  <Button
                    fullWidth
                    size="lg"
                    onClick={proceedWithPass}
                    disabled={submitting}
                  >
                    {submitting ? "Confirming…" : "Use pass & confirm"}
                  </Button>
                  <button
                    type="button"
                    onClick={proceedToPayment}
                    disabled={submitting}
                    className="text-center text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Pay {formatPrice(slot.priceMinor * guests, currency)} instead
                  </button>
                </>
              ) : (
                <Button
                  fullWidth
                  size="lg"
                  onClick={proceedToPayment}
                  disabled={submitting}
                >
                  {submitting ? "Booking…" : "Proceed to payment"}
                </Button>
              )}
            </>
          )}
          {step === "confirmation" && (
            <Button fullWidth size="lg" variant="outline" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
