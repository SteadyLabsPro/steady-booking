# Supabase

Database schema for the booking engine. The schema is business-agnostic;
tenant-level values (currency, active waiver version) live in
`src/config/tenant.config.ts`, not in the database.

## Applying the schema

No credentials are wired yet (that's a later stage). When a Supabase project
exists, apply the migration either way:

**Option A — SQL editor:** paste `migrations/0001_initial_schema.sql` into the
Supabase dashboard SQL editor and run it. The script is written to be safe to
re-run.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref <ref>
supabase db push
```

## Tables

| Table       | Purpose                                                        |
| ----------- | ------------------------------------------------------------- |
| `services`  | Bookable offering types (generic).                            |
| `sessions`  | Scheduled slots; each has its **own editable `price_minor`** and a max `capacity`. |
| `customers` | Contact records (no accounts in MVP).                         |
| `bookings`  | Spots held on a session; snapshots price at booking time.     |
| `waivers`   | One-time, versioned, linked to **customer** — not bookings.   |

### Availability

`session_availability` is a view giving `capacity`, `booked_spaces`, and
`remaining_spaces` per session. **Cancelled bookings do not consume capacity**,
and remaining spots are derived (never stored) so they stay consistent. It is
intended for server-side reads (service role); the matching engine helpers are
`remainingSpaces()` / `bookedSpaces()` / `hasCapacity()`.

App-facing TypeScript contracts for these tables live in `src/engine/domain.ts`.

## Row Level Security

RLS is enabled on every table. Active `services` and `sessions` are readable
with the anon key (public availability); `customers`, `bookings`, and
`waivers` have no anon policies and are reached only via the service role.
