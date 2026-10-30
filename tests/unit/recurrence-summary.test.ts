import { describe, expect, it } from "vitest";
import { fromRRule } from "@/lib/recurrence/rule";
import { summarizeRule } from "@/lib/recurrence/summary";

function summary(text: string) {
  return summarizeRule(fromRRule(text)!);
}

describe("summarizeRule (RF-5, RF-10)", () => {
  it.each([
    ["FREQ=DAILY;INTERVAL=1", "Cada día"],
    ["FREQ=DAILY;INTERVAL=3", "Cada 3 días"],
    [
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=10",
      "Cada 2 semanas el lunes y el jueves, 10 veces",
    ],
    ["FREQ=WEEKLY;INTERVAL=1;BYDAY=TU", "Cada semana el martes"],
    [
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH,MO,WE",
      "Cada semana el lunes, el miércoles y el jueves",
    ],
    [
      "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;UNTIL=20270115T235959",
      "Cada semana de lunes a viernes, hasta el 15 de enero de 2027",
    ],
    ["FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR", "Cada mes el último viernes"],
    ["FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU", "Cada mes el 2.º martes"],
    ["FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31", "Cada mes el día 31"],
    ["FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=5", "Cada 2 meses el día 5"],
    [
      "FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=29",
      "Cada año el 29 de febrero",
    ],
    [
      "FREQ=YEARLY;INTERVAL=4;BYMONTH=6;BYMONTHDAY=1",
      "Cada 4 años el 1 de junio",
    ],
    ["FREQ=DAILY;INTERVAL=1;COUNT=1", "Cada día, 1 vez"],
  ])("%s → %s", (text, expected) => {
    expect(summary(text)).toBe(expected);
  });
});
