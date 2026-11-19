import { describe, expect, it } from "vitest";
import { convertOccurrences } from "@/lib/ics/convert-events";
import { runImport } from "@/lib/ics/import-calendar";
import { parseIcs } from "@/lib/ics/parse-ics";

// Spec 044, T1: each imported event keeps its identity in the .ics as
// external_id: the UID, or UID#<instant> in a repetition (RF-2).
const TODAY = { today: { year: 2026, month: 11, day: 19 } };

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:single@colegio",
  "DTSTART:20261120T090000Z",
  "DTEND:20261120T100000Z",
  "SUMMARY:Excursión",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:clase@colegio",
  "DTSTART;TZID=Europe/Madrid:20261102T180000",
  "DTEND;TZID=Europe/Madrid:20261102T190000",
  "RRULE:FREQ=WEEKLY;COUNT=3",
  "SUMMARY:Clase",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:clase@colegio",
  "RECURRENCE-ID;TZID=Europe/Madrid:20261109T180000",
  "DTSTART;TZID=Europe/Madrid:20261110T180000",
  "DTEND;TZID=Europe/Madrid:20261110T190000",
  "SUMMARY:Clase cambiada",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:fiesta@colegio",
  "DTSTART;VALUE=DATE:20261208",
  "RRULE:FREQ=MONTHLY;COUNT=2",
  "SUMMARY:Fiesta",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:suelta@colegio",
  "RECURRENCE-ID:20261201T080000Z",
  "DTSTART:20261201T090000Z",
  "DTEND:20261201T100000Z",
  "SUMMARY:Repetición sin serie",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261205T090000Z",
  "SUMMARY:Sin UID",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function ids(text: string) {
  const parsed = parseIcs(text, TODAY);
  if (!parsed.ok) throw new Error(parsed.error);
  return convertOccurrences(parsed.occurrences, "Europe/Madrid").events.map(
    (event) => [event.title, event.external_id],
  );
}

describe("identity of imported events", () => {
  it("uses the UID, and UID#instant in repetitions", () => {
    expect(ids(ICS)).toEqual([
      ["Excursión", "single@colegio"],
      ["Clase", "clase@colegio#20261102T170000Z"],
      ["Clase cambiada", "clase@colegio#20261109T170000Z"],
      ["Clase", "clase@colegio#20261116T170000Z"],
      ["Fiesta", "fiesta@colegio#20261208"],
      ["Fiesta", "fiesta@colegio#20270108"],
      ["Repetición sin serie", "suelta@colegio#20261201T080000Z"],
      ["Sin UID", "sin-uid:Sin UID#20261205T090000Z"],
    ]);
  });

  it("is the same in two reads of the same file", () => {
    expect(ids(ICS)).toEqual(ids(ICS));
  });

  it("keeps one event per identity when the file repeats it", async () => {
    const repeated = ICS.replace(
      "END:VCALENDAR",
      [
        "BEGIN:VEVENT",
        "UID:single@colegio",
        "DTSTART:20261121T090000Z",
        "SUMMARY:Otra vez",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
    );
    const result = await runImport({
      source: { kind: "text", text: repeated },
      profileTimeZone: "Europe/Madrid",
      today: TODAY.today,
      name: null,
    });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.events.map((event) => event.title)).not.toContain("Otra vez");
    expect(result.skipped).toBe(1);
  });
});
