// Destinations of the side rail and the bottom bar, and which one is current
// (spec 005 RF-16, RF-18, RF-20; plan nav).

export type Section =
  | "calendar"
  | "notes"
  | "calendars"
  | "assistant"
  | "connections"
  | "join"
  | "import"
  | "settings";

export interface NavItem {
  section: Section;
  href: string;
  label: string;
  /** Not in the offline app: shown disabled without a connection (spec 034 RF-17). */
  needsNetwork?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { section: "calendar", href: "/dashboard/calendar", label: "Calendario" },
  // Spec 025 RF-8 (the screen itself is spec 028).
  { section: "notes", href: "/dashboard/notes", label: "Notas" },
  {
    section: "calendars",
    href: "/dashboard/calendars",
    label: "Mis calendarios",
    needsNetwork: true,
  },
  // Spec 015 (RF-1).
  {
    section: "assistant",
    href: "/dashboard/assistant",
    label: "Asistente",
    needsNetwork: true,
  },
  {
    section: "connections",
    href: "/dashboard/connections",
    label: "Cuentas conectadas",
    needsNetwork: true,
  },
  {
    section: "join",
    href: "/dashboard/join",
    label: "Unirme con código",
    needsNetwork: true,
  },
  {
    section: "import",
    href: "/dashboard/import",
    label: "Importar calendario",
    needsNetwork: true,
  },
  {
    section: "settings",
    href: "/dashboard/settings",
    label: "Ajustes",
    needsNetwork: true,
  },
];

/**
 * The bottom bar (up to 1023 px): two destinations on each side of "+"
 * (constitution, amendment 10; spec 025 RF-8, plan D7).
 */
export const BAR_SECTIONS: readonly Section[] = [
  "calendar",
  "notes",
  "calendars",
];

/** The rest, in the "Más" sheet. The assistant has its own button. */
export const SHEET_SECTIONS: readonly Section[] = [
  "connections",
  "join",
  "import",
  "settings",
];

/** A short name for the bar, where "Mis calendarios" does not fit. */
export const BAR_LABELS: Partial<Record<Section, string>> = {
  calendars: "Calendarios",
};

/**
 * What "+" creates on each screen: a note in Notas, an event anywhere else,
 * on the calendar's date when it shows one.
 */
export function createHref(pathname: string, search = ""): string {
  if (activeSection(pathname) === "notes") return "/dashboard/notes/new";
  const date = new URLSearchParams(search).get("date");
  return pathname === "/dashboard/calendar" &&
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `/dashboard/events/new?date=${date}`
    : "/dashboard/events/new";
}

// Events open from the calendar, so they belong to it.
const PREFIXES: readonly [string, Section][] = [
  ["/dashboard/calendar", "calendar"],
  ["/dashboard/events", "calendar"],
  ["/dashboard/notes", "notes"],
  ["/dashboard/calendars", "calendars"],
  ["/dashboard/assistant", "assistant"],
  ["/dashboard/connections", "connections"],
  ["/dashboard/join", "join"],
  ["/dashboard/import", "import"],
  ["/dashboard/settings", "settings"],
];

export function activeSection(pathname: string): Section | null {
  const match = PREFIXES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match[1] : null;
}
