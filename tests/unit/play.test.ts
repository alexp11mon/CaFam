import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { play, pulse } from "@/lib/motion/play";

// Spec 021, T3: interruptible animations with the Web Animations API
// (RF-47, RF-49, RF-63, RF-64, RF-66, plan D15).
type FakeAnimation = {
  commitStyles: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  onfinish: (() => void) | null;
};

let animations: FakeAnimation[] = [];
let reduced = false;

function animatable(): HTMLElement {
  const el = document.createElement("div");
  el.animate = vi.fn(() => {
    const animation: FakeAnimation = {
      commitStyles: vi.fn(),
      cancel: vi.fn(),
      onfinish: null,
    };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  return el;
}

beforeEach(() => {
  animations = [];
  reduced = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") && reduced,
    })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("play", () => {
  it("commits and cancels the running animation before the next", () => {
    const el = animatable();
    play(el, [{ translate: "10px 0" }, { translate: "0px 0" }], {
      duration: 200,
    });
    play(el, [{ translate: "0px 0" }, { translate: "40px 0" }], {
      duration: 200,
    });

    expect(animations).toHaveLength(2);
    expect(animations[0].commitStyles).toHaveBeenCalled();
    expect(animations[0].cancel).toHaveBeenCalled();
    expect(animations[1].cancel).not.toHaveBeenCalled();
  });

  it("drops what the previous animation committed once it finishes", () => {
    const el = animatable();
    el.style.translate = "12px 0";
    play(el, [{ translate: "12px 0" }, { translate: "0px 0" }], {
      duration: 200,
    });
    animations[0].onfinish?.();

    expect(el.style.translate).toBe("");
  });

  it("keeps the last frame with fill forwards", () => {
    const el = animatable();
    play(el, [{ opacity: "1" }, { opacity: "0" }], {
      duration: 200,
      fill: "forwards",
    });
    animations[0].onfinish?.();

    expect(el.style.opacity).toBe("0");
  });

  it("applies the last frame at once without animate", () => {
    const el = document.createElement("div");
    const result = play(el, [{ opacity: "1" }, { opacity: "0" }], {
      duration: 200,
      fill: "forwards",
    });

    expect(result).toBeNull();
    expect(el.style.opacity).toBe("0");
  });

  it("does not animate with reduced motion", () => {
    reduced = true;
    const el = animatable();
    const result = play(el, [{ opacity: "1" }, { opacity: "0" }], {
      duration: 200,
    });

    expect(result).toBeNull();
    expect(el.animate).not.toHaveBeenCalled();
  });
});

describe("pulse", () => {
  it("scales once and back", () => {
    const el = animatable();
    pulse(el);

    expect(el.animate).toHaveBeenCalledTimes(1);
    const [frames] = vi.mocked(el.animate).mock.calls[0] as [Keyframe[]];
    expect(frames[0].scale).toBe("1");
    expect(frames.at(-1)!.scale).toBe("1");
    expect(Number(frames[1].scale)).toBeGreaterThan(1);
    expect(Number(frames[1].scale)).toBeLessThanOrEqual(1.04);
  });

  it("does nothing with reduced motion or without an element", () => {
    reduced = true;
    const el = animatable();
    pulse(el);
    pulse(null);

    expect(el.animate).not.toHaveBeenCalled();
  });
});
