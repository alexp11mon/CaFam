import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 021, T14: the block grows into its detail and back (RF-55..RF-58,
// RF-61, plan motion-morph, D2, R3, R4).
const h = vi.hoisted(() => ({
  play: vi.fn(),
  release: vi.fn(),
  holdLive: vi.fn(),
}));
vi.mock("@/lib/motion/play", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/play")>()),
  play: h.play,
}));
vi.mock("@/lib/calendar/live-hold", () => ({ holdLive: h.holdLive }));

import {
  findVisibleBlock,
  morphIn,
  morphOut,
  setMorphOrigin,
  takeMorphOrigin,
} from "@/lib/motion/morph";

const BOX = { left: 40, top: 300, width: 120, height: 20 };

function block(
  id: string,
  box: { left: number; top: number; width?: number; height?: number },
  { visible = true, segment }: { visible?: boolean; segment?: string } = {},
) {
  const el = document.createElement("a");
  el.dataset.eventId = id;
  if (segment) el.dataset.segment = segment;
  el.getBoundingClientRect = () =>
    ({ width: 100, height: 20, ...box }) as DOMRect;
  (el as unknown as { checkVisibility: () => boolean }).checkVisibility = () =>
    visible;
  document.body.append(el);
  return el;
}

function surface() {
  const el = document.createElement("dialog");
  el.getBoundingClientRect = () =>
    ({ left: 200, top: 100, width: 360, height: 280 }) as DOMRect;
  document.body.append(el);
  return el;
}

let finish: () => void;
beforeEach(() => {
  h.play.mockReset();
  h.release.mockReset();
  h.holdLive.mockReset().mockReturnValue(h.release);
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  h.play.mockImplementation(() => ({ finished }));
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  takeMorphOrigin("a");
});

describe("morph origin", () => {
  it("hands the pressed block to its own event once", () => {
    setMorphOrigin({ eventId: "a", box: BOX, color: "#FFADAD" });
    expect(takeMorphOrigin("b")).toBeNull();
    setMorphOrigin({ eventId: "a", box: BOX, color: "#FFADAD" });
    expect(takeMorphOrigin("a")).toEqual({
      eventId: "a",
      box: BOX,
      color: "#FFADAD",
    });
    expect(takeMorphOrigin("a")).toBeNull();
  });

  it("forgets it after 1 s", () => {
    vi.useFakeTimers();
    setMorphOrigin({ eventId: "a", box: BOX, color: "#FFADAD" });
    vi.advanceTimersByTime(1001);
    expect(takeMorphOrigin("a")).toBeNull();
  });
});

describe("findVisibleBlock", () => {
  it("skips a hidden copy and one off screen (plan R4)", () => {
    block("a", { left: 10, top: 10 }, { visible: false });
    block("a", { left: 10, top: 5000 });
    const shown = block("a", { left: 10, top: 40 });
    expect(findVisibleBlock("a")).toBe(shown);
    expect(findVisibleBlock("b")).toBeNull();
  });

  it("picks the segment that opened it", () => {
    block("a", { left: 10, top: 40 }, { segment: "2026-11-02" });
    const second = block("a", { left: 10, top: 90 }, { segment: "2026-11-09" });
    expect(findVisibleBlock("a", "2026-11-09")).toBe(second);
  });
});

describe("morphIn and morphOut", () => {
  it("grows from the block with translate and a clip, never scale (RF-55, RF-56)", async () => {
    const card = surface();
    const done = morphIn(card, BOX, "#FFADAD");

    const [target, frames, options] = h.play.mock.calls[0]!;
    expect(target).toBe(card);
    // Nothing of it stays inline once whole (a kept route opens again).
    expect(options.fill).toBe("none");
    expect(frames[0].translate).toBe("-160px 200px");
    expect(frames[0].clipPath).toBe("inset(0px 240px 260px 0px round 8px)");
    expect(frames.at(-1)).toEqual({
      translate: "0px 0px",
      clipPath: "inset(0px 0px 0px 0px round 24px)",
    });
    expect(JSON.stringify(h.play.mock.calls)).not.toMatch(/scale/);
    expect(card).toHaveAttribute("data-morph");
    // Others' changes wait for it (RF-61).
    expect(h.holdLive).toHaveBeenCalledTimes(1);
    expect(h.release).not.toHaveBeenCalled();

    finish();
    await done;
    expect(h.release).toHaveBeenCalledTimes(1);
    expect(card).not.toHaveAttribute("data-morph");
  });

  it("shrinks back into the block's current box (RF-57)", async () => {
    const card = surface();
    const done = morphOut(card, BOX, "#FFADAD");
    const [, frames, options] = h.play.mock.calls[0]!;
    // Kept until the surface unmounts.
    expect(options.fill).toBe("forwards");
    expect(frames[0]).toEqual({
      translate: "0px 0px",
      clipPath: "inset(0px 0px 0px 0px round 24px)",
    });
    expect(frames.at(-1).translate).toBe("-160px 200px");
    finish();
    await done;
    expect(h.release).toHaveBeenCalledTimes(1);
  });

  it("ends at once without animations (jsdom, reduced motion)", async () => {
    h.play.mockReturnValue(null);
    await morphIn(surface(), BOX, "#FFADAD");
    expect(h.release).toHaveBeenCalledTimes(1);
  });
});
