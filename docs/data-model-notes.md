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

## 3. Business rules come from config, not code

All business rules — opening hours, slot length, turnaround, capacity, pricing,
and bundles — live in `tenant.config.ts` (or, later, the database), never
hard-coded. Slots are generated from `scheduling` rules via the engine
(`slotStartTimes` / `activeDayKeys`). In Stage 6 the same rules seed real
`sessions` rows, where per-session price/capacity can still be overridden.

The Tide House launch rules: one service (Sauna & Cold Plunge), 45-min sessions
+ 15-min turnaround (hourly slots), capacity 6, 7 days/week, 06:00–21:00, £10
PAYGO.

## 4. Passes / block offer (build after PAYGO core)

The "10 sessions for £80" offer is a **prepaid pass**: pay £80 → 10 credits →
book sessions over time, each redeeming 1 credit, identified by email (no
accounts). Bundles are defined in `tenant.config.ts` (`bundles`).

Stage 6 schema must be **pass-ready**:

- a `passes` table (e.g. `customer_id`, `total_credits`, `remaining_credits`,
  `price_paid_minor`, `bundle_id`), and
- a nullable `pass_id` on `bookings`; a pass-redeemed booking records £0 and
  decrements a credit.

---

_These map to project memory: variable-per-session-pricing,
versioned-per-customer-waivers, session-capacity, sauna-service-rules,
block-pass-offer, all-business-rules-from-config._
