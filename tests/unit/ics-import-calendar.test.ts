// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { runImport } from "@/lib/ics/import-calendar";
import type { FetchResult } from "@/lib/ics/fetch-ics";

const TODAY = { year: 2026, month: 10, day: 22 };
const URL_OK = new URL("https://calendar.example.com/a.ics");

function calendar(events: string[], header = ""): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", header, ...events, "END:VCALENDAR"]
    .filter(Boolean)
    .join("\r\n");
}

function event(lines: string[]): string {
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
}

const simple = (uid = "a") =>
  event([
    `UID:${uid}`,
    "DTSTART;TZID=Europe/Madrid:20261102T100000",
    "SUMMARY:x",
  ]);

function run(
  text: string,
  overrides: Partial<Parameters<typeof runImport>[0]> = {},
) {
  return runImport({
    source: { kind: "text", text },
    profileTimeZone: "Europe/Madrid",
    today: TODAY,
    name: null,
    ...overrides,
  });
}

describe("runImport result (RF-9)", () => {
  it("gives name, events, skipped and cut series", async () => {
    const result = await run(
      calendar(
        [
          simple("a"),
          event(["UID:w", "DTSTART:20261022T100000Z", "RRULE:FREQ=WEEKLY"]),
          event([
            "UID:z",
            "DTSTART;TZID=Mars/Olympus:20261102T100000",
            "SUMMARY:z",
          ]),
        ],
        "X-WR-CALNAME:Clases",
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("Clases");
    expect(result.events).toHaveLength(1 + 53);
    expect(result.skipped).toBe(1);
    expect(result.cutSeries).toBe(1);
  });

  it("counts events without a start as skipped (RF-29)", async () => {
    const result = await run(
      calendar([simple("a"), event(["UID:bad", "SUMMARY:sin inicio"])]),
    );

    expect(result.ok && [result.events.length, result.skipped]).toEqual([1, 1]);
  });

  it("uses the name of the form first, then the one of the .ics, then a default (RF-8, RF-9)", async () => {
    const named = calendar([simple()], "X-WR-CALNAME:Del ics");

    expect(await run(named, { name: "Mío" })).toMatchObject({
      ok: true,
      name: "Mío",
    });
    expect(await run(named)).toMatchObject({ ok: true, name: "Del ics" });
    expect(await run(calendar([simple()]))).toMatchObject({
      ok: true,
      name: "Calendario importado",
    });
  });

  it("cuts the name of the .ics to 50 characters (RF-9)", async () => {
    const result = await run(
      calendar([simple()], `X-WR-CALNAME:${"n".repeat(80)}`),
    );

    expect(result.ok && result.name).toBe("n".repeat(50));
  });
});

describe("runImport limits (RF-27)", () => {
  const daily = (uid: string, count: number, start: string) =>
    event([
      `UID:${uid}`,
      `DTSTART:${start}`,
      `RRULE:FREQ=DAILY;COUNT=${count}`,
      "SUMMARY:x",
    ]);

  it("accepts exactly 2000 events", async () => {
    const result = await run(calendar([daily("d", 2000, "20200101T100000Z")]));

    expect(result.ok && result.events.length).toBe(2000);
  });

  it("rejects 2001 events with their count and returns none", async () => {
    const result = await run(calendar([daily("d", 2001, "20200101T100000Z")]));

    expect(result).toEqual({
      ok: false,
      error: { kind: "too-many", count: 2001, capped: false },
    });
  });

  it("gives the real count up to the cap", async () => {
    const result = await run(calendar([daily("d", 2500, "20200101T100000Z")]));

    expect(result).toEqual({
      ok: false,
      error: { kind: "too-many", count: 2500, capped: false },
    });
  });

  it("says capped when expansion hits the counting cap (plan D8)", async () => {
    const result = await run(
      calendar([
        event(["UID:s", "DTSTART:20261022T100000Z", "RRULE:FREQ=SECONDLY"]),
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { kind: "too-many", capped: true },
    });
  });

  it("does not count skipped events towards the limit", async () => {
    const result = await run(
      calendar([
        daily("ok", 1900, "20200101T100000Z"),
        event([
          "UID:mars",
          "DTSTART;TZID=Mars/Olympus:20260101T100000",
          "RRULE:FREQ=DAILY;COUNT=200",
        ]),
      ]),
    );

    expect(result.ok && [result.events.length, result.skipped]).toEqual([
      1900, 200,
    ]);
  });
});

describe("runImport errors (RF-28)", () => {
  it("says no events when everything is skipped", async () => {
    const result = await run(
      calendar([
        event(["UID:z", "DTSTART;TZID=Romance Standard Time:20261102T100000"]),
      ]),
    );

    expect(result).toEqual({ ok: false, error: { kind: "no-events" } });
  });

  it("says no events for an empty calendar", async () => {
    expect(await run(calendar([]))).toEqual({
      ok: false,
      error: { kind: "no-events" },
    });
  });

  it("says not an .ics for other content", async () => {
    expect(await run("<html>login</html>")).toEqual({
      ok: false,
      error: { kind: "not-ics" },
    });
  });
});

describe("runImport sources (RF-1, RF-4, RF-5, RF-26)", () => {
  it("downloads a link once and imports its text", async () => {
    const fetchIcs = vi.fn(async (): Promise<FetchResult> => ({
      ok: true,
      text: calendar([simple()]),
    }));

    const result = await runImport(
      {
        source: { kind: "url", url: URL_OK },
        profileTimeZone: "Europe/Madrid",
        today: TODAY,
        name: null,
      },
      { fetchIcs },
    );

    expect(result.ok && result.events.length).toBe(1);
    expect(fetchIcs).toHaveBeenCalledTimes(1);
    expect(fetchIcs).toHaveBeenCalledWith(URL_OK);
  });

  it.each([
    ["invalid-url", { kind: "invalid-url" }],
    ["unreachable", { kind: "unreachable" }],
    ["too-large", { kind: "too-large" }],
  ] as const)("passes the download error %s on", async (error, expected) => {
    const result = await runImport(
      {
        source: { kind: "url", url: URL_OK },
        profileTimeZone: "Europe/Madrid",
        today: TODAY,
        name: null,
      },
      { fetchIcs: async () => ({ ok: false, error }) },
    );

    expect(result).toEqual({ ok: false, error: expected });
  });
});
