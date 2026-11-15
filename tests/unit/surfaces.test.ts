// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 011, T9: the containers of RF-12 are surface, and what floats takes the
// floating surface (RF-12, RF-13, RF-14; plan surface-surfaces, D6).
const SURFACES: [file: string, utility: "surface" | "surface-float"][] = [
  // Spec 025: the bar floats over the content; the side bar is plain paper.
  ["src/components/shell/bottom-bar.tsx", "surface-float"],
  ["src/components/shell/calendar-sheet.tsx", "surface-float"],
  ["src/components/calendar/next-event-card.tsx", "surface"],
  ["src/components/calendar/mini-month.tsx", "surface"],
  ["src/components/calendar/calendar-filters.tsx", "surface"],
  ["src/app/dashboard/settings/page.tsx", "surface"],
  ["src/components/shell/more-sheet.tsx", "surface-float"],
  ["src/components/calendar/event-modal.tsx", "surface-float"],
  ["src/components/calendar/quick-create.tsx", "surface-float"],
  ["src/components/calendar/confirm-dialog.tsx", "surface-float"],
  ["src/components/calendar/merge-form.tsx", "surface-float"],
  ["src/components/ui/toast.tsx", "surface-float"],
];

function source(file: string) {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Every class string of the file (plain or template). */
function classLists(code: string): string[] {
  return [...code.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

describe.each(SURFACES)("%s", (file, utility) => {
  const lists = classLists(source(file));
  const surface = lists.filter((list) =>
    new RegExp(`(^|\\s)${utility}(\\s|$)`).test(list),
  );

  it(`uses ${utility}`, () => {
    expect(surface.length).toBeGreaterThan(0);
  });

  it("drops the opaque background and the loose shadow on that surface", () => {
    for (const list of surface) {
      expect(list).not.toMatch(
        /(^|\s)(bg-paper|bg-stone|bg-ink|shadow-\w+)(\s|$)/,
      );
    }
  });
});
