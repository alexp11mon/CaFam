import { describe, expect, it } from "vitest";
import { parseEventText } from "@/lib/nl/parse";
import { highlight, previewText } from "@/lib/nl/preview";
import { resolveParsed, type ResolveContext } from "@/lib/nl/resolve";

// Spec 041 T4. Today is Wednesday 18 November 2026 in Europe/Madrid.
const TODAY = "2026-11-18";
const CONTEXT: ResolveContext = {
  timeZone: "Europe/Madrid",
  defaultMinutes: 60,
  calendars: [
    { id: "fam", name: "Familia", writable: true, reason: null },
    { id: "tra", name: "Trabajo", writable: true, reason: null },
    { id: "tra2", name: "Trabajo Ana", writable: true, reason: null },
    { id: "uni", name: "Universidad", writable: false, reason: "viewer" },
  ],
  fallback: { date: "2026-11-18", startTime: "09:00" },
};

const resolve = (text: string, context: Partial<ResolveContext> = {}) =>
  resolveParsed(parseEventText(text, TODAY), { ...CONTEXT, ...context });

describe("previewText", () => {
  it("says what was understood", () => {
    expect(
      previewText(resolve("Dentista jueves 10:30 en Calle Mayor @familia")),
    ).toBe(
      "Dentista · Jueves, 19 de noviembre · 10:30–11:30 · Calle Mayor · @Familia",
    );
  });

  it("says all day, ranges, the next day and the repetition", () => {
    expect(previewText(resolve("Boda el sábado"))).toBe(
      "Boda · Sábado, 21 de noviembre · Todo el día",
    );
    expect(previewText(resolve("Viaje del 3 al 5 de diciembre"))).toBe(
      "Viaje · Jueves, 3 de diciembre – sábado, 5 de diciembre",
    );
    expect(previewText(resolve("Fiesta de 22 a 1"))).toBe(
      "Fiesta · Miércoles, 18 de noviembre · 22:00–01:00 (día siguiente)",
    );
    expect(previewText(resolve("Fiesta de 22 a 1 de la madrugada"))).toBe(
      "Fiesta · Miércoles, 18 de noviembre · 22:00–01:00 (día siguiente)",
    );
    expect(previewText(resolve("Gimnasio a diario a las 8"))).toBe(
      "Gimnasio · Miércoles, 18 de noviembre · 08:00–09:00 · Cada día",
    );
    expect(previewText(resolve("mañana"))).toMatch(/^Sin título · /);
  });
});

describe("highlight", () => {
  it("cuts the original text by the spans", () => {
    const text = "Cena el Viernes a las 21 en casa";
    const { spans } = parseEventText(text, TODAY);
    expect(highlight(text, spans)).toEqual([
      { text: "Cena ", kind: null },
      { text: "el Viernes", kind: "date" },
      { text: " ", kind: null },
      { text: "a las 21", kind: "time" },
      { text: " ", kind: null },
      { text: "en casa", kind: "location" },
    ]);
  });

  it("gives the text whole when nothing is recognized", () => {
    expect(highlight("Llamar a mamá", [])).toEqual([
      { text: "Llamar a mamá", kind: null },
    ]);
  });
});
