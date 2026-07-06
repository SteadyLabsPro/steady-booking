/**
 * Business-agnostic contracts for the Steady Labs booking engine.
 *
 * The engine reads only from these interfaces — never from hardcoded
 * business details. Onboarding a new business means supplying a new
 * config object, with no changes to engine code.
 */

/** Configuration for a single business (tenant) using the engine. */
export interface TenantConfig {
  /** Public-facing business name. */
  name: string;
  /** Short tagline, used in metadata and hero copy. */
  tagline: string;
  /** Primary contact / email reply-to address. */
  contactEmail: string;
  /** ISO 4217 currency code used for pricing, e.g. "GBP". */
  currency: string;
  /** IANA timezone the business operates in, e.g. "Europe/London". */
  timezone: string;
  /** Waiver policy for this tenant. */
  waiver: {
    /**
     * The currently active waiver version. Customers must have signed this
     * exact version; bumping it forces everyone to re-sign on next booking.
     */
    version: number;
  };
}
