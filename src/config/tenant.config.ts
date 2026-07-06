import type { TenantConfig } from "@/engine";

/**
 * The Tide House — sauna & cold plunge.
 *
 * Every business-specific value lives in this file. To onboard another
 * business, duplicate this config with new values; the engine is untouched.
 */
export const tenant: TenantConfig = {
  name: "The Tide House",
  descriptor: "Sauna & Cold Plunge",
  tagline: "Sauna & cold plunge by the sea.",
  contactEmail: "hello@thetidehouse.co.uk",
  currency: "GBP",
  timezone: "Europe/London",
  hero: {
    eyebrow: "Sauna · Cold Plunge · Contrast Therapy",
    headline: "Recover Faster.",
    tagline: "Perform better. Sleep deeper. Feel stronger.",
    subcopy:
      "Traditional Finnish sauna and ice-cold plunge tubs located inside Advantage Padel, Mudeford. From £12 per person.",
    ctaLabel: "Book your session",
    // Drop a photo at /public/hero.jpg and set: image: "/hero.jpg"
  },
  features: [
    { label: "Wood-fired sauna", icon: "sauna" },
    { label: "Cold plunge", icon: "plunge" },
    { label: "By the sea", icon: "sea" },
    { label: "Private sessions", icon: "private" },
  ],
  waiver: {
    version: 1,
  },
};
