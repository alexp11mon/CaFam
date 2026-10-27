// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 007, T9: saving the selection and "Actualizar ahora" (plan D5; RF-10,
// RF-11, RF-14, RF-23, RF-24).
const { rpc, rows, syncConnection, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  rows: {} as Record<string, unknown[]>,
  syncConnection: vi.fn(),
  revalidatePath: vi.fn(),
}));

function query(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: rows[table] ?? [], error: null }),
  };
  return chain;
}

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({
    supabase: { from: query, rpc },
    userId: "user-1",
  }),
}));
vi.mock("@/lib/sync/engine", () => ({ syncConnection }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveSelection, syncNow } from "@/app/dashboard/connections/actions";

const CONNECTION = "6f1c2a9e-1f0e-4c38-9d43-2a3b5c6d7e8f";

function form(
  calendars: { id: string; name: string; color: string | null }[],
  extra: Record<string, string> = {},
) {
  const data = new FormData();
  data.set("connectionId", CONNECTION);
  for (const calendar of calendars)
    data.append("calendar", JSON.stringify(calendar));
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows.calendar_connections = [{ id: CONNECTION }];
  rows.synced_calendars = [];
  rpc.mockResolvedValue({ data: [], error: null });
  syncConnection.mockResolvedValue({
    status: "ok",
    results: [
      { calendarId: "x", summary: { added: 4, changed: 0, removed: 0 } },
    ],
  });
});

const rpcCalls = (fn: string) => rpc.mock.calls.filter(([name]) => name === fn);

describe("saveSelection (RF-10, RF-11, RF-14)", () => {
  it("rejects malformed data without touching the database", async () => {
    const data = form([]);
    data.set("connectionId", "nope");
    const state = await saveSelection({}, data);

    expect(state.formError).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects another user's connection (RLS hides it)", async () => {
    rows.calendar_connections = [];
    const state = await saveSelection(
      {},
      form([{ id: "g1", name: "A", color: null }]),
    );

    expect(state.formError).toMatch(/ya no existe/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects more than 20 calendars", async () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      id: `g${i}`,
      name: `C${i}`,
      color: null,
    }));
    const state = await saveSelection({}, form(many));
    expect(state.formError).toMatch(/20/);
  });

  it("creates the new calendars with the nearest palette color and updates them", async () => {
    const state = await saveSelection(
      {},
      form([{ id: "g1", name: "Trabajo", color: "#ff0000" }]),
    );

    expect(rpcCalls("select_synced_calendars")[0][1]).toEqual({
      p_connection_id: CONNECTION,
      p_calendars: [{ external_id: "g1", name: "Trabajo", color: "#FFADAD" }],
    });
    expect(syncConnection).toHaveBeenCalledWith(CONNECTION, false);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(state.message).toMatch(/4 añadidos/);
  });

  it("asks what to do with unchecked calendars and applies the choice", async () => {
    rows.synced_calendars = [{ calendar_id: "cal-1", external_id: "g1" }];

    const missing = await saveSelection({}, form([]));
    expect(missing.fieldErrors?.decision).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();

    await saveSelection({}, form([], { decision: "keep" }));
    expect(rpcCalls("detach_synced_calendars")[0][1]).toEqual({
      p_connection_id: CONNECTION,
      p_calendar_ids: ["cal-1"],
      p_delete: false,
    });
    expect(rpcCalls("select_synced_calendars")).toHaveLength(0);
  });

  it("explains the limit of 20 when the database refuses (CF429)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "CF429" } });
    const state = await saveSelection(
      {},
      form([{ id: "g1", name: "A", color: null }]),
    );
    expect(state.formError).toMatch(/20/);
  });
});

describe("syncNow (RF-23, RF-24)", () => {
  it("says when it can update again", async () => {
    syncConnection.mockResolvedValue({
      status: "too_soon",
      nextAt: new Date(Date.now() + 3 * 60_000 - 1000).toISOString(),
    });

    const state = await syncNow(CONNECTION);

    expect(state.message).toMatch(/dentro de 3 minutos/);
  });

  it("summarises the update", async () => {
    const state = await syncNow(CONNECTION);

    expect(syncConnection).toHaveBeenCalledWith(CONNECTION, true);
    expect(state.message).toMatch(/4 añadidos/);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("says which calendars failed", async () => {
    syncConnection.mockResolvedValue({
      status: "ok",
      results: [{ calendarId: "x", error: "transient" }],
    });
    const state = await syncNow(CONNECTION);
    expect(state.message).toMatch(/1 calendario no se ha podido actualizar/);
  });

  it("asks to reconnect when Google withdrew the permission", async () => {
    syncConnection.mockResolvedValue({ status: "needs_reauth" });
    const state = await syncNow(CONNECTION);
    expect(state.formError).toMatch(/vuelve a conectar/i);
  });

  it("does nothing on another user's connection", async () => {
    rows.calendar_connections = [];
    const state = await syncNow(CONNECTION);
    expect(state.formError).toMatch(/ya no existe/i);
    expect(syncConnection).not.toHaveBeenCalled();
  });
});
