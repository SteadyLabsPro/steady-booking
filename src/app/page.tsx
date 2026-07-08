import { tenant } from "@/config/tenant.config";
import {
  formatPrice,
  formatSessionDate,
  formatSessionTime,
  sessionDateKey,
} from "@/engine";
import { getAvailability } from "@/lib/supabase/availability";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";
import {
  BookingView,
  type SlotView,
  type ServiceView,
} from "@/components/booking/booking-view";
import { FeatureStrip } from "@/components/booking/feature-strip";

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
        className="block h-10 w-auto md:hidden"
      />
      {/* Desktop: stacked lockup */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tide-house-logo-only.png"
        alt={tenant.name}
        className="hidden h-16 w-auto md:block"
      />
    </>
  );
}

function Hero() {
  const { hero } = tenant;
  return (
    <section className={cn(BOUNDS, "pt-2 pb-12")}>
      <div className="flex max-w-4xl flex-col gap-5">
        <h1 className="font-serif text-5xl leading-[1.03] tracking-tight sm:text-6xl">
          {hero.headline}
        </h1>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-foreground">
            {hero.tagline}
          </p>
          <p className="max-w-xl text-base text-muted">{hero.subcopy}</p>
        </div>
        <div>
          <a
            href="#book"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            {hero.ctaLabel}
            <Icon name="arrow-right" className="h-4 w-4" />
          </a>
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
          className={cn(BOUNDS, "flex items-center justify-between gap-4 py-4")}
        >
          {/* Left: logo (+ descriptor beneath it on mobile) */}
          <div className="flex flex-col gap-1.5">
            <Logo />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted md:hidden">
              {tenant.descriptor}
            </span>
          </div>
          {/* Desktop: descriptor right-aligned */}
          <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-muted md:block">
            {tenant.descriptor}
          </span>
          {/* Mobile: menu */}
          <button
            type="button"
            aria-label="Menu"
            className="text-foreground md:hidden"
          >
            <Icon name="menu" className="h-6 w-6" />
          </button>
        </div>
      </header>

      <Hero />

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
