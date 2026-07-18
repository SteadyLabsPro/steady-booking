import { tenant } from "@/config/tenant.config";
import { formatPrice } from "@/engine";

/**
 * LocalBusiness (HealthClub) JSON-LD for the home page — helps Google show the
 * venue in local/maps results with its address, hours and prices. Google reads
 * JSON-LD anywhere in the document.
 */
export function StructuredData() {
  const base = tenant.url;
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const price = formatPrice(tenant.pricing.sessionPriceMinor, tenant.currency);

  const data = {
    "@context": "https://schema.org",
    "@type": "HealthClub",
    name: tenant.name,
    description: `Hot coal sauna and cold plunge, from ${price} per person.`,
    url: base,
    email: tenant.contactEmail,
    image: tenant.hero.images.map((i) => `${base}${i.src}`),
    address: {
      "@type": "PostalAddress",
      streetAddress: "Advantage Padel",
      addressLocality: "Mudeford",
      addressRegion: "Dorset",
      addressCountry: "GB",
    },
    priceRange: "££",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days,
        opens: tenant.scheduling.openTime,
        closes: tenant.scheduling.lastSlotTime,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline here (no user input).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
