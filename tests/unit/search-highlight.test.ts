import { describe, expect, it } from "vitest";
import { excerpt, highlight } from "@/lib/search/highlight";

// Spec 039, T1: the matched words of a comment, marked (RF-7).
describe("highlight", () => {
  it("marks every word, ignoring accents and case, on the original text", () => {
    expect(highlight("Llevo el pastel al Médico", "medico pastel")).toEqual([
      { text: "Llevo el ", mark: false },
      { text: "pastel", mark: true },
      { text: " al ", mark: false },
      { text: "Médico", mark: true },
    ]);
  });

  it("returns the text unmarked when nothing matches", () => {
    expect(highlight("Hola", "adiós")).toEqual([{ text: "Hola", mark: false }]);
  });
});

describe("excerpt", () => {
  it("cuts around the first match with ellipses", () => {
    const text = `${"a".repeat(80)} dentista ${"b".repeat(80)}`;
    const cut = excerpt(text, "denti", 20);
    expect(cut.startsWith("…")).toBe(true);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).toContain("dentista");
  });

  it("keeps short texts whole", () => {
    expect(excerpt("Nos vemos en el dentista", "denti")).toBe(
      "Nos vemos en el dentista",
    );
  });
});
