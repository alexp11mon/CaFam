// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 021, T4: everything pressable sinks a little (RF-13..RF-15). Read from
// the sources, like the design guard: each of these renders its rows with
// press-quiet, and an event block, which moves, never presses.
const read = (file: string) =>
  readFileSync(join(process.cwd(), "src/components", file), "utf8");

describe("press coverage", () => {
  it.each([
    ["calendar/event-menu.tsx", /const ITEM =\s*"press-quiet /],
    ["shell/more-sheet.tsx", /const ROW =\s*"press-quiet /],
    ["shell/nav-drawer.tsx", /const ROW =\s*"press-quiet /],
    ["ui/time-field.tsx", /role="option"[\s\S]*?className=\{`press-quiet /],
    [
      "calendar/mini-month.tsx",
      /aria-current=\{isToday[^}]*\}\s*className=\{`press-quiet /,
    ],
    ["calendar/month-strip.tsx", /press-quiet/],
    ["calendar/calendar-filters.tsx", /<label className="press-quiet /],
  ])("%s rows use press-quiet", (file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });

  it("an event block has no press feedback", () => {
    expect(read("calendar/event-block.tsx")).not.toMatch(/\bpress(-quiet)?\b/);
  });
});
