import { describe, expect, it } from "vitest";
import { readDates } from "@/lib/nl/dates";
import { normalizeText, Scan } from "@/lib/nl/tokenize";

// Spec 041 T1. Today is Wednesday 18 November 2026.
const TODAY = "2026-11-18";

function read(text: string) {
  const scan = new Scan(text);
  return { ...readDates(scan, TODAY), spans: scan.spans, scan };
}

const CASES: [string, string | null, string | null][] = [
  // Relative (RF-1).
  ["Cena hoy", "2026-11-18", null],
  ["Cena mañana", "2026-11-19", null],
  ["Cena MAÑANA", "2026-11-19", null],
  ["Cena manana", "2026-11-19", null],
  ["Cena pasado mañana", "2026-11-20", null],
  ["Cena esta noche", "2026-11-18", null],
  ["Paseo esta tarde", "2026-11-18", null],
  ["Excursión este fin de semana", "2026-11-21", null],
  ["Excursión el finde", "2026-11-21", null],
  ["Revisión dentro de 3 días", "2026-11-21", null],
  ["Revisión dentro de tres días", "2026-11-21", null],
  ["Revisión en dos días", "2026-11-20", null],
  ["Revisión en 2 semanas", "2026-12-02", null],
  ["Revisión dentro de una semana", "2026-11-25", null],
  ["Revisión dentro de un mes", "2026-12-18", null],
  ["Revisión en 3 meses", "2027-02-18", null],
  // Weekdays (RF-2).
  ["Pádel el jueves", "2026-11-19", null],
  ["Pádel jueves", "2026-11-19", null],
  ["Pádel el viernes", "2026-11-20", null],
  ["Pádel el sábado", "2026-11-21", null],
  ["Pádel el sabado", "2026-11-21", null],
  ["Pádel el domingo", "2026-11-22", null],
  ["Pádel el lunes", "2026-11-23", null],
  ["Pádel el martes", "2026-11-24", null],
  ["Pádel el miércoles", "2026-11-25", null],
  ["Pádel el MIÉRCOLES", "2026-11-25", null],
  ["Pádel el próximo lunes", "2026-11-23", null],
  ["Pádel el lunes que viene", "2026-11-23", null],
  ["Pádel este viernes", "2026-11-20", null],
  ["Pádel jue", "2026-11-19", null],
  ["Pádel vie", "2026-11-20", null],
  // Dates (RF-3, RF-15).
  ["Dentista el 20", "2026-11-20", null],
  ["Dentista el 18", "2026-11-18", null],
  ["Dentista el 10", "2026-12-10", null],
  ["Dentista el día 31", "2026-12-31", null],
  ["Dentista 20 de noviembre", "2026-11-20", null],
  ["Dentista el 17 de noviembre", "2027-11-17", null],
  ["Dentista 3 de enero", "2027-01-03", null],
  ["Dentista el 3 de enero de 2027", "2027-01-03", null],
  ["Dentista 20 nov", "2026-11-20", null],
  ["Dentista 25 dic.", "2026-12-25", null],
  ["Dentista 20/11", "2026-11-20", null],
  ["Dentista el 1/2", "2027-02-01", null],
  ["Dentista 20-11-2027", "2027-11-20", null],
  ["Dentista 5/12/26", "2026-12-05", null],
  ["Dentista 29 de febrero", "2028-02-29", null],
  ["Dentista el viernes 27 de noviembre", "2026-11-27", null],
  ["Dentista el sábado 21", "2026-11-21", null],
  ["Dentista 1 de setiembre", "2027-09-01", null],
  // Ranges (RF-6).
  ["Viaje del 3 al 5 de diciembre", "2026-12-03", "2026-12-05"],
  ["Viaje del 28/12 al 2/1", "2026-12-28", "2027-01-02"],
  ["Viaje del 20 de noviembre al 2 de diciembre", "2026-11-20", "2026-12-02"],
  ["Viaje del viernes al domingo", "2026-11-20", "2026-11-22"],
  // Nothing.
  ["Llamar a mamá", null, null],
  ["Desayuno por la mañana", null, null],
  ["Reunión 10-12", null, null],
  ["Dentista 31/11", null, null],
];

describe("readDates", () => {
  it.each(CASES)("%s", (text, date, endDate) => {
    const result = read(text);
    expect(result.date).toBe(date);
    expect(result.endDate).toBe(endDate);
  });

  it("has at least 50 phrases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("marks yesterday as past", () => {
    const result = read("Cena ayer");
    expect(result.date).toBe("2026-11-17");
    expect(result.past).toBe(true);
  });

  it("keeps the part of the day of esta noche", () => {
    expect(read("Cena esta noche").partOfDay).toBe("night");
    expect(read("Cena esta mañana").partOfDay).toBe("morning");
  });

  it("takes the date and leaves the rest of the text", () => {
    const { scan, spans } = read("Pádel el viernes con Luis");
    expect(spans).toEqual([{ start: 6, end: 16, kind: "date" }]);
    const rest = scan
      .runs()
      .map(({ start, end }) => scan.original.slice(start, end))
      .join("|");
    expect(rest).toBe("Pádel | con Luis");
  });

  it("reads tomorrow before por la mañana", () => {
    const { date, spans } = read("Médico mañana por la mañana");
    expect(date).toBe("2026-11-19");
    expect(spans[0]).toEqual({ start: 7, end: 13, kind: "date" });
  });
});

describe("normalizeText", () => {
  it("drops accents and case but keeps ñ and the length", () => {
    expect(normalizeText("Mañana MIÉRCOLES Ñu")).toBe("mañana miercoles ñu");
    expect(normalizeText("Pádel 🎾 ok").length).toBe("Pádel 🎾 ok".length);
  });
});
