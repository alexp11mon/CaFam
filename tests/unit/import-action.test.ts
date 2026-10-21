// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  rpcResult: { data: null, error: null } as {
    data: string | null;
    error: { code: string; message?: string } | null;
  },
  runImportCalls: [] as unknown[],
  runImportResult: null as unknown,
  profileZoneCalls: 0,
  revalidated: [] as unknown[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => state.revalidated.push(args),
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    supabase: {
      rpc: async (name: string, args: unknown) => {
        state.rpcCalls.push({ name, args });
        return state.rpcResult;
      },
    },
    userId: "user",
  }),
  getProfileTimeZone: async () => {
    state.profileZoneCalls++;
    return "America/Bogota";
  },
}));

vi.mock("@/lib/ics/import-calendar", () => ({
  runImport: async (input: unknown) => {
    state.runImportCalls.push(input);
    return state.runImportResult;
  },
}));

const { importCalendar } = await import("@/app/dashboard/import/actions");

const EVENTS = [
  {
    title: "Clase",
    description: null,
    location: null,
    starts_at: "2026-11-02T09:00:00.000Z",
    ends_at: "2026-11-02T10:00:00.000Z",
    all_day: false,
  },
];

const OK = {
  ok: true,
  name: "Clases",
  events: EVENTS,
  skipped: 2,
  cutSeries: 1,
};
const INITIAL = { values: { url: "", file: "", name: "", color: "" } };

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const FILE = () =>
  new File(["BEGIN:VCALENDAR"], "a.ics", { type: "text/calendar" });
const SECRET_URL = "https://calendar.example.com/private/SECRET-TOKEN.ics";

beforeEach(() => {
  state.rpcCalls = [];
  state.runImportCalls = [];
  state.revalidated = [];
  state.profileZoneCalls = 0;
  state.runImportResult = OK;
  state.rpcResult = { data: ID, error: null };
});

describe("importCalendar action success (RF-7, RF-31)", () => {
  it("calls import_calendar and returns the summary without redirecting", async () => {
    const result = await importCalendar(
      INITIAL,
      form({ file: FILE(), name: "Mis clases", color: "#cafFBF" }),
    );

    expect(state.rpcCalls).toEqual([
      {
        name: "import_calendar",
        args: { p_name: "Clases", p_color: "#CAFFBF", p_events: EVENTS },
      },
    ]);
    expect(result.result).toEqual({
      calendarId: ID,
      created: 1,
      skipped: 2,
      cutSeries: 1,
    });
    expect(result.formError).toBeUndefined();
    expect(state.revalidated).toEqual([["/dashboard", "layout"]]);
  });

  it("passes the typed name, or null for the one of the .ics, to the import (RF-8)", async () => {
    await importCalendar(
      INITIAL,
      form({ file: FILE(), name: "  Mis clases " }),
    );
    await importCalendar(INITIAL, form({ file: FILE() }));

    expect(
      state.runImportCalls.map(
        (call) => (call as { name: string | null }).name,
      ),
    ).toEqual(["Mis clases", null]);
  });

  it("uses the brand blue when no color is chosen", async () => {
    await importCalendar(INITIAL, form({ file: FILE() }));

    expect((state.rpcCalls[0].args as { p_color: string }).p_color).toBe(
      "#2563EB",
    );
  });

  it("reads the time zone from the profile on the server, never from the form", async () => {
    await importCalendar(
      INITIAL,
      form({
        file: FILE(),
        timeZone: "Asia/Tokyo",
        profileTimeZone: "Asia/Tokyo",
      }),
    );

    expect(state.profileZoneCalls).toBe(1);
    expect(
      (state.runImportCalls[0] as { profileTimeZone: string }).profileTimeZone,
    ).toBe("America/Bogota");
  });

  it("gives the import the file text or the validated link (RF-1, RF-2)", async () => {
    await importCalendar(INITIAL, form({ file: FILE() }));
    await importCalendar(
      INITIAL,
      form({ url: "webcal://calendar.example.com/a.ics" }),
    );

    const sources = state.runImportCalls.map(
      (call) => (call as { source: { kind: string } }).source.kind,
    );
    expect(sources).toEqual(["text", "url"]);
  });
});

describe("importCalendar action failures (RF-6, RF-30)", () => {
  it("returns the message of an import failure and does not call the database", async () => {
    state.runImportResult = { ok: false, error: { kind: "no-events" } };

    const result = await importCalendar(INITIAL, form({ file: FILE() }));

    expect(result.formError).toBe(
      "El calendario no tiene eventos que se puedan importar.",
    );
    expect(result.result).toBeUndefined();
    expect(state.rpcCalls).toEqual([]);
    expect(state.revalidated).toEqual([]);
  });

  it("explains a too large file before reading it", async () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.ics");

    const result = await importCalendar(INITIAL, form({ file: big }));

    expect(result.formError).toBe("El archivo supera el límite de 2 MB.");
    expect(state.runImportCalls).toEqual([]);
  });

  it("says nothing was saved when the database fails", async () => {
    state.rpcResult = {
      data: null,
      error: { code: "23514", message: "check" },
    };

    const result = await importCalendar(INITIAL, form({ file: FILE() }));

    expect(result.formError).toBe(
      "No se ha podido crear el calendario. No se ha guardado nada.",
    );
    expect(result.result).toBeUndefined();
    expect(state.revalidated).toEqual([]);
  });

  it("returns field errors without importing", async () => {
    const result = await importCalendar(INITIAL, form({ url: "", name: "x" }));

    expect(result.fieldErrors?.url).toBe(
      "Indica un enlace o sube un archivo, no los dos.",
    );
    expect(state.runImportCalls).toEqual([]);
  });

  it("rejects an invalid link", async () => {
    const result = await importCalendar(
      INITIAL,
      form({ url: "http://calendar.example.com/a.ics" }),
    );

    expect(result.formError).toBe(
      "El enlace no es válido. Debe empezar por https:// o webcal://.",
    );
    expect(state.runImportCalls).toEqual([]);
  });

  it("never puts the link or the text of the file in the returned state (RF-6)", async () => {
    state.runImportResult = { ok: false, error: { kind: "unreachable" } };
    const failed = await importCalendar(INITIAL, form({ url: SECRET_URL }));

    state.runImportResult = OK;
    const done = await importCalendar(INITIAL, form({ url: SECRET_URL }));

    // The form keeps what was typed after a failure, but never after success.
    expect(JSON.stringify(done)).not.toContain("SECRET-TOKEN");
    expect(failed.formError).not.toContain("SECRET-TOKEN");
    expect(done.values.url).toBe("");
  });
});
