import { describe, expect, it } from "vitest";
import { matchesAll, normalize, queryTerms } from "@/lib/search/normalize";

// Spec 039, T1: the same criterion as search_text in SQL (RF-3).
describe("normalize", () => {
  it("drops accents and case, keeps ñ and collapses spaces", () => {
    expect(normalize("  Médico   ÁLVARO ")).toBe("medico alvaro");
    expect(normalize("Año NUEVO en Pingüino")).toBe("año nuevo en pinguino");
    expect(normalize("ÑANDÚ")).toBe("ñandu");
  });
});

describe("queryTerms and matchesAll", () => {
  it("splits the query into normalized words", () => {
    expect(queryTerms(" Cena  con ÁNA ")).toEqual(["cena", "con", "ana"]);
  });

  it("needs every word, as prefix or part (D1)", () => {
    const terms = queryTerms("denti ana");
    expect(matchesAll("Dentista con Ana", terms)).toBe(true);
    expect(matchesAll("Dentista", terms)).toBe(false);
    expect(matchesAll("Médico", queryTerms("medico"))).toBe(true);
  });
});
