/**
 * Class-name joiner with a shadcn-compatible `cn(...)` signature.
 *
 * Dependency-free for now: it filters falsy values and joins with spaces,
 * which covers the `cn("base", cond && "x", className)` patterns we use.
 * When/if we adopt shadcn later, swap this body for the standard
 * `clsx` + `tailwind-merge` implementation — the signature is unchanged,
 * so callers don't move.
 */
export type ClassValue = string | number | null | false | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
