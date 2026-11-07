import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureReturn,
  markPulse,
  takeMark,
  visibleBlock,
} from "@/lib/motion/marks";

// Spec 021, T12: what a block does on its next paint (plan motion-marks, D13).
function block(id: string, box: Partial<DOMRect>, visible = true) {
  const el = document.createElement("a");
  el.dataset.eventId = id;
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 10, height: 10, ...box }) as DOMRect;
  (el as unknown as { checkVisibility: () => boolean }).checkVisibility = () =>
    visible;
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  takeMark("a");
  takeMark("b");
});

describe("motion marks", () => {
  it("hands a pulse mark once", () => {
    markPulse("a");
    expect(takeMark("a")).toEqual({ kind: "pulse" });
    expect(takeMark("a")).toBeNull();
  });

  it("measures the visible block before it goes back", () => {
    block("a", { left: 500 }, false);
    block("a", { left: 40, top: 60, width: 100, height: 30 });
    captureReturn("a");
    expect(takeMark("a")).toEqual({
      kind: "return",
      from: { left: 40, top: 60, width: 100, height: 30 },
    });
  });

  it("marks nothing when the block is not on screen", () => {
    captureReturn("b");
    expect(takeMark("b")).toBeNull();
  });

  it("forgets a mark after 2 s", () => {
    vi.useFakeTimers();
    markPulse("a");
    vi.advanceTimersByTime(2001);
    expect(takeMark("a")).toBeNull();
  });

  it("keeps the last mark of an id", () => {
    block("a", { left: 1 });
    captureReturn("a");
    markPulse("a");
    expect(takeMark("a")).toEqual({ kind: "pulse" });
  });

  it("finds the visible copy of a block", () => {
    block("b", {}, false);
    const shown = block("b", { left: 7 });
    expect(visibleBlock("b")).toBe(shown);
  });
});
