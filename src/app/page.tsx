import Image from "next/image";
import { tenant } from "@/config/tenant.config";
import {
  formatPrice,
  formatSessionDate,
  formatSessionTime,
  sessionDateKey,
} from "@/engine";
import { getAvailability } from "@/lib/supabase/availability";
import { cn } from "@/lib/utils";
import {
  BookingView,
  type SlotView,
  type ServiceView,
} from "@/components/booking/booking-view";
import { FeatureStrip } from "@/components/booking/feature-strip";
import { BuyPass } from "@/components/booking/buy-pass";
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

// Presentation-only: slot times flagged as popular.
const POPULAR_SLOT_TIMES = new Set<string>(["18:00"]);

function Logo() {
  return (
    <>
      {/* Mobile: horizontal lockup */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tide-house-logo-horizontal.png"
        alt={tenant.name}
        className="block h-9 w-auto shrink-0 md:hidden"
      />
      {/* Desktop: stacked lockup */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tide-house-logo-only.png"
        alt={tenant.name}
        className="hidden h-16 w-auto shrink-0 md:block"
      />
    </>
  );
}

function Hero({ canBuyOnline }: { canBuyOnline: boolean }) {
  const { hero } = tenant;
  const price = formatPrice(tenant.pricing.sessionPriceMinor, tenant.currency);
  const { openTime, lastSlotTime, daysOfWeek } = tenant.scheduling;
  const pass = tenant.bundles[0];

  const services = tenant.features.map((f) => f.label).join("   ·   ");

  return (
    <section className="w-full border-b border-border">
      <div className="grid md:min-h-[74vh] md:grid-cols-[43%_57%]">
        {/* Copy column — aligned to the page gutter, vertically centred */}
        <div className="order-2 flex flex-col justify-center gap-6 px-5 py-9 sm:px-8 md:order-1 md:py-14 md:pr-12 md:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
          <div className="flex flex-col gap-3">
            <h1 className="font-serif text-5xl leading-[1.03] tracking-tight sm:text-6xl">
              {hero.headline}
            </h1>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted sm:text-sm">
              {hero.subCaption}
            </span>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[#c2a06a] sm:text-sm">
              {services}
            </p>
          </div>

          <a
            href="#book"
            className="inline-flex w-fit items-center rounded-md bg-accent px-7 py-3.5 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-accent/90"
          >
            Book a session
          </a>

          <div className="flex flex-col gap-3 pt-1">
            <hr className="w-full max-w-xs border-t border-border" />
            <div className="text-sm text-muted">
              <span className="font-semibold text-foreground">{price}pp</span> ·{" "}
              {openTime}–{lastSlotTime} · {daysOfWeek.length} days a week.
              {pass && (
                <>
                  {" "}
                  <BuyPass
                    canBuyOnline={canBuyOnline}
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    Or save with a {pass.sessions}-visit pass —{" "}
                    {formatPrice(pass.priceMinor, tenant.currency)}
                    {pass.validityMonths > 0
                      ? `, valid ${pass.validityMonths} months`
                      : ""}{" "}
                    &rarr;
                  </BuyPass>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Full-bleed image — on top when stacked (mobile), right on desktop */}
        <div className="relative order-1 h-56 w-full sm:h-72 md:order-2 md:h-auto">
          <Image
            src="/tidehouse-sauna.png"
            alt="Inside the Tide House sauna"
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

export default async function BookingPage() {
  const todayKey = sessionDateKey(new Date().toISOString(), tenant.timezone);

  // Real availability from Supabase (server-side, service role).
  const { services: dbServices, sessions, remainingBySession } =
    await getAvailability(todayKey, AVAILABILITY_WINDOW_DAYS);

  const canBuyOnline = isStripeConfigured();
  const activeServiceIds = new Set(dbServices.map((s) => s.id));

  const services: ServiceView[] = dbServices.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.durationMinutes,
    description: s.description,
    icon: "sauna", // single service in the MVP; per-service icons can come later
  }));

  const slots: SlotView[] = sessions
    .filter((s) => activeServiceIds.has(s.serviceId))
    .map((s) => {
      const time = formatSessionTime(s.startsAt, tenant.timezone);
      return {
        id: s.id,
        serviceId: s.serviceId,
        dateKey: sessionDateKey(s.startsAt, tenant.timezone),
        dateLabel: formatSessionDate(s.startsAt, tenant.timezone),
        time,
        price: formatPrice(s.priceMinor, tenant.currency),
        priceMinor: s.priceMinor,
        remaining: remainingBySession[s.id] ?? s.capacity,
        popular: POPULAR_SLOT_TIMES.has(time),
      };
    });

  return (
    <div className="flex min-h-dvh flex-col pb-24 md:pb-0">
      <header className="border-b border-[#c2a06a]/70 bg-[#f5eee6]">
        <div
          className={cn(BOUNDS, "flex items-center justify-between gap-3 py-4")}
        >
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs font-medium uppercase leading-tight tracking-[0.2em] text-muted sm:block">
              {tenant.descriptor}
            </span>
            <BuyPass
              canBuyOnline={canBuyOnline}
              className="inline-flex shrink-0 items-center rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90 sm:text-sm"
            >
              <span className="hidden sm:inline">
                10-visit pass · {formatPrice(tenant.bundles[0]?.priceMinor ?? 0, tenant.currency)}
              </span>
              <span className="sm:hidden">
                {formatPrice(tenant.bundles[0]?.priceMinor ?? 0, tenant.currency)} pass
              </span>
            </BuyPass>
          </div>
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

      <FeatureStrip features={tenant.features} />
    </div>
  );
}
