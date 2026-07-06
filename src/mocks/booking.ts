import type { Service, Session, Booking } from "@/engine";

/**
 * Mock, schema-shaped data for the Stage 4 booking screen. There is no backend
 * yet — these objects match the engine domain contracts exactly, so swapping
 * them for real Supabase reads later is a drop-in change.
 *
 * Times are stored in UTC (as Supabase would return them); the UI renders them
 * in the tenant timezone (Europe/London = BST/UTC+1 in July). Sessions are set
 * on the two days after the reference "today" (2026-07-06) so the default view
 * has content.
 */

const STAMP = "2026-07-06T12:00:00.000Z";

export const MOCK_SERVICES: Service[] = [
  {
    id: "svc_sauna_plunge",
    name: "Sauna & Cold Plunge",
    description: "Wood-fired sauna and sea-cold plunge.",
    durationMinutes: 60,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "svc_private",
    name: "Private Sauna Hire",
    description: "The whole cabin to yourself and up to three guests.",
    durationMinutes: 90,
    isActive: false, // Shelved for now — flip to true to bring it back.
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

export const MOCK_SESSIONS: Session[] = [
  // --- Tomorrow (Tue 7 Jul) — the default-selected day ---
  {
    id: "sess_a1",
    serviceId: "svc_sauna_plunge",
    startsAt: "2026-07-07T08:30:00.000Z", // 09:30 BST
    capacity: 8,
    priceMinor: 1800,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "sess_a2",
    serviceId: "svc_sauna_plunge",
    startsAt: "2026-07-07T17:30:00.000Z", // 18:30 BST
    capacity: 8,
    priceMinor: 2200,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "sess_a3",
    serviceId: "svc_sauna_plunge",
    startsAt: "2026-07-07T18:00:00.000Z", // 19:00 BST
    capacity: 8,
    priceMinor: 2200,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "sess_b1",
    serviceId: "svc_private",
    startsAt: "2026-07-07T07:00:00.000Z", // 08:00 BST
    capacity: 4,
    priceMinor: 5500,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  // --- Day after (Wed 8 Jul) — gives the scroller a second active day ---
  {
    id: "sess_a4",
    serviceId: "svc_sauna_plunge",
    startsAt: "2026-07-08T08:30:00.000Z", // 09:30 BST
    capacity: 8,
    priceMinor: 1800,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
  {
    id: "sess_b2",
    serviceId: "svc_private",
    startsAt: "2026-07-08T07:00:00.000Z", // 08:00 BST
    capacity: 4,
    priceMinor: 5500,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

/**
 * Bookings that consume capacity. Cancelled bookings are included on purpose to
 * prove they do NOT consume a spot (see sess_a2).
 * - sess_a1: 7 booked        → only 1 of 8 left
 * - sess_a2: 3 + 2 = 5       → 3 of 8 left (cancelled 2 ignored)
 * - sess_a3: 8 booked        → fully booked
 * - sess_b1: 0 booked        → 4 of 4 left
 * - sess_a4: 3 booked        → 5 of 8 left
 * - sess_b2: 0 booked        → 4 of 4 left
 */
export const MOCK_BOOKINGS: Pick<
  Booking,
  "sessionId" | "quantity" | "status"
>[] = [
  { sessionId: "sess_a1", quantity: 7, status: "confirmed" },
  { sessionId: "sess_a2", quantity: 3, status: "confirmed" },
  { sessionId: "sess_a2", quantity: 2, status: "pending" },
  { sessionId: "sess_a2", quantity: 2, status: "cancelled" },
  { sessionId: "sess_a3", quantity: 8, status: "confirmed" },
  { sessionId: "sess_a4", quantity: 3, status: "confirmed" },
];

/** View-only: sessions flagged as popular (not part of the schema). */
export const POPULAR_SESSION_IDS = new Set<string>(["sess_a1"]);
