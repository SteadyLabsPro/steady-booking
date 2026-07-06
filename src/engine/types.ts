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
