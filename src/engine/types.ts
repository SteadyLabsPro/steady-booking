/**
 * Business-agnostic contracts for the Steady Labs booking engine.
 *
 * The engine reads only from these interfaces — never from hardcoded
 * business details. Onboarding a new business means supplying a new
 * config object, with no changes to engine code.
 */

/** Icons available to the engine's presentation layer. */
export type IconKey =
  | "sauna"
  | "plunge"
  | "sea"
  | "private";

/** A single highlight shown in the feature strip / mobile tab bar. */
export interface TenantFeature {
  label: string;
  icon: IconKey;
}

/**
 * Scheduling rules that define the slot grid. Slots are generated from these,
 * never hard-coded. Times are wall-clock "HH:MM" in the tenant timezone.
 */
export interface SchedulingRules {
  /** First slot start, e.g. "06:00". */
  openTime: string;
  /** Latest slot start, e.g. "21:00". */
  lastSlotTime: string;
  /** Session length in minutes, e.g. 45. */
  slotMinutes: number;
  /** Turnaround/buffer after each session in minutes, e.g. 15. */
  turnaroundMinutes: number;
  /** Active days of the week (0 = Sunday … 6 = Saturday). */
  daysOfWeek: number[];
}

/** A prepaid bundle / block offer (e.g. 10 sessions for £80). */
export interface Bundle {
  id: string;
  label: string;
  /** Number of sessions/credits included. */
  sessions: number;
  /** Total price in integer minor units. */
  priceMinor: number;
}

/** Pricing rules. Per-session prices live on sessions; this is the default. */
export interface PricingRules {
  /** Default pay-as-you-go price per session, in minor units. */
  sessionPriceMinor: number;
}

/** Marketing content for the landing hero. */
export interface TenantHero {
  /** Small eyebrow line above the headline. */
  eyebrow: string;
  /** Large display headline. */
  headline: string;
  /** Bold emphasis line beneath the headline. */
  tagline: string;
  /** Supporting sentence beneath the tagline. */
  subcopy: string;
  /** Call-to-action button label. */
  ctaLabel: string;
  /** Optional path (in /public) to the hero photo; falls back to a gradient. */
  image?: string;
}

/** Configuration for a single business (tenant) using the engine. */
export interface TenantConfig {
  /** Public-facing business name. */
  name: string;
  /** Small descriptor shown under the wordmark, e.g. "Sauna & Cold Plunge". */
  descriptor: string;
  /** Short tagline, used in metadata. */
  tagline: string;
  /** Primary contact / email reply-to address. */
  contactEmail: string;
  /** ISO 4217 currency code used for pricing, e.g. "GBP". */
  currency: string;
  /** IANA timezone the business operates in, e.g. "Europe/London". */
  timezone: string;
  /** Slot-grid scheduling rules. */
  scheduling: SchedulingRules;
  /** Default max capacity per session (per-session values can override in DB). */
  defaultCapacity: number;
  /** Pricing rules. */
  pricing: PricingRules;
  /** Prepaid bundle / block offers. */
  bundles: Bundle[];
  /** Landing hero content. */
  hero: TenantHero;
  /** Highlights shown in the feature strip. */
  features: TenantFeature[];
  /** Waiver policy for this tenant. */
  waiver: {
    /**
     * The currently active waiver version. Customers must have signed this
     * exact version; bumping it forces everyone to re-sign on next booking.
     */
    version: number;
  };
}
