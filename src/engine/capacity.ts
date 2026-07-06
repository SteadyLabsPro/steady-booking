import type { Booking } from "./domain";

/**
 * Capacity helpers. A session's `capacity` is its maximum spots; remaining
 * spots are derived from bookings, never stored. Cancelled bookings do not
 * consume capacity — bookings are never deleted to free space, so status is
 * the single source of truth.
 */

/** Minimal shape needed to count consumed spots. */
type SpotConsuming = Pick<Booking, "quantity" | "status">;

/** Spots consumed by a set of bookings, ignoring cancelled ones. */
export function bookedSpaces(bookings: readonly SpotConsuming[]): number {
  return bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((total, b) => total + b.quantity, 0);
}

/**
 * Remaining spots on a session. Never negative, even if overbooked.
 *
 * @param capacity The session's maximum spots.
 * @param bookings All bookings for the session (cancelled ones are ignored).
 */
export function remainingSpaces(
  capacity: number,
  bookings: readonly SpotConsuming[],
): number {
  return Math.max(0, capacity - bookedSpaces(bookings));
}

/** Whether a session can still take `quantity` more spots (default 1). */
export function hasCapacity(
  capacity: number,
  bookings: readonly SpotConsuming[],
  quantity = 1,
): boolean {
  return remainingSpaces(capacity, bookings) >= quantity;
}
