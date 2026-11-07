// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 021, T1: the motion tokens of globals.css (RF-1..RF-5, RF-66, plan
// "Modelo de datos" and D5, D6).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** The custom properties of the first `:root {…}` after `marker`. */
function rootTokens(marker: string): Map<string, string> {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = css.indexOf(":root {", start);
  const close = css.indexOf("}", open);
  const block = css.slice(open, close);
  return new Map(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

function ms(value: string | undefined): number {
  expect(value).toBeDefined();
  const m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value!);
  expect(m, `${value} is a duration`).not.toBeNull();
  return Number(m![1]) * (m![2] === "s" ? 1000 : 1);
}

const root = rootTokens("/* Light theme");
const reduced = rootTokens("@media (prefers-reduced-motion: reduce)");
const PAIRS = ["pop", "dialog", "base", "fast"];

describe("motion tokens", () => {
  it("has one curve to enter and leave and one to move (RF-1, RF-2)", () => {
    expect(root.get("--ease-out")).toMatch(/^cubic-bezier\(/);
    expect(root.get("--ease-in-out")).toMatch(/^cubic-bezier\(/);
    expect(root.has("--motion-ease")).toBe(false);
  });

  it.each(PAIRS)("%s leaves in 80 %% (±10 ms) of its entrance (RF-3)", (p) => {
    const enter = ms(root.get(`--motion-${p}-in`));
    const leave = ms(root.get(`--motion-${p}-out`));
    expect(Math.abs(leave - enter * 0.8)).toBeLessThanOrEqual(10);
  });

  it("keeps every duration within 400 ms (RF-5)", () => {
    const durations = [...root].filter(([, v]) => /^\d+(\.\d+)?m?s$/.test(v));
    expect(durations.length).toBeGreaterThan(8);
    for (const [name, value] of durations) {
      expect(ms(value), name).toBeLessThanOrEqual(400);
    }
  });

  it("lets the eighth row land within 400 ms (RF-16, RF-17)", () => {
    const step = ms(root.get("--stagger-step"));
    expect(7 * step + ms(root.get("--motion-row"))).toBeLessThanOrEqual(400);
  });

  it("drops scale, delays, blur and arcs with reduced motion (RF-66)", () => {
    for (const name of [
      "--pop-scale",
      "--pulse-scale",
      "--knob-stretch",
      "--swap-scale",
    ]) {
      expect(reduced.get(name), name).toBe("1");
    }
    for (const name of [
      "--stagger-step",
      "--settle-delay",
      "--swap-blur",
      "--arc-max",
    ]) {
      expect(reduced.get(name), name).toMatch(/^0(ms|px)?$/);
    }
    for (const [name, value] of reduced) {
      if (/^\d+(\.\d+)?m?s$/.test(value) && name.startsWith("--motion-")) {
        expect(ms(value), name).toBeLessThanOrEqual(150);
      }
    }
  });
});
