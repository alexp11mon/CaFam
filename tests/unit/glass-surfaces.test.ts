// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 011, T9: the containers of RF-12 are glass, and what floats takes the
// floating glass (RF-12, RF-13, RF-14; plan glass-surfaces, D6).
const SURFACES: [file: string, utility: "glass" | "glass-float"][] = [
  ["src/components/shell/side-rail.tsx", "glass"],
  ["src/components/shell/bottom-bar.tsx", "glass"],
  ["src/components/calendar/next-event-card.tsx", "glass"],
  ["src/components/calendar/mini-month.tsx", "glass"],
  ["src/components/calendar/calendar-filters.tsx", "glass"],
  ["src/app/dashboard/settings/page.tsx", "glass"],
  ["src/components/shell/more-sheet.tsx", "glass-float"],
  ["src/components/calendar/event-modal.tsx", "glass-float"],
  ["src/components/calendar/quick-create.tsx", "glass-float"],
  ["src/components/calendar/confirm-dialog.tsx", "glass-float"],
  ["src/components/calendar/merge-form.tsx", "glass-float"],
  ["src/components/ui/toast.tsx", "glass-float"],
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
  const glass = lists.filter((list) =>
    new RegExp(`(^|\\s)${utility}(\\s|$)`).test(list),
  );

  it(`uses ${utility}`, () => {
    expect(glass.length).toBeGreaterThan(0);
  });

  it("drops the opaque background and the loose shadow on that surface", () => {
    for (const list of glass) {
      expect(list).not.toMatch(
        /(^|\s)(bg-paper|bg-stone|bg-ink|shadow-\w+)(\s|$)/,
      );
    }
  });
});
