import { Icon } from "@/components/icons";
import { tenant } from "@/config/tenant.config";
import { cn } from "@/lib/utils";

/**
 * Entry instructions callout. Guests can't get into the building without the
 * code, so this is repeated everywhere they'll look: the "how it works"
 * explainer, the on-screen booking confirmation, and confirmation emails.
 */
export function AccessNotice({ className }: { className?: string }) {
  const { heading, body } = tenant.accessNotice;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-[#c2a06a]/50 bg-accent/5 p-4 text-left",
        className,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c2a06a] text-white">
        <Icon name="key" className="h-4 w-4" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight">{heading}</h3>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
