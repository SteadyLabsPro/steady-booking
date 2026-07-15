import { Icon } from "@/components/icons";
import type { TenantStep, TenantNotice } from "@/engine";
import { cn } from "@/lib/utils";

/**
 * "How it works" explainer: a single row on desktop, 2x2 on mobile. The access
 * notice is called out separately since guests need the code to get in.
 */
export function HowItWorks({
  steps,
  notice,
  className,
}: {
  steps: TenantStep[];
  notice: TenantNotice;
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <section id="how-it-works" className={cn("scroll-mt-6", className)}>
      <div className="flex flex-col gap-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          How it works
        </h2>

        <ol className="grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-6">
          {steps.map((step, i) => (
            <li key={step.text} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Icon name={step.icon} className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c2a06a]">
                  Step {i + 1}
                </span>
              </div>
              <p className="text-sm leading-snug text-foreground">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="flex items-start gap-3 rounded-xl border border-[#c2a06a]/40 bg-accent/5 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c2a06a] text-white">
            <Icon name="key" className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold tracking-tight">
              {notice.heading}
            </h3>
            <p className="text-sm text-muted">{notice.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
