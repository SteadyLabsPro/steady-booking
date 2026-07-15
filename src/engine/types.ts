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
  | "private"
  | "calendar"
  | "device"
  | "key"
  | "check";

/** One step in the "how it works" explainer. */
export interface TenantStep {
  icon: IconKey;
  text: string;
}

/** A prominent notice repeated on the site and in confirmation emails. */
export interface TenantNotice {
  heading: string;
  body: string;
}

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
  /** How long the pass stays valid after purchase, in months (0 = no expiry). */
  validityMonths: number;
}

/** Pricing rules. Per-session prices live on sessions; this is the default. */
export interface PricingRules {
  /** Default pay-as-you-go price per session, in minor units. */
  sessionPriceMinor: number;
}

/** Booking hold policy. */
export interface BookingPolicy {
  /** Minutes a pending (unpaid) booking holds its spot before it expires. */
  holdMinutes: number;
}

/** A waiver clause, optionally with indented sub-points. */
export interface WaiverItem {
  text: string;
  sub?: string[];
}

/** A titled section of the waiver. */
export interface WaiverSection {
  heading: string;
  items: WaiverItem[];
}

/** Waiver policy and full content for this tenant. */
export interface TenantWaiver {
  /**
   * The currently active waiver version. Customers must have signed this exact
   * version; bumping it forces everyone to re-sign on their next booking.
   */
  version: number;
  /** Intro shown above the sections. */
  intro: string;
  /** Full waiver body, rendered for the customer to read. */
  sections: WaiverSection[];
  /** Closing confirmation line. */
  closing: string;
  /** Public path to the full waiver PDF, for reference/download. */
  pdfUrl: string;
}

/** Marketing content for the landing hero. */
/** A hero image. Several are cross-faded as a slider. */
export interface TenantHeroImage {
  /** Path under /public, e.g. "/plunge-th.png". */
  src: string;
  /** Describes the photo for screen readers. */
  alt: string;
}

export interface TenantHero {
  /** Large display headline. */
  headline: string;
  /** Small caption under the headline (rendered uppercase). */
  subCaption: string;
  /** Supporting sentence beneath the headline. */
  subcopy: string;
  /** Hero photos — one shows a static image, several cross-fade as a slider. */
  images: TenantHeroImage[];
}

/** Configuration for a single business (tenant) using the engine. */
/** Payment presentation settings (provider-agnostic). */
export interface PaymentSettings {
  /**
   * Card statement descriptor suffix for this business (e.g. "TIDEHOUSE"), so
   * charges are recognisable even on a Stripe account shared with other
   * businesses. Stripe limits: <= 22 chars incl. the account prefix; no
   * < > \ " ' characters.
   */
  statementDescriptor?: string;
}

export interface TenantConfig {
  /** Public-facing business name. */
  name: string;
  /** Stable slug identifying this business, e.g. "tidehouse" — tags payments. */
  slug: string;
  /** Small descriptor shown under the wordmark, e.g. "Sauna & Cold Plunge". */
  descriptor: string;
  /** Venue address / location, shown in confirmation emails. */
  address: string;
  /** Short tagline, used in metadata. */
  tagline: string;
  /** Primary contact / email reply-to address. */
  contactEmail: string;
  /**
   * Real monitored inbox that customer replies to automated emails should go
   * to (via Reply-To). Emails send from a noreply address, but replies land
   * here. Falls back to contactEmail if unset.
   */
  replyToEmail?: string;
  /** Canonical public site URL (used for QR codes and links). */
  url: string;
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
  /** Booking hold policy. */
  booking: BookingPolicy;
  /** Payment presentation settings (e.g. card statement descriptor). */
  payments?: PaymentSettings;
  /** Prepaid bundle / block offers. */
  bundles: Bundle[];
  /** Landing hero content. */
  hero: TenantHero;
  /** Highlights shown in the feature strip. */
  features: TenantFeature[];
  /** "How it works" steps, shown on the home page in order. */
  howItWorks: TenantStep[];
  /** Entry/access instructions — shown on site and in confirmation emails. */
  accessNotice: TenantNotice;
  /** Waiver policy and copy for this tenant. */
  waiver: TenantWaiver;
}
