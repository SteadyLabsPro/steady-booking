# Roadmap

Built in small, reviewable stages. Business rules always come from tenant
config or the database — never hard-coded.

## Done

1. **Foundation** — Next.js + TS + Tailwind, engine/config split.
2. **Design-system primitives** — Button, Container, Card (+ tokens).
3. **Booking data model** — services, sessions, customers, bookings, waivers;
   per-session price, capacity, versioned waivers, availability view.
4. **Public booking screen** — editorial hero, date scroller, slot cards.

## In progress

5. **Customer booking flow** (mock, client-side)
   - 5a Guest stepper ✅
   - 5b Details form ✅
   - 5c One-time waiver (declarations + signature) ✅
   - 5d Review & confirm — assemble the booking payload; "Proceed to payment"
     handoff (stubbed until Stripe).

## Next

6. **Wire availability & bookings to Supabase** — real sessions (generated from
   config rules), customers, bookings, capacity checks, one-time waiver skip by
   email. Build **pass-ready** (10-visit block: `passes` + `pass_id`).
7. **Stripe** — PAYGO payment + booking confirmation on success.
8. **Resend emails** — booking confirmation.
9. **Block pass offer** — buy the £80 10-visit pass; redeem credits by email.

## Admin Lite (after the customer flow + backend)

An intentionally simple, clean **operational dashboard** — not a management
system. Depends on the data layer (Supabase) and payments (Stripe), so it comes
after those are wired. Access is gated (simple password).

- View bookings by **Today / Week / Month**
- Basic **revenue totals** — day / week / month / year
- **Add a manual booking**
- **Cancel** bookings (never delete — status only)
- See **payment status**
- See **waiver status**
- **Search** bookings by customer
- **Export CSV** (if quick)
