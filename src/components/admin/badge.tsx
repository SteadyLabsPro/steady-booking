import { cn } from "@/lib/utils";

/**
 * Small status pill for the admin dashboard. Tones are generic so the same
 * component covers booking status, waiver status, and (later) payment status.
 */
export type BadgeTone = "success" | "warning" | "neutral" | "danger";

const TONES: Record<BadgeTone, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  neutral: "bg-neutral-100 text-neutral-600",
  danger: "bg-red-100 text-red-700",
};

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
