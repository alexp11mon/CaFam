// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { serializeCredential } from "@/lib/sync/icloud-credentials";
import { icloudSession } from "@/lib/sync/providers/icloud";

// Spec 035 T5: reading one iCloud event before writing over it (RF-5, RF-6,
// plan D1, R3).
const CALENDAR = "https://p42-caldav.icloud.com/123456/calendars/home/";
const HREF = "/123456/calendars/home/serie.ics";
const CREDENTIAL = serializeCredential({
  username: "ana@icloud.com",
  password: "abcd-efgh-ijkl-mnop",
});
const SERIES = readFileSync(
  join(process.cwd(), "tests/fixtures/sync/icloud-series.ics"),
  "utf8",
);
const SINGLE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:one",
  "DTSTAMP:20261001T000000Z",
  "SUMMARY:Dentista",
  "DESCRIPTION:Llevar la tarjeta",
  "DTSTART:20261120T090000Z",
  "DTEND:20261120T100000Z",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

function session(status: number, body = "") {
  const fetchFn = vi.fn(
    async () =>
      new Response(status === 200 ? body : null, {
        status,
        headers: { "Content-Type": "text/calendar", ETag: '"1"' },
      }),
  );
  return {
    fetchFn,
    icloud: icloudSession(CREDENTIAL, fetchFn as unknown as typeof fetch),
  };
}

describe("icloudSession.readEvent", () => {
  it("reads a single resource", async () => {
    const { icloud, fetchFn } = session(200, SINGLE);
    expect(
      await icloud.readEvent(CALENDAR, "/123456/calendars/home/one.ics"),
    ).toEqual({
      title: "Dentista",
      description: "Llevar la tarjeta",
      location: null,
      starts_at: "2026-11-20T09:00:00.000Z",
      ends_at: "2026-11-20T10:00:00.000Z",
      all_day: false,
    });
    const request = new Request(
      ...(fetchFn.mock.calls[0] as unknown as [string, RequestInit]),
    );
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      "https://p42-caldav.icloud.com/123456/calendars/home/one.ics",
    );
  });

  it("reads a repetition with its own VEVENT (R3)", async () => {
    const { icloud } = session(200, SERIES);
    expect(
      await icloud.readEvent(CALENDAR, `${HREF}#20261123T170000Z`),
    ).toMatchObject({
      title: "Inglés (examen)",
      starts_at: "2026-11-23T18:00:00.000Z",
      ends_at: "2026-11-23T20:00:00.000Z",
    });
  });

  it("works out a repetition of the series without its own VEVENT (R3)", async () => {
    const { icloud } = session(200, SERIES);
    expect(
      await icloud.readEvent(CALENDAR, `${HREF}#20261130T170000Z`),
    ).toEqual({
      title: "Inglés",
      description: null,
      location: "Aula 3",
      starts_at: "2026-11-30T17:00:00.000Z",
      ends_at: "2026-11-30T18:00:00.000Z",
      all_day: false,
    });
  });

  it("gives null for a deleted repetition and a missing resource", async () => {
    const { icloud } = session(200, SERIES);
    expect(
      await icloud.readEvent(CALENDAR, `${HREF}#20261207T170000Z`),
    ).toBeNull();
    const missing = session(404);
    expect(await missing.icloud.readEvent(CALENDAR, HREF)).toBeNull();
  });

  it("throws revoked when the password no longer works (401)", async () => {
    const { icloud } = session(401);
    await expect(icloud.readEvent(CALENDAR, HREF)).rejects.toMatchObject({
      kind: "revoked",
    });
  });
});
