import { describe, expect, it } from "vitest";
import { readDates } from "@/lib/nl/dates";
import { readTimes } from "@/lib/nl/times";
import { Scan } from "@/lib/nl/tokenize";

// Spec 041 T2. Dates are read first, as the parser does.
function read(text: string) {
  const scan = new Scan(text);
  readDates(scan, "2026-11-18");
  return readTimes(scan);
}

type Case = [string, string | null, string | null, number | null, boolean?];

const CASES: Case[] = [
  // Times (RF-4).
  ["Cena a las 21", "21:00", null, null],
  ["Cena 21:30", "21:30", null, null],
  ["Cena a las 21:30", "21:30", null, null],
  ["Cena 21.30", "21:30", null, null],
  ["Cena 21h", "21:00", null, null],
  ["Cena 21h30", "21:30", null, null],
  ["Cena a las 9 de la noche", "21:00", null, null],
  ["Cena 9 de la noche", "21:00", null, null],
  ["Fiesta a las 12 de la noche", "00:00", null, null],
  ["Vuelo a la 1 de la madrugada", "01:00", null, null],
  ["Café a las 9 y media", "09:30", null, null],
  ["Café 9 y media", "09:30", null, null],
  ["Café a las 10 y cuarto", "10:15", null, null],
  ["Café a las 10 menos cuarto", "09:45", null, null],
  ["Café a las 10 menos 10", "09:50", null, null],
  ["Café a las 10 y 20", "10:20", null, null],
  ["Comida a mediodía", "12:00", null, null],
  ["Comida al mediodía", "12:00", null, null],
  ["Fuegos a medianoche", "00:00", null, null],
  ["Correr por la mañana", "09:00", null, null],
  ["Siesta por la tarde", "17:00", null, null],
  ["Paseo por la noche", "21:00", null, null],
  ["Cine 9pm", "21:00", null, null],
  ["Cine 9 pm", "21:00", null, null],
  ["Desayuno 9 am", "09:00", null, null],
  ["Desayuno 9am", "09:00", null, null],
  ["Reunión 12pm", "12:00", null, null],
  ["Desayuno a las 8 de la mañana", "08:00", null, null],
  ["Merienda a las 6 de la tarde", "18:00", null, null],
  ["Clase a las 10", "10:00", null, null],
  ["Clase sobre las 11", "11:00", null, null],
  ["Tutoría el 20 a las 21", "21:00", null, null],
  // Afternoon by default (RF-15).
  ["Médico a las 5", "17:00", null, null, true],
  ["Médico a la 1", "13:00", null, null, true],
  ["Médico a las 7 y media", "19:30", null, null, true],
  ["Médico a las 5 de la mañana", "05:00", null, null],
  ["Médico a las 8", "08:00", null, null],
  // Ranges and ends (RF-5).
  ["Reunión de 10 a 12", "10:00", "12:00", null],
  ["Reunión 10-12", "10:00", "12:00", null],
  ["Reunión 10:00-11:30", "10:00", "11:30", null],
  ["Reunión 9:00 - 10:30", "09:00", "10:30", null],
  ["Reunión de 10:30 a 11", "10:30", "11:00", null],
  ["Reunión desde las 9 hasta las 11", "09:00", "11:00", null],
  ["Reunión de 9 a 11 de la noche", "21:00", "23:00", null],
  ["Reunión de 11 a 1", "11:00", "13:00", null, true],
  ["Reunión de 4 a 6", "16:00", "18:00", null, true],
  ["Reunión de 7 a 9", "07:00", "09:00", null],
  ["Reunión a las 12 hasta las 14", "12:00", "14:00", null],
  ["Trabajo hasta las 14", null, "14:00", null],
  // Durations (RF-5).
  ["Pádel a las 19 1h", "19:00", null, 60],
  ["Pádel 1 h 30", null, null, 90],
  ["Pádel 1h30", null, null, 90],
  ["Pádel 90 min", null, null, 90],
  ["Pádel 45 minutos", null, null, 45],
  ["Pádel media hora", null, null, 30],
  ["Pádel 2 horas", null, null, 120],
  ["Pádel una hora y media", null, null, 90],
  ["Pádel durante 2 horas y 15 minutos", null, null, 135],
  ["Pádel a las 10 durante tres horas", "10:00", null, 180],
  ["Pádel quince minutos", null, null, 15],
  // Nothing.
  ["Pádel con 4 amigos", null, null, null],
  ["Llamar a mamá", null, null, null],
  ["Cena a las 25", null, null, null],
  ["Cena 21:75", null, null, null],
];

describe("readTimes", () => {
  it.each(CASES)("%s", (text, start, end, duration, assumed = false) => {
    expect(read(text)).toEqual({
      start,
      end,
      durationMinutes: duration,
      assumedAfternoon: assumed,
    });
  });

  it("has at least 50 phrases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("marks the time as a span", () => {
    const scan = new Scan("Cena a las 21 con Ana");
    readTimes(scan);
    expect(scan.spans).toEqual([{ start: 5, end: 13, kind: "time" }]);
  });
});
