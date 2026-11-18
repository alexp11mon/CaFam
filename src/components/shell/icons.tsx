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

/** Smaller than the rest: it sits next to the text of an event (spec 012 RF-12). */
export function ImageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="inline-block shrink-0 align-[-2px]"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

/** A change waiting on the device (spec 034 RF-28): an arrow up a cloud, the size of ImageIcon. */
export function PendingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon="pending"
      className="inline-block shrink-0 align-[-2px]"
    >
      <path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9" />
      <path d="M12 21v-8m-3 3 3-3 3 3" />
    </svg>
  );
}

/** No connection (spec 034 RF-9): a cloud crossed out. */
export function OfflineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="inline-block shrink-0"
    >
      <path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8H7Z" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

/** Comments (spec 014 RF-5): a speech bubble, the size of ImageIcon. */
export function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon="comment"
      className="inline-block shrink-0 align-[-2px]"
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/** A series (spec 013 RF-9): two arrows in a loop, the size of ImageIcon. */
export function RepeatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon="repeat"
      className="inline-block shrink-0 align-[-2px]"
    >
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
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

export function ConnectionsIcon() {
  return (
    <Icon>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
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

const CHEVRONS = {
  left: "m15 6-6 6 6 6",
  right: "m9 6 6 6-6 6",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
} as const;

export function ChevronIcon({
  direction,
}: {
  direction: keyof typeof CHEVRONS;
}) {
  return (
    <Icon>
      <path d={CHEVRONS[direction]} />
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

/** A speech bubble: the chat of the assistant (spec 015 RF-1). */
export function AssistantIcon() {
  return (
    <Icon>
      <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8M8 13h5" />
    </Icon>
  );
}

/** A pin: a note kept at the top (spec 028). */
export function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Icon>
      <path
        d="M9 4h6l-1 6 3 3H7l3-3-1-6Z"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M12 13v7" />
    </Icon>
  );
}

/** A box: archive (spec 028). */
export function ArchiveIcon() {
  return (
    <Icon>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
    </Icon>
  );
}

/** A bin: delete (spec 028). */
export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </Icon>
  );
}

/** A lens: search (spec 028). */
export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

/** A paper plane: send (spec 027). */
export function SendIcon() {
  return (
    <Icon>
      <path d="M4 12 20 4l-5 17-3.5-7L4 12Z" />
      <path d="m11.5 14 4-5" />
    </Icon>
  );
}

/** A sheet with a pencil: a new conversation (spec 027). */
export function NewChatIcon() {
  return (
    <Icon>
      <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="m18.5 3.5 2 2L13 13l-3 1 1-3 7.5-7.5Z" />
    </Icon>
  );
}

/** A sheet with a ticked list: notes and to-dos (spec 025, 028). */
export function NotesIcon() {
  return (
    <Icon>
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 12.5l1.5 1.5 3-3M8.5 17.5h7" />
    </Icon>
  );
}

/** Three sliders: what the calendar shows (views and filters). */
export function FiltersIcon() {
  return (
    <Icon>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Icon>
  );
}

export const SECTION_ICONS = {
  calendar: CalendarIcon,
  notes: NotesIcon,
  calendars: CalendarsIcon,
  assistant: AssistantIcon,
  join: JoinIcon,
  connections: ConnectionsIcon,
  import: ImportIcon,
  settings: SettingsIcon,
} as const;

/** The theme shortcut shows where it goes: the sun on the dark theme (spec 011 RF-6). */
export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon() {
  return (
    <Icon>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </Icon>
  );
}

/** The ≡ that opens the phone drawer (spec 016 RF-12). */
export function MenuIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

/** A calendar page with today's number, as the "Hoy" button (spec 016 RF-9). */
export function TodayIcon({ day }: { day: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M8 2.5v3M16 2.5v3" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        {day}
      </text>
    </svg>
  );
}

/** The small caret next to the title that unfolds the picker (spec 016 RF-8). */
export function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      // It turns over instead of jumping (spec 021 RF-2).
      className={`transition-[rotate] duration-(--motion-base-in) ease-(--ease-in-out) ${open ? "rotate-180" : ""}`}
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}

/** The chosen one in a list of colors: a mark, not only the color (spec 017 RF-35). */
export function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}
