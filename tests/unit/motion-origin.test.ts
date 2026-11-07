import { describe, expect, it } from "vitest";
import { originFrom } from "@/lib/motion/origin";

// Spec 021, T2: a popover grows from its trigger (RF-8, RF-10, plan D4).
const panel = { left: 100, top: 200, width: 300, height: 200 };
const parse = (origin: string) => origin.split(" ").map((v) => parseFloat(v));

describe("originFrom", () => {
  it("uses the top edge for a trigger above the panel", () => {
    const trigger = { left: 140, top: 160, width: 40, height: 30 };
    expect(originFrom(trigger, panel)).toBe("60px 0px");
  });

  it("uses the bottom edge for a trigger below the panel", () => {
    const trigger = { left: 350, top: 420, width: 20, height: 20 };
    expect(originFrom(trigger, panel)).toBe("260px 200px");
  });

  it("uses the side for a trigger beside the panel", () => {
    const trigger = { left: 40, top: 290, width: 40, height: 20 };
    expect(originFrom(trigger, panel)).toBe("0px 100px");
  });

  it("uses the trigger's own centre when it is inside the panel", () => {
    const trigger = { left: 200, top: 250, width: 20, height: 20 };
    expect(originFrom(trigger, panel)).toBe("110px 60px");
  });

  it("takes a point such as the pointer", () => {
    expect(originFrom({ x: 120, y: 190 }, panel)).toBe("20px 0px");
  });

  it("always falls inside the panel", () => {
    for (const trigger of [
      { x: -500, y: -500 },
      { x: 5000, y: 5000 },
      { x: 250, y: 5000 },
    ]) {
      const [x, y] = parse(originFrom(trigger, panel));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(panel.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(panel.height);
    }
  });
});
