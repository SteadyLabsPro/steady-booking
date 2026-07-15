import type { TenantConfig } from "@/engine";

/**
 * The Tide House — sauna & cold plunge.
 *
 * Every business-specific value lives in this file. To onboard another
 * business, duplicate this config with new values; the engine is untouched.
 */
export const tenant: TenantConfig = {
  name: "The Tide House",
  slug: "tidehouse",
  descriptor: "Sauna & Cold Plunge",
  address: "Advantage Padel, Mudeford",
  tagline: "Hot coal sauna & cold plunge.",
  // Public contact + where automated-email replies go (venue's monitored inbox).
  contactEmail: "mudeford@advantagepadel.co.uk",
  replyToEmail: "mudeford@advantagepadel.co.uk",
  url: "https://tidehousemudeford.co.uk",
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
  payments: {
    // Shows on the customer's card statement — recognisable even on a Stripe
    // account shared with other businesses.
    statementDescriptor: "TIDEHOUSE",
  },
  bundles: [
    {
      id: "block10",
      label: "10-session block",
      sessions: 10,
      priceMinor: 8000, // £80
      validityMonths: 6, // valid 6 months from purchase
    },
  ],
  hero: {
    headline: "Sauna & Cold Plunge, Mudeford",
    subCaption: "Located inside Advantage Padel.",
    subcopy: "Finnish sauna and ice-cold plunge tubs",
    // Cross-faded in order. Add another entry to extend the slider.
    images: [
      { src: "/plunge-th.png", alt: "The cold plunge tubs at The Tide House" },
      { src: "/sauna-th.png", alt: "Inside the hot coal sauna at The Tide House" },
      {
        src: "/changing-rooms-th.png",
        alt: "The changing rooms and showers at The Tide House",
      },
    ],
  },
  features: [
    { label: "Hot coal sauna", icon: "sauna" },
    { label: "2 cold plunges", icon: "plunge" },
    { label: "Private sessions", icon: "private" },
  ],
  waiver: {
    version: 2,
    pdfUrl: "/tidehouse-waiver.pdf",
    intro:
      "By using the sauna and cold plunge facilities at Advantage Padel, you acknowledge and agree to the following terms and conditions:",
    sections: [
      {
        heading: "General Use & Conduct",
        items: [
          { text: "Nudity is strictly prohibited." },
          {
            text: "Advantage Padel reserves the right to refuse admission to any intoxicated person.",
          },
          {
            text: "No food, drink, or glass items are permitted near the sauna or cold plunge.",
          },
          {
            text: "Children under the age of 16 are not permitted to use the sauna or cold plunge.",
          },
          {
            text: "All users must remove footwear, hanging jewellery, glasses, and contact lenses before entering the sauna or cold plunge.",
          },
          {
            text: "Advantage Padel is not responsible for any lost, stolen, or damaged belongings.",
          },
        ],
      },
      {
        heading: "Health & Personal Responsibility",
        items: [
          {
            text: "All persons use the sauna and cold plunge entirely at their own risk.",
          },
          {
            text: "By using these facilities, you confirm that:",
            sub: [
              "You do not have any medical condition that would make use unsafe; or",
              "You have consulted a medical professional who has confirmed it is safe for you.",
            ],
          },
          {
            text: "You accept full responsibility for your ability to tolerate cold exposure in the cold plunge and heat exposure in the sauna.",
          },
        ],
      },
      {
        heading: "You must NOT use the sauna or cold plunge if you:",
        items: [
          { text: "Have a heart condition;" },
          {
            text: "Suffer from high or low blood pressure, circulatory disorders, epilepsy, or diabetes;",
          },
          { text: "Are pregnant;" },
          { text: "Are prone to dizziness or fainting;" },
          { text: "Feel unwell, dizzy, or dehydrated." },
        ],
      },
      {
        heading: "Sauna Etiquette",
        items: [
          { text: "Shower before entering." },
          { text: "Do not enter with open wounds or infections." },
          { text: "Always sit on a towel." },
          {
            text: "Limit sessions to a maximum of 20 minutes (recommended 10–15 minutes).",
          },
          { text: "Stay hydrated before and after use." },
          {
            text: "Exit immediately if you feel dizzy, light-headed, or uncomfortable.",
          },
          { text: "Cool down gradually after use." },
          {
            text: "When using water on the sauna stove: drizzle gently – do not pour excessively.",
          },
          { text: "Only use the provided sauna water on the hot rocks." },
        ],
      },
      {
        heading: "Cold Plunge Etiquette",
        items: [
          { text: "Shower before entering." },
          { text: "Do not enter with open wounds or infections." },
          { text: "Maximum recommended immersion time is 2–3 minutes." },
          { text: "Keep your head above water at all times." },
          { text: "Exit immediately if you feel uncomfortable, dizzy, or numb." },
        ],
      },
      {
        heading: "Risk Acknowledgement",
        items: [
          {
            text: "Cold water immersion may cause cold shock, rapid breathing, dizziness, or fainting.",
          },
          {
            text: "Prolonged sauna use may cause dehydration, dizziness, fainting, or heat stress.",
          },
          {
            text: "Movement between the sauna and cold plunge area carries risks, including slips, falls, or injury. You accept full responsibility for your safety in this area.",
          },
        ],
      },
      {
        heading: "Facility Rules",
        items: [
          {
            text: "Personal essential oils or products are not permitted. Unapproved substances may cause toxic reactions, fire hazards, or slippery surfaces.",
          },
        ],
      },
      {
        heading: "Non-Commercial Use",
        items: [
          {
            text: "By booking, you confirm this session is for personal/private use only.",
          },
          {
            text: "You are not booking as a practitioner, facilitator, or business for commercial purposes (e.g., classes, workshops, or resale).",
          },
        ],
      },
      {
        heading: "Right to Refuse Service",
        items: [
          {
            text: "Advantage Padel reserves the right to refuse entry, shorten, or cancel sessions if:",
            sub: [
              "There is a health and safety concern;",
              "Behaviour is deemed unsafe; or",
              "These rules are not followed.",
            ],
          },
          { text: "No refunds will be issued to individuals refused entry." },
        ],
      },
      {
        heading: "Liability Waiver",
        items: [
          {
            text: "Advantage Padel accepts no liability for any injury, illness, accident, loss, or damage arising from the use of the sauna or cold plunge facilities.",
          },
        ],
      },
    ],
    closing:
      "By proceeding with your booking and use of these facilities, you confirm that you have read, understood, and agree to abide by this waiver.",
  },
};
