import type { ReactNode } from "react";

// Own inline icons: thin outline, one set, no icon library (spec 005 plan
// icons, P6). Always decorative: the label next to them names the action.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  );
}

export function CalendarsIcon() {
  return (
    <Icon>
      <rect x="7" y="3" width="14" height="14" rx="2" />
      <path d="M3 7v12a2 2 0 0 0 2 2h12" />
    </Icon>
  );
}

export function JoinIcon() {
  return (
    <Icon>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </Icon>
  );
}

export function ImportIcon() {
  return (
    <Icon>
      <path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Icon>
  );
}

export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Icon>
  );
}

export function SignOutIcon() {
  return (
    <Icon>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
    </Icon>
  );
}

export function MoreIcon() {
  return (
    <Icon>
      <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <Icon>
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <Icon>
      <path
        d={
          expanded
            ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
            : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        }
      />
    </Icon>
  );
}

export const SECTION_ICONS = {
  calendar: CalendarIcon,
  calendars: CalendarsIcon,
  join: JoinIcon,
  import: ImportIcon,
  settings: SettingsIcon,
} as const;
