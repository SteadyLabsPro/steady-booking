import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { tenant } from "@/config/tenant.config";
import "./globals.css";

// Display serif for the wordmark and hero headline. Self-hosted by next/font,
// exposed to CSS as --font-fraunces (see globals.css --font-serif).
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: tenant.name,
  description: tenant.tagline,
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
    <html lang="en" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}
