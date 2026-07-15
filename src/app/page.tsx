import Image from "next/image";
import Link from "next/link";
import { tenant } from "@/config/tenant.config";
import { formatPrice, sessionDateKey } from "@/engine";
import { getAvailability } from "@/lib/supabase/availability";
import { toSlotViews } from "@/lib/booking/slots";
import { cn } from "@/lib/utils";
import {
  BookingView,
  type ServiceView,
} from "@/components/booking/booking-view";
import { BuyPass } from "@/components/booking/buy-pass";
import { Icon } from "@/components/icons";
import { isStripeConfigured } from "@/lib/payments/stripe";

/**
 * Public booking screen. Editorial landing + date-first booking flow. Reads
 * real availability from Supabase (server-side, service role) and hands the
 * client view ready-to-render models. Rendered per request so "Today" reflects
 * the viewer's current date.
 */
export const dynamic = "force-dynamic";

const BOUNDS = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const AVAILABILITY_WINDOW_DAYS = 14;

function Logo() {
  return (
    <>
      {/* Mobile: horizontal lockup */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tide-house-logo-horizontal.png"
        alt={tenant.name}
        className="block h-12 w-auto shrink-0 md:hidden"
      />
      {/* Desktop: stacked lockup */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tide-house-logo-only.png"
        alt={tenant.name}
        className="hidden h-20 w-auto shrink-0 md:block"
      />
    </>
  );
}

function Hero({ canBuyOnline }: { canBuyOnline: boolean }) {
  const { hero } = tenant;
  const price = formatPrice(tenant.pricing.sessionPriceMinor, tenant.currency);
  const { openTime, lastSlotTime, daysOfWeek, slotMinutes } = tenant.scheduling;
  const pass = tenant.bundles[0];

  return (
    <section className="w-full border-b border-border">
      <div className="grid md:min-h-[74vh] md:grid-cols-[43%_57%]">
        {/* Copy column — aligned to the page gutter, vertically centred */}
        <div className="order-2 flex flex-col justify-center gap-6 px-5 py-9 sm:px-8 md:order-1 md:py-14 md:pr-12 md:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-5xl leading-[1.03] tracking-tight sm:text-6xl">
              {hero.headline}
            </h1>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted sm:text-sm">
                {hero.subCaption}
              </span>
              <span className="text-sm text-muted">
                Open {openTime}–{lastSlotTime}, {daysOfWeek.length} days a week.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Primary — book a single session */}
            <div className="flex flex-col items-start gap-1.5">
              <a
                href="#book"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-accent/90"
              >
                Book a session
                <Icon name="arrow-right" className="h-4 w-4 rotate-90" />
              </a>
              <span className="pl-5 text-xs text-muted">
                {price} pp / {slotMinutes} min
              </span>
            </div>

            {/* Secondary — buy a pass */}
            {pass && (
              <div className="flex flex-col items-start gap-1.5">
                <BuyPass
                  canBuyOnline={canBuyOnline}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-[#c2a06a] px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-[#b5934f]"
                >
                  {pass.sessions}-session pass
                </BuyPass>
                <span className="pl-5 text-xs text-muted">
                  {formatPrice(pass.priceMinor, tenant.currency)}
                  {pass.validityMonths > 0
                    ? ` · valid ${pass.validityMonths} months`
                    : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Full-bleed image — on top when stacked (mobile), right on desktop */}
        <div className="relative order-1 h-56 w-full sm:h-72 md:order-2 md:h-auto">
          <Image
            src="/plunge-th.png"
            alt="The cold plunge tubs at The Tide House"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 57vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-accent text-white">
      <div
        className={cn(
          BOUNDS,
          "flex flex-col gap-6 py-9 sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold tracking-tight">{tenant.name}</p>
          <p className="text-sm text-white/70">{tenant.address}</p>
          <a
            href={`mailto:${tenant.contactEmail}`}
            className="text-sm text-white/70 transition-colors hover:text-white"
          >
            {tenant.contactEmail}
          </a>
        </div>

        <nav
          aria-label="Legal"
          className="flex flex-col gap-2 text-sm text-white/70 sm:items-end"
        >
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms &amp; Conditions
          </Link>
          <a
            href={tenant.waiver.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-white"
          >
            Waiver
          </a>
        </nav>
      </div>

      <div className={cn(BOUNDS, "border-t border-white/15 py-4")}>
        <p className="text-xs text-white/60">
          © {year} {tenant.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default async function BookingPage() {
  const todayKey = sessionDateKey(new Date().toISOString(), tenant.timezone);

  // Near-term availability from Supabase (server-side, service role). The
  // calendar lazily loads further months on the client from here.
  const availability = await getAvailability(todayKey, AVAILABILITY_WINDOW_DAYS);

  const canBuyOnline = isStripeConfigured();

  const services: ServiceView[] = availability.services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.durationMinutes,
    description: s.description,
    icon: "sauna", // single service in the MVP; per-service icons can come later
  }));

  const slots = toSlotViews(availability);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-[#c2a06a]/70 bg-[#f5eee6]">
        <div
          className={cn(BOUNDS, "flex items-center justify-between gap-3 py-4")}
        >
          <Logo />
          <span className="hidden text-right text-xs font-medium uppercase leading-tight tracking-[0.2em] text-muted sm:block">
            {tenant.descriptor}
          </span>
        </div>
      </header>

      <Hero canBuyOnline={canBuyOnline} />

      <main className="flex-1">
        <BookingView
          services={services}
          slots={slots}
          todayKey={todayKey}
          currency={tenant.currency}
          waiver={tenant.waiver}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
