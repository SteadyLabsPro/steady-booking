import { tenant } from "@/config/tenant.config";
import {
  formatPrice,
  formatSessionTime,
  sessionDateKey,
  remainingSpaces,
} from "@/engine";
import {
  MOCK_SERVICES,
  MOCK_SESSIONS,
  MOCK_BOOKINGS,
  POPULAR_SESSION_IDS,
} from "@/mocks/booking";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icons";
import {
  BookingView,
  type SlotView,
  type ServiceView,
} from "@/components/booking/booking-view";
import { FeatureStrip } from "@/components/booking/feature-strip";

/**
 * Public booking screen (Stage 4). Editorial landing + date-first booking flow,
 * built from mock, schema-shaped data — no Supabase, Stripe, or waiver yet.
 * The server does all engine work and hands the client view ready-to-render
 * models. Rendered per request so "Today" reflects the viewer's current date.
 */
export const dynamic = "force-dynamic";

const BOUNDS = "mx-auto w-full max-w-6xl px-5 sm:px-8";

// Presentation-only: which icon represents each service (kept out of the schema).
const SERVICE_ICONS: Record<string, IconName> = {
  svc_sauna_plunge: "sauna",
  svc_private: "private",
};

function Wordmark() {
  return (
    <div className="flex flex-col leading-none">
      <span className="font-serif text-lg font-medium tracking-wide">
        {tenant.name.toUpperCase()}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        {tenant.descriptor}
      </span>
    </div>
  );
}

function Hero() {
  const { hero } = tenant;
  return (
    <section className={cn(BOUNDS, "pt-2 pb-10")}>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-5">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {hero.eyebrow}
          </span>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {hero.headline}
          </h1>
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold text-foreground">
              {hero.tagline}
            </p>
            <p className="max-w-md text-base text-muted">{hero.subcopy}</p>
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

        {/* Hero image — swap the gradient for a photo via tenant.hero.image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl md:aspect-[5/4]">
          {hero.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.image}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg,#f7ecd9 0%,#f0dcbf 46%,#aab4b0 54%,#8b9c9d 100%)",
                }}
              />
              <div
                className="absolute left-1/2 top-[40%] h-28 w-28 -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle,#fff3dd 0%,rgba(255,243,221,0) 70%)",
                }}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BookingPage() {
  const todayKey = sessionDateKey(new Date().toISOString(), tenant.timezone);

  // Only active services (and their active sessions) are shown to customers.
  const activeServices = MOCK_SERVICES.filter((service) => service.isActive);
  const activeServiceIds = new Set(activeServices.map((service) => service.id));

  const services: ServiceView[] = activeServices.map((service) => ({
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    description: service.description,
    icon: SERVICE_ICONS[service.id] ?? "sauna",
  }));

  const slots: SlotView[] = MOCK_SESSIONS.filter(
    (session) => session.isActive && activeServiceIds.has(session.serviceId),
  ).map((session) => ({
    id: session.id,
    serviceId: session.serviceId,
    dateKey: sessionDateKey(session.startsAt, tenant.timezone),
    time: formatSessionTime(session.startsAt, tenant.timezone),
    price: formatPrice(session.priceMinor, tenant.currency),
    remaining: remainingSpaces(
      session.capacity,
      MOCK_BOOKINGS.filter((b) => b.sessionId === session.id),
    ),
    popular: POPULAR_SESSION_IDS.has(session.id),
  }));

  return (
    <div className="flex min-h-dvh flex-col pb-24 md:pb-0">
      <header className={cn(BOUNDS, "flex items-center justify-between py-5")}>
        <Wordmark />
        <button
          type="button"
          aria-label="Menu"
          className="text-foreground md:hidden"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>
      </header>

      <Hero />

      <main className="flex-1">
        <BookingView services={services} slots={slots} todayKey={todayKey} />
      </main>

      <FeatureStrip features={tenant.features} />
    </div>
  );
}
