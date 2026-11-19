import { describe, expect, it, vi } from "vitest";
import {
  refreshOne,
  runRefresh,
  type DueSubscription,
  type RefreshDeps,
} from "@/lib/ics/refresh";
import type { FetchResult } from "@/lib/ics/fetch-ics";

// Spec 044, T3: the engine that keeps an imported calendar updated from its
// link (RF-7, RF-10, RF-12, RNF-1), with every dependency simulated.
const NOW = new Date("2026-11-19T10:00:00Z");

const ICS = (events: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...events.flatMap((e) => e.split("\n")),
    "END:VCALENDAR",
  ].join("\r\n");
const EVENT = (uid: string, day: string) =>
  `BEGIN:VEVENT\nUID:${uid}\nDTSTART:${day}T090000Z\nDTEND:${day}T100000Z\nSUMMARY:${uid}\nEND:VEVENT`;

const SUB: DueSubscription = {
  calendar_id: "c1",
  time_zone: "Europe/Madrid",
  last_read_at: "2026-11-19T04:00:00Z",
};

function deps(fetched: FetchResult, overrides: Partial<RefreshDeps> = {}) {
  return {
    getUrl: vi.fn<RefreshDeps["getUrl"]>(
      overrides.getUrl ?? (async () => "https://example.com/colegio.ics"),
    ),
    fetchIcs: vi.fn<RefreshDeps["fetchIcs"]>(async () => fetched),
    apply: vi.fn<RefreshDeps["apply"]>(overrides.apply ?? (async () => ({}))),
    fail: vi.fn<RefreshDeps["fail"]>(async () => {}),
    now: overrides.now ?? (() => NOW),
  };
}

describe("refreshOne", () => {
  it("reads, converts and applies only the window it read", async () => {
    const d = deps({
      ok: true,
      text: ICS([
        EVENT("old", "20250101"),
        EVENT("new", "20261201"),
        EVENT("far", "20281201"),
      ]),
    });
    const result = await refreshOne(SUB, d);
    expect(result).toEqual({ ok: true });
    expect(d.fetchIcs.mock.calls[0]?.[0].href).toBe(
      "https://example.com/colegio.ics",
    );
    const applied = d.apply.mock.calls[0]?.[0];
    expect(applied?.calendarId).toBe("c1");
    expect(applied?.readAt).toBe(SUB.last_read_at);
    expect(applied?.from.toISOString()).toBe("2026-05-19T00:00:00.000Z");
    expect(applied?.to.toISOString()).toBe("2027-11-19T00:00:00.000Z");
    expect(applied?.events.map((e) => e.external_id)).toEqual(["new"]);
    expect(d.fail).not.toHaveBeenCalled();
  });

  it("applies an empty window: the link removed everything", async () => {
    const d = deps({ ok: true, text: ICS([EVENT("old", "20250101")]) });
    await refreshOne(SUB, d);
    expect(d.apply.mock.calls[0]?.[0].events).toEqual([]);
  });

  it("counts a network failure as transient and 404/410 as gone", async () => {
    const down = deps({ ok: false, error: "unreachable" });
    expect(await refreshOne(SUB, down)).toEqual({
      ok: false,
      kind: "transient",
    });
    expect(down.fail).toHaveBeenCalledWith(
      "c1",
      "transient",
      "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo.",
    );
    expect(down.apply).not.toHaveBeenCalled();

    const gone = deps({ ok: false, error: "gone" });
    expect(await refreshOne(SUB, gone)).toEqual({ ok: false, kind: "gone" });
    expect(gone.fail.mock.calls[0]?.[1]).toBe("gone");
  });

  it("counts an invalid file and a failed write as transient", async () => {
    const bad = deps({ ok: true, text: "hola" });
    expect(await refreshOne(SUB, bad)).toEqual({
      ok: false,
      kind: "transient",
    });
    const write = deps(
      { ok: true, text: ICS([EVENT("a", "20261201")]) },
      {
        apply: vi.fn(async () => {
          throw new Error("db");
        }),
      },
    );
    expect(await refreshOne(SUB, write)).toEqual({
      ok: false,
      kind: "transient",
    });
    expect(write.fail.mock.calls[0]?.[2]).toBe(
      "No se han podido guardar los cambios del enlace.",
    );
  });

  it("never downloads a link that is not a valid https one", async () => {
    const d = deps(
      { ok: true, text: "" },
      { getUrl: vi.fn(async () => "http://127.0.0.1/x.ics") },
    );
    expect(await refreshOne(SUB, d)).toEqual({ ok: false, kind: "transient" });
    expect(d.fetchIcs).not.toHaveBeenCalled();
  });
});

describe("runRefresh", () => {
  it("claims batches until none is due", async () => {
    const batches = [[SUB, { ...SUB, calendar_id: "c2" }], [SUB], []];
    const claimDue = vi.fn(async () => batches.shift() ?? []);
    const d = deps({ ok: true, text: ICS([EVENT("a", "20261201")]) });
    expect(await runRefresh(claimDue, d)).toEqual({ refreshed: 3, failed: 0 });
    expect(claimDue).toHaveBeenCalledTimes(3);
  });

  it("stops claiming after the 50 s budget", async () => {
    let clock = NOW.getTime();
    const claimDue = vi.fn(async () => [SUB]);
    const d = deps(
      { ok: false, error: "unreachable" },
      {
        now: () => {
          clock += 20_000;
          return new Date(clock);
        },
      },
    );
    const result = await runRefresh(claimDue, d);
    expect(result.failed).toBeGreaterThan(0);
    expect(claimDue.mock.calls.length).toBeLessThan(5);
  });
});
