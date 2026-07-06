# Data-model planning notes

Forward requirements to honour when the Supabase schema is designed
(Stage 3). Captured now so later stages don't paint us into a corner.
These are engine-level rules — they apply to every tenant, not just The
Tide House.

## 1. Variable pricing (per session)

Each individual session must carry its **own editable price** from day one.

- Store price **on the session** (e.g. `sessions.price_minor` integer minor
  units + currency from tenant config), never only on a template.
- When session-generation from templates arrives later, the template price is
  a **default that is copied onto each session**. After generation, each
  session's price is independently editable.
- Do **not** compute a session's price by joining to a template at read time —
  the session is the source of truth for its own price.

## 1a. Session capacity (max spots + remaining)

Every session has a configurable maximum capacity, and bookings consume spots
against it.

- `sessions.capacity` is the maximum spots for that session (configurable).
- A booking consumes `quantity` spots on its session.
- **Cancelled bookings do not consume capacity.** Never delete a booking to
  free space — set `booking_status = 'cancelled'` instead. Status is the
  single source of truth.
- Remaining spots are **derived, never stored**, so they can't drift:
  `remaining = capacity − sum(quantity where status <> 'cancelled')`.
- Exposed by the `session_availability` view (SQL) and the
  `remainingSpaces()` / `bookedSpaces()` / `hasCapacity()` engine helpers.

## 2. Waivers (one-time per customer, versioned)

Waivers are signed **once per customer**, not per booking, and are
**versioned** so legal changes can force a re-sign.

- A tenant has a **current active waiver version**.
- Each customer's signed waiver is stored **against the customer**, recording
  the **version signed** and `signed_at`.
- At booking time, prompt for signing **only if** the customer has no valid
  waiver **or** their latest signed version ≠ the active version.
- Do **not** attach waivers to the booking/session row.

---

_These map to project memory: variable-per-session-pricing,
versioned-per-customer-waivers._
