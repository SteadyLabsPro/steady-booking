import { Icon } from "@/components/icons";
import type { TenantFeature } from "@/engine";

/**
 * The business highlights. Renders as an inline footer row on desktop and a
 * fixed bottom bar on mobile. Presentational only (no navigation yet).
 */
export function FeatureStrip({ features }: { features: TenantFeature[] }) {
  const cols = {
    gridTemplateColumns: `repeat(${features.length}, minmax(0, 1fr))`,
  };
  return (
    <>
      {/* Desktop: inline footer */}
      <footer className="mt-12 hidden border-t border-border md:block">
        <div
          className="mx-auto grid max-w-6xl gap-4 px-8 py-6"
          style={cols}
        >
          {features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2.5 text-sm text-muted"
            >
              <Icon name={feature.icon} className="h-5 w-5 shrink-0" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      </footer>

      {/* Mobile: fixed bottom bar */}
      <nav
        aria-label="Highlights"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid" style={cols}>
          {features.map((feature) => (
            <div
              key={feature.label}
              className="flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] leading-tight text-muted"
            >
              <Icon name={feature.icon} className="h-5 w-5" />
              <span className="text-center">{feature.label}</span>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
