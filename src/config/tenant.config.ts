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
  scheduling: {
    openTime: "06:00",
    lastSlotTime: "21:00",
    slotMinutes: 45,
    turnaroundMinutes: 15,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // 7 days a week
  },
  defaultCapacity: 6,
  pricing: {
    sessionPriceMinor: 1000, // £10 PAYGO per session
  },
  booking: {
    holdMinutes: 15, // a pending booking holds its spot for 15 min, then frees
  },
  bundles: [
    {
      id: "block10",
      label: "10-session block",
      sessions: 10,
      priceMinor: 8000, // £80
    },
  ],
  hero: {
    headline: "Sauna & Cold Plunge, Mudeford",
    subCaption: "Located inside Advantage Padel.",
    subcopy: "Traditional Finnish sauna and ice-cold plunge tubs",
  },
  features: [
    { label: "Wood-fired sauna", icon: "sauna" },
    { label: "Cold plunge", icon: "plunge" },
    { label: "By the sea", icon: "sea" },
    { label: "Private sessions", icon: "private" },
  ],
  waiver: {
    version: 1,
    // ⚠️ PLACEHOLDER waiver copy — REPLACE with real legal text before launch.
    intro:
      "Placeholder waiver — replace before launch. Please read and accept the following before your session.",
    declarations: [
      "I confirm I am in good health and have no medical condition that makes sauna use or cold-water immersion unsafe for me.",
      "I understand that heat exposure and cold-water immersion carry inherent risks, and I take part entirely at my own risk.",
      "I agree to follow all staff instructions and the venue's safety guidance during my visit.",
    ],
  },
};
