import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — an elevated surface for grouping content (session options,
 * summaries, forms) in the booking flow. Minimal by design: a soft border,
 * a white surface against the warm canvas, and a whisper of shadow.
 *
 * `interactive` adds hover/press affordances for cards that act as buttons
 * (e.g. selecting a session).
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        interactive &&
          "cursor-pointer transition-colors hover:border-accent/40 active:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}
