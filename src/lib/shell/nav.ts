// Destinations of the side rail and the bottom bar, and which one is current
// (spec 005 RF-16, RF-18, RF-20; plan nav).

export type Section =
  | "calendar"
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
}

export const NAV_ITEMS: readonly NavItem[] = [
  { section: "calendar", href: "/dashboard/calendar", label: "Calendario" },
  {
    section: "calendars",
    href: "/dashboard/calendars",
    label: "Mis calendarios",
  },
  // Spec 015 (RF-1).
  { section: "assistant", href: "/dashboard/assistant", label: "Asistente" },
  {
    section: "connections",
    href: "/dashboard/connections",
    label: "Cuentas conectadas",
  },
  { section: "join", href: "/dashboard/join", label: "Unirme con código" },
  {
    section: "import",
    href: "/dashboard/import",
    label: "Importar calendario",
  },
  { section: "settings", href: "/dashboard/settings", label: "Ajustes" },
];

// Events open from the calendar, so they belong to it.
const PREFIXES: readonly [string, Section][] = [
  ["/dashboard/calendar", "calendar"],
  ["/dashboard/events", "calendar"],
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
