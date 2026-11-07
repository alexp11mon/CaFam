// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 021, T4: the motion utilities and the dialog entrances of globals.css
// (RF-6, RF-7, RF-11, RF-12, RF-13, RF-16, RF-17, RF-19, plan "motion-utilities").
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** The text of `@utility name { … }`, braces balanced. */
function utility(name: string): string {
  const start = css.indexOf(`@utility ${name} {`);
  expect(start, `@utility ${name}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unclosed ${name}`);
}

describe("motion utilities", () => {
  it.each(["pop", "stagger", "settle", "press-quiet", "swap", "reveal-down"])(
    "defines %s",
    (name) => {
      expect(utility(name)).toBeTruthy();
    },
  );

  it("grows popovers from their origin at 95 % and shrinks them back", () => {
    const pop = utility("pop");
    expect(pop).toMatch(/transform-origin: var\(--pop-origin/);
    expect(pop).toMatch(/scale: var\(--pop-scale\)/);
    expect(pop).toMatch(/--motion-pop-in/);
    expect(pop).toMatch(/&\[data-leaving\]/);
    expect(pop).toMatch(/--motion-pop-out/);
    expect(pop).toMatch(/@starting-style/);
  });

  it("staggers rows 2 to 8 only while the list enters", () => {
    const stagger = utility("stagger");
    for (let n = 2; n <= 8; n++) {
      expect(stagger).toContain(
        `&[data-entering] > :nth-child(${n}) {\n    animation-delay: calc(var(--stagger-step) * ${n - 1});`,
      );
    }
    expect(stagger).toContain(
      "&[data-entering] > :nth-child(n + 9) {\n    animation-delay: calc(var(--stagger-step) * 7);",
    );
    expect(stagger).not.toMatch(/^\s*& > \*\s*\{[^}]*animation:/m);
  });

  it("settles a detail 50 ms later", () => {
    expect(utility("settle")).toMatch(/var\(--settle-delay\)/);
  });

  it("presses without lifting", () => {
    const quiet = utility("press-quiet");
    expect(quiet).toMatch(/scale: var\(--press-scale\)/);
    expect(quiet).not.toMatch(/press-lift|:hover/);
  });

  it("scales centred dialogs from 95 % and leaves faster", () => {
    expect(css).toMatch(
      /dialog \{\n\s+opacity: 0;\n\s+scale: var\(--pop-scale\);/,
    );
    expect(css).toMatch(
      /dialog\[open\] \{[^}]*transition-duration: var\(--motion-dialog-in\)/,
    );
    expect(css).toMatch(/dialog \{[^}]*var\(--motion-dialog-out\)/);
  });

  it("brings sheets from the bottom and the drawer from the left", () => {
    expect(css).toMatch(/dialog\[data-sheet\] \{[^}]*translate: 0 100%/);
    expect(css).toMatch(/dialog\[data-phone-sheet\] \{[^}]*translate: 0 100%/);
    expect(css).toMatch(/dialog\[data-drawer\] \{[^}]*translate: -100% 0/);
  });

  it("leaves morphing surfaces to their script", () => {
    expect(css).toMatch(/\[data-morph\] \{[^}]*transition: none/);
  });
});
