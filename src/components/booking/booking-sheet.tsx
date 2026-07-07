"use client";

import { useEffect, useState } from "react";
import { formatPrice, type TenantWaiver } from "@/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";

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

type Step = "guests" | "details" | "waiver" | "review";

interface Details {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/** Waiver fields captured client-side (no persistence yet). */
interface WaiverSignature {
  version: number;
  signatureName: string;
  agreed: boolean[];
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
  const [agreed, setAgreed] = useState<boolean[]>(() =>
    waiver.declarations.map(() => false),
  );
  const [signatureName, setSignatureName] = useState("");
  const [waiverError, setWaiverError] = useState<{
    declarations?: string;
    signature?: string;
  }>({});
  const max = Math.max(1, slot.remaining);

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
    const next: { declarations?: string; signature?: string } = {};
    if (!agreed.every(Boolean))
      next.declarations = "Please accept all declarations to continue";
    if (!signatureName.trim())
      next.signature = "Type your full name to sign";
    setWaiverError(next);
    return Object.keys(next).length === 0;
  }

  const toggleDeclaration = (i: number) => {
    setAgreed((a) => a.map((v, idx) => (idx === i ? !v : v)));
    setWaiverError((e) => ({ ...e, declarations: undefined }));
  };

  // The waiver signature we would persist at Stage 6 (held client-side for now).
  const waiverSignature: WaiverSignature = {
    version: waiver.version,
    signatureName: signatureName.trim(),
    agreed,
  };

  const goBack = () =>
    setStep((s) =>
      s === "review" ? "waiver" : s === "waiver" ? "details" : "guests",
    );

  const title =
    step === "guests"
      ? slot.serviceName
      : step === "details"
        ? "Your details"
        : step === "waiver"
          ? "Waiver"
          : "Review";

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
          {step !== "guests" && (
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
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-md bg-highlight/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-highlight">
                  Placeholder · replace before launch
                </span>
                <p className="text-sm text-muted">{waiver.intro}</p>
              </div>

              <div className="flex flex-col gap-3">
                {waiver.declarations.map((declaration, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={agreed[i]}
                      onChange={() => toggleDeclaration(i)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>{declaration}</span>
                  </label>
                ))}
                {waiverError.declarations && (
                  <span className="text-xs text-red-600">
                    {waiverError.declarations}
                  </span>
                )}
              </div>

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
                  Signed by {waiverSignature.signatureName} (v
                  {waiverSignature.version})
                </p>
              </div>
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">
                Next: payment. Arrives in a later stage.
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
              onClick={() => {
                if (validateDetails()) setStep("waiver");
              }}
            >
              Continue
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
              <Button fullWidth size="lg" disabled>
                Proceed to payment
              </Button>
              <p className="text-center text-xs text-muted">
                Payment arrives in a later stage.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
