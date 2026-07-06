import { cn } from "@/lib/utils";

/**
 * Small stroke-icon set used across the booking UI. Inline SVGs keep us free of
 * any icon-library dependency. Icons inherit color via `currentColor` and size
 * via the `className` you pass (default 24px).
 */
export type IconName =
  | "sauna"
  | "plunge"
  | "sea"
  | "private"
  | "arrow-right"
  | "chevron-right"
  | "calendar"
  | "menu";

function paths(name: IconName) {
  switch (name) {
    case "sauna": // rising steam
      return (
        <>
          <path d="M8.5 21 Q7 19.3 8.5 17.6 Q10 15.9 8.5 14.2 Q7 12.5 8.5 11" />
          <path d="M12 21 Q10.5 19.3 12 17.6 Q13.5 15.9 12 14.2 Q10.5 12.5 12 11" />
          <path d="M15.5 21 Q14 19.3 15.5 17.6 Q17 15.9 15.5 14.2 Q14 12.5 15.5 11" />
        </>
      );
    case "plunge": // droplet
      return (
        <path d="M12 3.5c3.5 4 5.5 6.6 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.9 2-5.5 5.5-9.5z" />
      );
    case "sea": // sun over waves
      return (
        <>
          <circle cx="12" cy="9" r="3.2" />
          <path d="M4 15.5h16" />
          <path d="M5 18.8c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.2 0 2.8-1.2 4.2 0" />
        </>
      );
    case "private": // two people
      return (
        <>
          <path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9.5" cy="8" r="3.5" />
          <path d="M21 20v-1a4 4 0 0 0-3-3.87" />
          <path d="M15.5 4.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      );
    case "chevron-right":
      return <polyline points="9 18 15 12 9 6" />;
    case "calendar":
      return (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      );
    case "menu":
      return (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      );
  }
}

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      {paths(name)}
    </svg>
  );
}
