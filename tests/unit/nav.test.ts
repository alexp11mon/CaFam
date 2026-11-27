import { describe, expect, it } from "vitest";
import {
  activeSection,
  BAR_SECTIONS,
  createHref,
  NAV_ITEMS,
  SHEET_SECTIONS,
} from "@/lib/shell/nav";

// Spec 005, T4: destinations of the side rail and the bottom bar, and which
// one is current (RF-16, RF-18, RF-20; plan nav).
describe("NAV_ITEMS", () => {
  it("works offline only in Ahora, Calendario and Notas (spec 054 RF-21)", () => {
    expect(
      NAV_ITEMS.filter((item) => !item.needsNetwork).map(
        (item) => item.section,
      ),
    ).toEqual(["now", "calendar", "notes"]);
  });

  it("lists the destinations of the app in Spanish", () => {
    expect(NAV_ITEMS.map(({ label, href }) => [label, href])).toEqual([
      ["Ahora", "/dashboard/now"],
      ["Calendario", "/dashboard/calendar"],
      ["Notas", "/dashboard/notes"],
      ["Mis calendarios", "/dashboard/calendars"],
      ["Asistente", "/dashboard/assistant"],
      ["Cuentas conectadas", "/dashboard/connections"],
      ["Unirme con código", "/dashboard/join"],
      ["Importar calendario", "/dashboard/import"],
      ["Papelera", "/dashboard/trash"],
      ["Ajustes", "/dashboard/settings"],
    ]);
  });
});

describe("activeSection (RF-20)", () => {
  it.each([
    // Spec 054 (RF-23).
    ["/dashboard/now", "now"],
    ["/dashboard/calendar", "calendar"],
    ["/dashboard/events/new", "calendar"],
    ["/dashboard/events/0f6c", "calendar"],
    ["/dashboard/notes", "notes"],
    ["/dashboard/notes/new", "notes"],
    ["/dashboard/calendars", "calendars"],
    ["/dashboard/calendars/new", "calendars"],
    ["/dashboard/calendars/0f6c/share", "calendars"],
    ["/dashboard/connections", "connections"],
    ["/dashboard/connections/0f6c", "connections"],
    ["/dashboard/join", "join"],
    ["/dashboard/import", "import"],
    // Spec 046 (RF-3).
    ["/dashboard/trash", "trash"],
    ["/dashboard/settings", "settings"],
    // Spec 015, T9 (RF-1).
    ["/dashboard/assistant", "assistant"],
    ["/dashboard", null],
    ["/dashboard/calendarx", null],
    ["/login", null],
  ])("%s → %s", (pathname, section) => {
    expect(activeSection(pathname)).toBe(section);
  });
});

// Spec 025 (RF-8, plan D7).
describe("the bottom bar and its +", () => {
  it("splits the destinations between the bar and the Más sheet", () => {
    // Spec 054 plan D6: "Ahora" in the bar, "Mis calendarios" first in Más.
    expect(BAR_SECTIONS).toEqual(["now", "calendar", "notes"]);
    expect(SHEET_SECTIONS).toEqual([
      "calendars",
      "connections",
      "join",
      "import",
      "trash",
      "settings",
    ]);
  });

  it.each([
    [
      "/dashboard/calendar",
      "?view=month&date=2026-12-01",
      "/dashboard/events/new?date=2026-12-01",
    ],
    ["/dashboard/calendar", "", "/dashboard/events/new"],
    ["/dashboard/calendar", "?date=nope", "/dashboard/events/new"],
    ["/dashboard/settings", "?date=2026-12-01", "/dashboard/events/new"],
    ["/dashboard/notes", "", "/dashboard/notes/new"],
    ["/dashboard/notes/abc", "", "/dashboard/notes/new"],
  ])("%s%s → %s", (pathname, search, href) => {
    expect(createHref(pathname, search)).toBe(href);
  });
});
