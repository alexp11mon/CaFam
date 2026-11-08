// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getBusyIntervals, getBusyPeople } from "@/lib/availability/queries";

// Spec 020, T4 (RF-5, RF-8, RF-10, RF-18; plan D2).
const ANA = "11111111-1111-4111-8111-111111111111";

function fakeClient(data: unknown, error: unknown = null) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      return { data, error };
    },
  };
  return { client: client as never, calls };
}

describe("getBusyPeople", () => {
  it("maps busy_people to names and the shown flag", async () => {
    const { client } = fakeClient([
      { id: ANA, display_name: "Ana", shown: true },
    ]);
    expect(await getBusyPeople(client)).toEqual([
      { id: ANA, name: "Ana", shown: true },
    ]);
  });
});

describe("getBusyIntervals", () => {
  const from = new Date("2026-11-09T00:00:00Z");
  const to = new Date("2026-11-16T00:00:00Z");

  it("asks for the period and expands series without their exdates", async () => {
    const { client, calls } = fakeClient([
      {
        person_id: ANA,
        starts_at: "2026-11-10T08:00:00+00:00",
        ends_at: "2026-11-10T09:00:00+00:00",
        all_day: false,
        recurrence: null,
        recurrence_tz: null,
        exdates: null,
      },
      {
        person_id: ANA,
        starts_at: "2026-11-02T17:00:00+00:00",
        ends_at: "2026-11-02T18:00:00+00:00",
        all_day: false,
        recurrence: "FREQ=DAILY;COUNT=10",
        recurrence_tz: "Europe/Madrid",
        exdates: ["2026-11-09T17:00:00+00:00"],
      },
    ]);
    const intervals = await getBusyIntervals(client, from, to);
    expect(calls).toEqual([
      {
        fn: "grid_busy",
        args: { p_from: from.toISOString(), p_to: to.toISOString() },
      },
    ]);
    // 10–11 November of the series (9 is excluded, 12 is past COUNT), plus the single.
    expect(intervals.map((b) => b.startsAt)).toEqual([
      "2026-11-10T08:00:00+00:00",
      "2026-11-10T17:00:00.000Z",
      "2026-11-11T17:00:00.000Z",
    ]);
  });

  it("throws a database error, so the page shows its error", async () => {
    const { client } = fakeClient(null, { code: "22023" });
    await expect(getBusyIntervals(client, from, to)).rejects.toEqual({
      code: "22023",
    });
  });
});
