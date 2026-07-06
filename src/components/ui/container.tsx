import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Container — the mobile-first reading column.
 *
 * Centres content and caps width at a comfortable single-column measure
 * for the booking journey, with consistent gutter padding. Override the
 * width per-use via `className` (e.g. `max-w-lg`) when a screen needs it.
 */
export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-md px-5", className)}
      {...props}
    />
  );
}
