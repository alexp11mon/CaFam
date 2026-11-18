// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/sync/google-event.json";
import { googleSession } from "@/lib/sync/providers/google-session";
import { ProviderError } from "@/lib/sync/providers/types";

// Spec 035 T5: reading one Google event before writing over it (RF-5, RF-6,
// plan D1).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function session(answer: (url: string) => Response) {
  const fetchFn = vi.fn(async (input: RequestInfo | URL) =>
    answer(String(input)),
  );
  return { fetchFn, google: googleSession("token", fetchFn as typeof fetch) };
}

describe("googleSession.readEvent", () => {
  it("reads a single event as CaFam writes it", async () => {
    const { google, fetchFn } = session(() => json(fixture.single));
    expect(await google.readEvent("cal@group", "abc123")).toEqual({
      title: "Dentista",
      description: "Llevar la tarjeta",
      location: "Calle Mayor 1",
      starts_at: "2026-11-20T09:00:00.000Z",
      ends_at: "2026-11-20T10:00:00.000Z",
      all_day: false,
    });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/cal%40group/events/abc123",
    );
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer token");
  });

  it("reads a repetition by its own id, and an all-day event", async () => {
    const { google } = session((url) =>
      json(url.endsWith("cumple") ? fixture.allDay : fixture.instance),
    );
    expect(
      await google.readEvent("cal", "serie9_20261123T170000Z"),
    ).toMatchObject({
      title: "Inglés",
      description: null,
      starts_at: "2026-11-23T17:00:00.000Z",
    });
    expect(await google.readEvent("cal", "cumple")).toMatchObject({
      starts_at: "2026-12-04T00:00:00.000Z",
      ends_at: "2026-12-05T00:00:00.000Z",
      all_day: true,
    });
  });

  it("gives null when Google no longer has it (404, 410, cancelled)", async () => {
    for (const status of [404, 410]) {
      const { google } = session(() => json({ error: {} }, status));
      expect(await google.readEvent("cal", "gone")).toBeNull();
    }
    const { google } = session(() => json(fixture.cancelled));
    expect(await google.readEvent("cal", "serie9_20261130T170000Z")).toBeNull();
  });

  it("throws revoked when the account lost its permission (401)", async () => {
    const { google } = session(() => json({ error: {} }, 401));
    const reading = google.readEvent("cal", "abc123");
    await expect(reading).rejects.toBeInstanceOf(ProviderError);
    await expect(reading).rejects.toMatchObject({ kind: "revoked" });
  });
});
