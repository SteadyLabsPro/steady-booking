"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminAddBooking } from "@/lib/admin/booking-actions";
import type { SessionOption } from "@/lib/admin/bookings";
import { Button } from "@/components/ui/button";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputCls =
  "h-11 rounded-md border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent";

/** Manual "Add booking" — a confirmed, capacity-checked booking (no waiver). */
export function AddBooking({ sessions }: { sessions: SessionOption[] }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(1);
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
    setError(null);
  }

  function submit() {
    if (!sessionId) return setError("Choose a session.");
    if (!firstName.trim() || !lastName.trim())
      return setError("Enter the customer's name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email.");
    if (guests < 1 || guests > maxGuests)
      return setError(`Guests must be between 1 and ${maxGuests}.`);
    setError(null);

    startTransition(async () => {
      const result = await adminAddBooking({
        sessionId,
        firstName,
        lastName,
        email,
        phone,
        guests,
      });
      if (result.ok) {
        reset();
        setOpen(false);
        router.refresh();
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button size="lg" onClick={submit} disabled={pending}>
        {pending ? "Adding…" : "Add confirmed booking"}
      </Button>
    </div>
  );
}
