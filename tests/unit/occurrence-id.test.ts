import { describe, expect, it } from "vitest";
import { occurrenceId, parseEventId } from "@/lib/recurrence/occurrence-id";

const SERIES = "0b6f4c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

describe("occurrence ids (RF-9, RF-22)", () => {
  it("round-trips a series id and an original start", () => {
    const id = occurrenceId(SERIES, "2026-10-27T17:00:00.000Z");
    expect(id).toBe(`${SERIES}_20261027T170000Z`);
    expect(parseEventId(id)).toEqual({
      kind: "occurrence",
      seriesId: SERIES,
      originalStart: "2026-10-27T17:00:00.000Z",
    });
  });

  it("recognises a plain event id", () => {
    expect(parseEventId(SERIES)).toEqual({ kind: "event", id: SERIES });
  });

  it.each([
    "nope",
    `${SERIES}_2026`,
    `${SERIES}_20261327T170000Z`,
    `x${SERIES}_20261027T170000Z`,
  ])("rejects %s", (id) => {
    expect(parseEventId(id)).toBeNull();
  });
});
