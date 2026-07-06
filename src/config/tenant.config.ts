import type { TenantConfig } from "@/engine";

/**
 * The Tide House — sauna & cold plunge.
 *
 * Every business-specific value lives in this file. To onboard another
 * business, duplicate this config with new values; the engine is untouched.
 */
export const tenant: TenantConfig = {
  name: "The Tide House",
  tagline: "Sauna & cold plunge by the sea.",
  contactEmail: "hello@thetidehouse.co.uk",
  currency: "GBP",
  timezone: "Europe/London",
  waiver: {
    version: 1,
  },
};
