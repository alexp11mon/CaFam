import { describe, expect, it } from "vitest";
import { parseEventText } from "@/lib/nl/parse";
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

describe("resolveParsed", () => {
  it("fills the form with the time and the default length", () => {
    expect(resolve("Cena con Ana el viernes a las 21 en casa @fam")).toEqual({
      title: "Cena con Ana",
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      startTime: "21:00",
      endTime: "22:00",
      allDay: false,
      location: "casa",
      calendarId: "fam",
      calendarName: "Familia",
      repeat: null,
      warnings: [],
    });
  });

  it("uses the length of Ajustes and the one said", () => {
    expect(resolve("Pádel a las 19", { defaultMinutes: 90 }).endTime).toBe(
      "20:30",
    );
    expect(resolve("Pádel a las 19 durante 2 horas").endTime).toBe("21:00");
  });

  it("keeps the slot of the form when no date or time is said", () => {
    const event = resolve("Llamar a mamá", {
      fallback: { date: "2026-11-25", startTime: "16:30" },
    });
    expect(event).toMatchObject({
      startDate: "2026-11-25",
      startTime: "16:30",
      endTime: "17:30",
      allDay: false,
    });
  });

  it("counts back from the end with hasta", () => {
    expect(resolve("Trabajo hasta las 14")).toMatchObject({
      startTime: "13:00",
      endTime: "14:00",
    });
  });

  it("ends on the next day past midnight", () => {
    expect(resolve("Fiesta el sábado de 22 a 2 de la madrugada")).toMatchObject(
      {
        startDate: "2026-11-21",
        endDate: "2026-11-22",
        startTime: "22:00",
        endTime: "02:00",
      },
    );
    expect(resolve("Cena a las 23:30 2 horas").endTime).toBe("23:59");
  });

  it("is all day for a date alone or a range", () => {
    expect(resolve("Boda el sábado")).toMatchObject({
      allDay: true,
      startDate: "2026-11-21",
      endDate: "2026-11-21",
    });
    expect(resolve("Viaje del 3 al 5 de diciembre")).toMatchObject({
      allDay: true,
      startDate: "2026-12-03",
      endDate: "2026-12-05",
    });
  });

  it("warns about the afternoon, the past and the calendar", () => {
    expect(resolve("Médico a las 5").warnings).toEqual([
      "Se entiende por la tarde: 17:00.",
    ]);
    expect(resolve("Cena ayer").warnings).toEqual(["La fecha ya ha pasado."]);
    expect(resolve("Café @trab").warnings).toEqual([
      "Hay varios calendarios «trab»: Trabajo, Trabajo Ana.",
    ]);
    expect(resolve("Clase @uni")).toMatchObject({
      calendarId: null,
      warnings: ["En «Universidad» no puedes crear eventos."],
    });
    expect(resolve("Clase @gimnasio").warnings).toEqual([
      "No hay ningún calendario «gimnasio».",
    ]);
  });

  it("finds the calendar without accents or case", () => {
    expect(resolve("Café @FAMILIA").calendarId).toBe("fam");
    expect(resolve("Café @tráb", {}).calendarId).toBe(null);
  });

  it("moves a time the clocks skip (DST)", () => {
    const skipped = resolve("Vuelo el 29 de marzo a las 2:30 de la madrugada");
    expect(skipped.startDate).toBe("2027-03-29");
    // 29 March 2027 is not the change (28 March 2027 is): no warning.
    expect(skipped.warnings).toEqual([]);
    const change = resolve(
      "Vuelo el 28 de marzo de 2027 a las 2:30 de la madrugada",
    );
    expect(change.startTime).toBe("03:30");
    expect(change.warnings[0]).toMatch(/cambio de hora/);
  });

  it("keeps a time that happens twice when the clocks go back", () => {
    const event = resolve(
      "Guardia el 31 de octubre de 2027 a las 2:30 de la madrugada",
    );
    expect(event).toMatchObject({ startTime: "02:30", endTime: "03:30" });
    expect(event.warnings).toEqual([]);
  });

  it("proposes the repetition", () => {
    expect(resolve("Inglés cada lunes a las 18")).toMatchObject({
      repeat: "weekly",
      startDate: "2026-11-23",
    });
  });
});
