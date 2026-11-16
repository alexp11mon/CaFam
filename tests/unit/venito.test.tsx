import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Venito, type VenitoMood } from "@/components/brand/venito";
import { VENITO } from "@/lib/theme/accents";

// Spec 027, T1: the mascot (RF-1); a walrus since spec 031.
const MOODS: VenitoMood[] = [
  "idle",
  "wave",
  "thinking",
  "happy",
  "confused",
  "sleeping",
];
const css = readFileSync("src/app/globals.css", "utf8");

describe("Venito", () => {
  it.each(MOODS)("draws itself %s, each one different", (mood) => {
    const { container } = render(<Venito mood={mood} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-venito", mood);
    const others = MOODS.filter((other) => other !== mood).map(
      (other) => render(<Venito mood={other} />).container.innerHTML,
    );
    expect(others).not.toContain(container.innerHTML);
  });

  it("is decoration unless it is given a name", () => {
    const { container } = render(<Venito />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    render(<Venito title="Venito, tu asistente" />);
    expect(
      screen.getByRole("img", { name: "Venito, tu asistente" }),
    ).not.toHaveAttribute("aria-hidden");
  });

  it("is a walrus with glasses, tusks and whiskers, without a collar (spec 031 RF-1)", () => {
    const { container } = render(<Venito />);
    for (const part of ["glasses", "tusks", "whiskers", "flipper", "eyes"]) {
      expect(container.querySelector(`[data-part="${part}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-part="collar"]')).toBeNull();
  });

  it("drops the whiskers and draws thicker when compact (spec 031 RF-4)", () => {
    const big = render(<Venito />).container;
    const { container } = render(<Venito compact />);
    expect(container.querySelector('[data-part="whiskers"]')).toBeNull();
    const width = (root: Element) =>
      Number(
        root.querySelector('[data-part="body"]')!.getAttribute("stroke-width"),
      );
    expect(width(container)).toBeGreaterThan(width(big));
  });

  it("is drawn with its own tokens, never a loose color nor the accent", () => {
    const { container } = render(<Venito mood="happy" />);
    const html = container.innerHTML;
    expect(html).toMatch(/stroke-walrus-line\b/);
    expect(html).toMatch(/fill-walrus-body\b/);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(html).not.toMatch(/accent|seal/);
  });

  it.each(["light", "dark"] as const)(
    "has its colors in the %s theme, as in accents.ts",
    (theme) => {
      const values = VENITO[theme];
      const start =
        theme === "light"
          ? css.indexOf(":root {")
          : css.indexOf('[data-theme="dark"] {');
      const block = css.slice(start, css.indexOf("}", start));
      expect(block).toContain(`--walrus-line: ${values.line.toLowerCase()};`);
      expect(block).toContain(`--walrus-body: ${values.body.toLowerCase()};`);
      expect(block).not.toContain("--seal");
    },
  );

  it("only moves transform and opacity, and stays still with reduced motion", () => {
    const frames = [
      ...css.matchAll(/@keyframes venito-[a-z]+ \{[\s\S]*?\n\}/g),
    ];
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (const [frame] of frames) {
      const properties = [...frame.matchAll(/^\s+([a-z-]+):/gm)].map(
        (m) => m[1],
      );
      expect(
        properties.every((p) => p === "transform" || p === "opacity"),
      ).toBe(true);
    }
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-venito\] \[data-part\][\s\S]*?animation: none/,
    );
  });
});
