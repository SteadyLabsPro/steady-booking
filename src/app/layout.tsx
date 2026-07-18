import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { tenant } from "@/config/tenant.config";
import { formatPrice } from "@/engine";
import "./globals.css";

// Display serif for the wordmark and hero headline. Self-hosted by next/font,
// exposed to CSS as --font-fraunces (see globals.css --font-serif).
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

const price = formatPrice(tenant.pricing.sessionPriceMinor, tenant.currency);
const heroTitle = `${tenant.name} — Sauna & Cold Plunge, Mudeford`;
const heroDescription =
  `Book a hot coal sauna and cold plunge session at ${tenant.name}, inside ` +
  `${tenant.address}. From ${price} per person — open ` +
  `${tenant.scheduling.openTime}–${tenant.scheduling.lastSlotTime}, ` +
  `${tenant.scheduling.daysOfWeek.length} days a week.`;

export const metadata: Metadata = {
  metadataBase: new URL(tenant.url),
  title: {
    default: heroTitle,
    template: `%s — ${tenant.name}`,
  },
  description: heroDescription,
  applicationName: tenant.name,
  keywords: [
    "sauna Mudeford",
    "cold plunge Mudeford",
    "ice bath Christchurch",
    "sauna Christchurch",
    "contrast therapy Dorset",
    "recovery",
    tenant.name,
    "Advantage Padel",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: tenant.url,
    siteName: tenant.name,
    title: heroTitle,
    description: heroDescription,
    locale: "en_GB",
    images: [
      { url: "/plunge-th.png", alt: "The cold plunge tubs at The Tide House" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: heroTitle,
    description: heroDescription,
    images: ["/plunge-th.png"],
  },
  robots: { index: true, follow: true },
};

// Mobile-first: lock the viewport to device width from the start.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} scroll-smooth`}>
      <body>{children}</body>
    </html>
  );
}
