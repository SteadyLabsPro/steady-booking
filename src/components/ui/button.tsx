import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Button — the primary interactive primitive of the booking flow.
 *
 * Mobile-first: default size is a 44px-tall tap target, and `fullWidth`
 * gives the edge-to-edge CTA common on mobile. Variants are hand-rolled
 * maps (no cva dependency yet); the API mirrors shadcn so a future swap
 * to a cva/Radix-based Button keeps the same props.
 */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50 select-none";

const variantStyles = {
  primary: "bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80",
  secondary: "bg-subtle text-foreground hover:bg-border active:bg-border",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-subtle active:bg-border",
  ghost: "bg-transparent text-foreground hover:bg-subtle active:bg-border",
} as const;

const sizeStyles = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm", // 44px — minimum comfortable mobile tap target
  lg: "h-12 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", fullWidth = false, type = "button", ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
