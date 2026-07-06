/**
 * Public surface of the reusable booking engine.
 * Import engine pieces from "@/engine" — never reach into internal files.
 */
export type {
  TenantConfig,
  TenantFeature,
  TenantHero,
  IconKey,
} from "./types";
export type {
  BookingStatus,
  Service,
  Session,
  SessionAvailability,
  Customer,
  Booking,
  Waiver,
} from "./domain";
export { formatPrice } from "./pricing";
export { needsWaiver } from "./waivers";
export { bookedSpaces, remainingSpaces, hasCapacity } from "./capacity";
export {
  formatSessionDate,
  formatSessionTime,
  sessionDateKey,
} from "./datetime";
