/**
 * App-facing domain contracts, mirroring the database schema
 * (supabase/migrations/0001_initial_schema.sql) in camelCase.
 *
 * These are business-agnostic: the engine speaks in services, sessions,
 * customers, bookings, and waivers — never in tenant-specific terms.
 * Timestamps are ISO 8601 strings as returned by Supabase.
 */

export type BookingStatus = "pending" | "confirmed" | "cancelled";

/** A bookable offering type (e.g. a 60-minute sauna). */
export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A concrete, schedulable slot of a service. */
export interface Session {
  id: string;
  serviceId: string;
  startsAt: string;
  capacity: number;
  /**
   * This session's own editable price, in integer minor units (e.g. pence).
   * The currency is supplied by tenant config, not stored here.
   */
  priceMinor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A contact record. No customer accounts in the MVP. */
export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A customer holding one or more spots on a session. */
export interface Booking {
  id: string;
  sessionId: string;
  customerId: string;
  quantity: number;
  /** Snapshot of the session price at booking time, in minor units. */
  unitPriceMinor: number;
  /** Derived total: quantity × unitPriceMinor. */
  totalMinor: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Derived availability for a session (mirrors the session_availability view).
 * Remaining spots are computed from non-cancelled bookings, never stored.
 */
export interface SessionAvailability {
  sessionId: string;
  capacity: number;
  bookedSpaces: number;
  remainingSpaces: number;
}

/** A signed waiver, linked to a customer — never to a booking or session. */
export interface Waiver {
  id: string;
  customerId: string;
  /** The waiver version this customer signed. */
  version: number;
  signedAt: string;
  signatureName: string;
  createdAt: string;
}
