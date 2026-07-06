import type { Metadata, Viewport } from "next";
import { tenant } from "@/config/tenant.config";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
