// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 005, T11: the design guard. Every screen uses only the tokens of
// globals.css and none of the devices the constitution bans (P9; RF-1;
// plan design-guard, D16).
const ROOT = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

const SOURCES = files(ROOT).map((path) => ({
  file: relative(process.cwd(), path).replaceAll("\\", "/"),
  code: readFileSync(path, "utf8"),
}));

// Shadows only on what floats: dialogs, the "Más" sheet and the rail tooltips.
const FLOATING = new Set([
  "src/components/calendar/confirm-dialog.tsx",
  "src/components/calendar/event-modal.tsx",
  "src/components/calendar/merge-form.tsx",
  "src/components/shell/more-sheet.tsx",
  "src/components/shell/side-rail.tsx",
]);

const PALETTE =
  "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\\d{2,3}";

const RULES: { name: string; pattern: RegExp; allow?: Set<string> }[] = [
  {
    name: "the old brand tokens",
    pattern:
      /\b(?:bg|text|border|ring|outline|fill|stroke|accent|decoration)-brand(?:-soft)?\b/,
  },
  { name: "a loose hex color in a class", pattern: /-\[#[0-9a-fA-F]{3,8}\]/ },
  {
    name: "a Tailwind palette color",
    pattern: new RegExp(
      `\\b(?:bg|text|border|ring|outline|fill|stroke|accent|decoration|from|via|to)-${PALETTE}\\b`,
    ),
  },
  { name: "bg-white (paper is the light surface)", pattern: /\bbg-white\b/ },
  { name: "monospace", pattern: /\bfont-mono\b/ },
  { name: "a gradient", pattern: /\bbg-(?:linear|radial|conic|gradient)-/ },
  { name: "glass", pattern: /\bbackdrop-blur/ },
  {
    name: "a shadow at rest",
    pattern: /\bshadow(?:-[a-z0-9]+)?\b/,
    allow: FLOATING,
  },
  {
    name: "tracked uppercase labels",
    pattern: /\buppercase\b[^"]*\btracking-(?:wide|wider|widest)\b/,
  },
  { name: "an emoji", pattern: /\p{Extended_Pictographic}/u },
  // The old blue of spec 001 is gone everywhere (spec 005 RF-55..RF-58).
  { name: "the old blue #2563EB", pattern: /#2563eb/i },
];

describe("design guard (P9)", () => {
  it("scans the app sources", () => {
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  it.each(RULES)("no file uses $name", ({ pattern, allow }) => {
    const offenders = SOURCES.filter(
      ({ file, code }) =>
        !file.endsWith("globals.css") &&
        !allow?.has(file) &&
        pattern.test(code),
    ).map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("globals.css no longer defines the old brand tokens", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

    expect(css).not.toMatch(/--color-brand/);
    expect(css).not.toMatch(/#2563eb/i);
    // Only src/ is scanned, so examples in the docs never become CSS.
    expect(css).toMatch(/@import "tailwindcss" source\("\.\."\);/);
  });
});
