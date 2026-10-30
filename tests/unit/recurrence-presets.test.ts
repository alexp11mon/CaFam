import { describe, expect, it } from "vitest";
import { repeatOptions, resolveRepeat } from "@/lib/recurrence/presets";

const NEVER = { kind: "never" };

describe("repeatOptions (RF-1, RF-2)", () => {
  it("offers the quick options of Tuesday 10-11-2026", () => {
    expect(repeatOptions("2026-11-10").map((o) => o.label)).toEqual([
      "No se repite",
      "Cada día",
      "Cada semana el martes",
      "Cada mes el día 10",
      "Cada mes el 2.º martes",
      "Cada año el 10 de noviembre",
      "Todos los días laborables (lunes a viernes)",
      "Personalizado…",
    ]);
    expect(repeatOptions("2026-11-10")[0]!.value).toBe("none");
  });

  it("adds the last weekday when the date is the last one of the month", () => {
    const labels = repeatOptions("2026-11-24").map((o) => o.label);
    expect(labels).toContain("Cada mes el 4.º martes");
    expect(labels).toContain("Cada mes el último martes");
  });

  it("a fifth weekday is only offered as the last one", () => {
    const labels = repeatOptions("2026-12-29").map((o) => o.label);
    expect(labels).toContain("Cada mes el último martes");
    expect(labels.some((l) => l.includes("5.º"))).toBe(false);
  });
});

describe("resolveRepeat (RF-2, RF-7, plan D13)", () => {
  it("resolves each quick option with the given date", () => {
    const date = "2026-11-24";
    expect(resolveRepeat("none", date)).toEqual({ ok: true, rule: null });
    expect(resolveRepeat("daily", date)).toEqual({
      ok: true,
      rule: { freq: "daily", interval: 1, end: NEVER },
    });
    expect(resolveRepeat("weekly", date)).toEqual({
      ok: true,
      rule: { freq: "weekly", interval: 1, byDay: ["TU"], end: NEVER },
    });
    expect(resolveRepeat("monthly-day", date)).toEqual({
      ok: true,
      rule: { freq: "monthly", interval: 1, monthly: { day: 24 }, end: NEVER },
    });
    expect(resolveRepeat("monthly-pos", date)).toEqual({
      ok: true,
      rule: {
        freq: "monthly",
        interval: 1,
        monthly: { pos: 4, weekday: "TU" },
        end: NEVER,
      },
    });
    expect(resolveRepeat("monthly-last", date)).toEqual({
      ok: true,
      rule: {
        freq: "monthly",
        interval: 1,
        monthly: { pos: -1, weekday: "TU" },
        end: NEVER,
      },
    });
    expect(resolveRepeat("yearly", date)).toEqual({
      ok: true,
      rule: {
        freq: "yearly",
        interval: 1,
        yearly: { month: 11, day: 24 },
        end: NEVER,
      },
    });
    expect(resolveRepeat("weekdays", date)).toEqual({
      ok: true,
      rule: {
        freq: "weekly",
        interval: 1,
        byDay: ["MO", "TU", "WE", "TH", "FR"],
        end: NEVER,
      },
    });
  });

  it("follows the date: weekly on another day after changing it", () => {
    const result = resolveRepeat("weekly", "2026-11-12");
    expect(result.ok && result.rule).toMatchObject({ byDay: ["TH"] });
  });

  it("reads a custom RRULE", () => {
    expect(
      resolveRepeat("custom:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=10", "x"),
    ).toEqual({
      ok: true,
      rule: {
        freq: "weekly",
        interval: 2,
        byDay: ["MO", "TH"],
        end: { kind: "count", count: 10 },
      },
    });
  });

  it.each([
    ["custom:FREQ=HOURLY", "2026-11-10"],
    ["fortnightly", "2026-11-10"],
    ["daily", "no-date"],
    ["monthly-pos", "2026-12-29"],
    ["monthly-last", "2026-11-10"],
  ])("rejects %s on %s", (value, date) => {
    expect(resolveRepeat(value, date).ok).toBe(false);
  });
});
