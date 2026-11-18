import { describe, expect, it } from "vitest";
import { parseEventText } from "@/lib/nl/parse";
import { NL_CASES, TODAY } from "./nl-cases";

// Spec 041 T3: the whole parser over the battery of nl-cases.ts.
describe("parseEventText", () => {
  it.each(NL_CASES)("%s", (text, expected) => {
    expect(parseEventText(text, TODAY)).toMatchObject(expected);
  });

  it("has more than 150 phrases (RNF-2)", () => {
    expect(NL_CASES.length).toBeGreaterThan(150);
  });

  it("parses a phrase in less than 1 ms (RNF-1)", () => {
    for (const [text] of NL_CASES) parseEventText(text, TODAY);
    const started = performance.now();
    const rounds = 5;
    for (let i = 0; i < rounds; i += 1) {
      for (const [text] of NL_CASES) parseEventText(text, TODAY);
    }
    const each = (performance.now() - started) / (rounds * NL_CASES.length);
    expect(each).toBeLessThan(1);
  });

  it("gives the spans in the order of the text", () => {
    const { spans } = parseEventText(
      "Cena el viernes a las 21 en casa @familia",
      TODAY,
    );
    expect(spans.map((s) => s.kind)).toEqual([
      "date",
      "time",
      "location",
      "calendar",
    ]);
    expect(spans[2]).toEqual({ start: 25, end: 32, kind: "location" });
  });
});
