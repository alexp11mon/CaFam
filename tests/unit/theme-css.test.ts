// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  BACKDROP,
  DARK_NEUTRALS,
  GLASS,
  NEUTRALS,
  THEME_INKS,
} from "@/lib/theme/accents";

// Spec 011, T4: globals.css holds both themes, the glass, the backdrop and the
// motion, with the values of accents.ts (RF-5, RF-9, RF-13, RF-14, RF-20,
// RF-22..RF-25; plan tokens-css, D2, D6, D10).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

function value(source: string, name: string): string | undefined {
  return source
    .match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6,8})\\b`))?.[1]
    ?.toUpperCase();
}

function alphaHex(alpha: number): string {
  return Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

const LIGHT = ":root";
const DARK = '[data-theme="dark"]';
const SYSTEM_DARK = ':root:not([data-theme="light"])';

const THEMES = [
  { name: "light", selectors: [LIGHT], neutrals: NEUTRALS, key: "light" },
  {
    name: "dark",
    selectors: [DARK, SYSTEM_DARK],
    neutrals: DARK_NEUTRALS,
    key: "dark",
  },
] as const;

describe.each(THEMES)("the $name theme in globals.css", (theme) => {
  it.each(theme.selectors)(
    "%s has the neutrals, inks, glass and backdrop",
    (selector) => {
      const rules = block(selector);
      for (const [name, hex] of Object.entries(theme.neutrals)) {
        expect(value(rules, name), name).toBe(hex.toUpperCase());
      }
      const inks = THEME_INKS[theme.key];
      expect(value(rules, "on-ink")).toBe(inks.onInk.toUpperCase());
      expect(value(rules, "pastel-ink")).toBe(inks.pastelInk.toUpperCase());
      expect(value(rules, "mark")).toBe(inks.mark.toUpperCase());
      expect(value(rules, "on-mark")).toBe(inks.onMark.toUpperCase());
      const glass = GLASS[theme.key];
      expect(value(rules, "glass-bg")).toBe(
        `${glass.bg.toUpperCase()}${alphaHex(glass.alpha)}`,
      );
      for (const stop of BACKDROP[theme.key]) {
        expect(rules.toUpperCase()).toContain(stop.toUpperCase());
      }
    },
  );
});

describe("accents in globals.css (RF-9)", () => {
  it.each(ACCENTS)("$id has its fill and both theme inks", (accent) => {
    const rules = block(`[data-accent="${accent.id}"]`);
    expect(value(rules, "accent")).toBe(accent.fill);
    expect(value(rules, "on-accent")).toBe(accent.onFill);
    expect(value(rules, "accent-ink-light")).toBe(accent.ink);
    expect(value(rules, "accent-edge-light")).toBe(accent.edge);
    expect(value(rules, "accent-ink-dark")).toBe(accent.dark.ink);
    expect(value(rules, "accent-edge-dark")).toBe(accent.dark.edge);
  });

  it("paints red on :root, for pages without a session (spec 005 RF-11)", () => {
    expect(css).toMatch(/:root,\s*\[data-accent="red"\]\s*\{/);
  });

  it("each theme picks the ink of the accent of its frame", () => {
    expect(css).toMatch(
      /:root,\s*\[data-accent\]\s*\{[^}]*--accent-ink:\s*var\(--accent-ink-light\)/,
    );
    expect(css).toMatch(
      /\[data-theme="dark"\],\s*\[data-theme="dark"\] \[data-accent\]\s*\{[^}]*--accent-ink:\s*var\(--accent-ink-dark\)/,
    );
    expect(css).toMatch(
      /:root:not\(\[data-theme="light"\]\),\s*:root:not\(\[data-theme="light"\]\) \[data-accent\]\s*\{[^}]*--accent-ink:\s*var\(--accent-ink-dark\)/,
    );
  });
});

describe("theme mechanics (RF-5)", () => {
  it("follows the system inside prefers-color-scheme: dark", () => {
    const media = css.indexOf("@media (prefers-color-scheme: dark)");
    expect(media).toBeGreaterThanOrEqual(0);
    expect(css.indexOf(SYSTEM_DARK, media)).toBeGreaterThan(media);
  });

  it("tells native controls which scheme to draw", () => {
    expect(block(LIGHT)).toMatch(/color-scheme:\s*light/);
    expect(block(DARK)).toMatch(/color-scheme:\s*dark/);
  });
});

describe("glass, backdrop and motion utilities", () => {
  it.each(["glass", "glass-float", "press", "bg-backdrop"])(
    "defines @utility %s",
    (name) => {
      expect(css).toContain(`@utility ${name} {`);
    },
  );

  it("falls back to an opaque surface without backdrop-filter (RF-14)", () => {
    expect(css).toMatch(/@supports not \(\s*\(backdrop-filter: blur\(1px\)\)/);
  });

  it("paints the backdrop behind every page (RF-13)", () => {
    expect(css).toMatch(/body\s*\{[^}]*background-image:\s*var\(--backdrop\)/);
  });

  it("never animates for longer than 400 ms (RF-22)", () => {
    const durations = [...css.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
    expect(durations.length).toBeGreaterThan(0);
    expect(Math.max(...durations)).toBeLessThanOrEqual(400);
  });

  it("drops movement with prefers-reduced-motion (RF-23)", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(css.slice(start)).toMatch(/--motion-distance:\s*0/);
  });

  it("keeps the page clickable during a view transition (RF-25)", () => {
    expect(block("::view-transition")).toMatch(/pointer-events:\s*none/);
  });

  it.each(["cal-view", "cal-next", "cal-prev", "cal-filter"])(
    "animates the %s transition type (RF-17..RF-19)",
    (type) => {
      expect(css).toContain(`::view-transition-new(.${type})`);
    },
  );

  it("animates dialogs in and out (RF-20)", () => {
    expect(css).toMatch(/@starting-style\s*\{[^}]*dialog\[open\]/);
    expect(css).toMatch(/allow-discrete/);
  });
});
