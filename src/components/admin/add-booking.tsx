"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminAddBooking } from "@/lib/admin/booking-actions";
import { checkWaiverNeeded } from "@/lib/actions/check-waiver";
import type { SessionOption } from "@/lib/admin/bookings";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls =
  "h-11 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent";

type WaiverStatus = "unknown" | "checking" | "needed" | "signed";

/** Manual "Add booking" — a confirmed, capacity-checked booking. */
export function AddBooking({ sessions }: { sessions: SessionOption[] }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(1);
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus>("unknown");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = sessions.find((s) => s.id === sessionId);
  const maxGuests = selected?.remaining ?? 1;

  function reset() {
    setSessionId("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setGuests(1);
    setWaiverStatus("unknown");
    setAcknowledged(false);
    setError(null);
  }

  async function checkWaiver() {
    if (!EMAIL_RE.test(email.trim())) return;
    setWaiverStatus("checking");
    try {
      const { needsWaiver } = await checkWaiverNeeded(email);
      setWaiverStatus(needsWaiver ? "needed" : "signed");
    } catch {
      setWaiverStatus("unknown");
    }
  }

  function submit() {
    if (!sessionId) return setError("Choose a session.");
    if (!firstName.trim() || !lastName.trim())
      return setError("Enter the customer's name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email.");
    if (guests < 1 || guests > maxGuests)
      return setError(`Guests must be between 1 and ${maxGuests}.`);
    if (waiverStatus === "needed" && !acknowledged)
      return setError("Please confirm the customer acknowledges the waiver.");
    setError(null);

    startTransition(async () => {
      const result = await adminAddBooking({
        sessionId,
        firstName,
        lastName,
        email,
        phone,
        guests,
        acknowledgeWaiver: acknowledged,
      });
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
      } else if (result.reason === "waiver_required") {
        setWaiverStatus("needed");
        setError("This customer must acknowledge the waiver — please tick the box.");
      } else if (result.reason === "sold_out") {
        setError("Not enough spaces left on that session.");
      } else {
        setError("Couldn't add the booking. Please try again.");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add booking
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Add booking</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ab-session" className="text-sm font-medium">
          Session
        </label>
        <select
          id="ab-session"
          value={sessionId}
          onChange={(e) => {
            setSessionId(e.target.value);
            setGuests(1);
          }}
          className={inputCls}
        >
          <option value="">Choose a session…</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
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
        onChange={(e) => {
          setEmail(e.target.value);
          setWaiverStatus("unknown");
          setAcknowledged(false);
        }}
        onBlur={checkWaiver}
      />
      <input
        className={inputCls}
        type="tel"
        inputMode="tel"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ab-guests" className="text-sm font-medium">
          Guests {selected ? `(max ${maxGuests})` : ""}
        </label>
        <input
          id="ab-guests"
          type="number"
          min={1}
          max={maxGuests}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className={`${inputCls} w-24`}
        />
      </div>

      {/* Waiver status */}
      {waiverStatus === "checking" && (
        <p className="text-xs text-muted">Checking waiver…</p>
      )}
      {waiverStatus === "signed" && (
        <p className="text-sm font-medium text-green-700">Waiver on file ✓</p>
      )}
      {waiverStatus === "needed" && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            This customer hasn&rsquo;t signed a waiver. Please ask them to
            confirm they acknowledge the waiver terms.
          </p>
          <label className="flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>Customer acknowledges the waiver terms.</span>
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button size="lg" onClick={submit} disabled={pending}>
        {pending ? "Adding…" : "Add confirmed booking"}
      </Button>
    </div>
  );
}
