import { describe, expect, it } from "vitest";
import { moveDraft, resizeDraft } from "@/lib/calendar/draft-drag";

// Spec 019, T13: the provisional block on a phone (RF-36 to RF-38).
const TEN = { startMinute: 600, endMinute: 660 };

describe("moveDraft", () => {
  it("moves in quarters keeping the duration", () => {
    expect(moveDraft(TEN, 20)).toEqual({ startMinute: 615, endMinute: 675 });
    expect(moveDraft(TEN, -50)).toEqual({ startMinute: 555, endMinute: 615 });
  });

  it("stays inside the day", () => {
    expect(moveDraft(TEN, -900)).toEqual({ startMinute: 0, endMinute: 60 });
    expect(moveDraft(TEN, 900)).toEqual({ startMinute: 1365, endMinute: 1425 });
  });
});

describe("resizeDraft", () => {
  it("changes the end in quarters", () => {
    expect(resizeDraft(TEN, 712)).toEqual({ startMinute: 600, endMinute: 705 });
  });

  it("never under 15 minutes nor past 23:59 (RF-38)", () => {
    expect(resizeDraft(TEN, 590)).toEqual({ startMinute: 600, endMinute: 615 });
    expect(resizeDraft(TEN, 2000)).toEqual({
      startMinute: 600,
      endMinute: 1439,
    });
  });
});
