import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { applyChange } from "@/app/dashboard/offline-writes";
import type { EventData } from "@/lib/calendar/schemas";
import { offlineChangeSchema, type ParsedChange } from "@/lib/offline/schemas";
import { ProviderError } from "@/lib/sync/providers/types";
import { writeErrorText } from "@/lib/sync/write-errors";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 035 T6: a change made offline in a calendar from Google or iCloud is
// compared with the provider and written there first (RF-1 to RF-9, plan D1,
// D8). The provider is simulated; the database is dev.

const session = {
  readEvent: vi.fn(),
  insertEvent: vi.fn(),
  updateEvent: vi.fn(),
  moveEvent: vi.fn(),
  deleteEvent: vi.fn(),
};
vi.mock("@/lib/sync/providers", async (original) => ({
  ...(await original<typeof import("@/lib/sync/providers")>()),
  openSession: vi.fn(async () => session),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TZ = "Europe/Madrid";

let ana: TestUser;
let luis: TestUser;
let connectionId: string;
let syncedCal: string;
let otherCal: string;
let readerCal: string;

async function syncedCalendar(access: "owner" | "reader") {
  const calendar = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: `Google ${access}` })
    .select("id")
    .single();
  if (calendar.error) throw calendar.error;
  const synced = await admin.from("synced_calendars").insert({
    calendar_id: calendar.data.id,
    connection_id: connectionId,
    provider: "google",
    external_id: `cal-${randomUUID()}`,
    google_access: access,
  });
  if (synced.error) throw synced.error;
  return calendar.data.id;
}

beforeAll(async () => {
  [ana, luis] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
  ]);
  const connection = await admin
    .from("calendar_connections")
    .insert({
      owner_id: ana.id,
      provider: "google",
      account_subject: `sub-${randomUUID()}`,
      account_email: "ana@gmail.test",
      can_write: true,
    })
    .select("id")
    .single();
  if (connection.error) throw connection.error;
  connectionId = connection.data.id;
  syncedCal = await syncedCalendar("owner");
  otherCal = await syncedCalendar("owner");
  readerCal = await syncedCalendar("reader");
  const member = await admin
    .from("calendar_members")
    .insert({ calendar_id: syncedCal, user_id: luis.id, role: "viewer" });
  if (member.error) throw member.error;
});

afterAll(async () => {
  for (const user of [ana, luis]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

beforeEach(() => {
  for (const fn of Object.values(session)) fn.mockReset();
});

const data = (extra: Partial<EventData> = {}): EventData => ({
  title: "Dentista",
  calendarId: syncedCal,
  allDay: false,
  startsAt: "2026-11-20T09:00:00+00:00",
  endsAt: "2026-11-20T10:00:00+00:00",
  description: null,
  location: null,
  color: null,
  categoryId: null,
  ...extra,
});

/** As Google gives it back: the fields CaFam writes (T5). */
const inGoogle = (extra: object = {}) => ({
  title: "Dentista",
  description: null,
  location: null,
  starts_at: "2026-11-20T09:00:00.000Z",
  ends_at: "2026-11-20T10:00:00.000Z",
  all_day: false,
  ...extra,
});

const apply = (user: TestUser, change: unknown, force = false) =>
  applyChange(
    user.client,
    user.id,
    TZ,
    offlineChangeSchema.parse(change) as ParsedChange,
    force,
  );

async function seedEvent(calendarId = syncedCal) {
  const { data: row, error } = await admin
    .from("events")
    .insert({
      calendar_id: calendarId,
      title: "Dentista",
      starts_at: "2026-11-20T09:00:00Z",
      ends_at: "2026-11-20T10:00:00Z",
      created_by: ana.id,
      external_id: `ev-${randomUUID()}`,
    })
    .select("id, external_id")
    .single();
  if (error) throw error;
  return row;
}

const eventRow = async (id: string) =>
  (await admin.from("events").select("*").eq("id", id).maybeSingle()).data;

describe("writes in the provider first (RF-1, RF-3, RF-4)", () => {
  it("creates in the provider and then in CaFam with its id", async () => {
    session.insertEvent.mockResolvedValue("ev-nuevo");
    const result = await apply(ana, {
      type: "event.create",
      id: randomUUID(),
      data: data({ title: "Nuevo" }),
    });
    expect(result).toEqual({ status: "applied" });
    expect(session.insertEvent).toHaveBeenCalledOnce();
    const { data: rows } = await admin
      .from("events")
      .select("title")
      .eq("calendar_id", syncedCal)
      .eq("external_id", "ev-nuevo");
    expect(rows).toEqual([{ title: "Nuevo" }]);
  });

  it("changes after reading the provider, which still has the base", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(inGoogle());
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Dentista (cambiado)" }),
    });
    expect(result).toEqual({ status: "applied" });
    expect(session.readEvent).toHaveBeenCalledWith(
      expect.any(String),
      event.external_id,
    );
    expect(session.updateEvent).toHaveBeenCalledOnce();
    expect(await eventRow(event.id)).toMatchObject({
      title: "Dentista (cambiado)",
    });
  });

  it("moves to another calendar of the same account", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(inGoogle());
    session.moveEvent.mockResolvedValue(event.external_id);
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ calendarId: otherCal }),
    });
    expect(result).toEqual({ status: "applied" });
    expect(session.moveEvent).toHaveBeenCalledOnce();
    expect(await eventRow(event.id)).toMatchObject({ calendar_id: otherCal });
  });

  it("deletes in the provider and then in CaFam", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(inGoogle());
    const result = await apply(ana, {
      type: "event.delete",
      id: event.id,
      base: data(),
    });
    expect(result).toEqual({ status: "applied" });
    expect(session.deleteEvent).toHaveBeenCalledOnce();
    expect(await eventRow(event.id)).toBeNull();
  });
});

describe("conflicts against the provider (RF-5, RF-6)", () => {
  it("changed in the provider meanwhile: a conflict with its version", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(
      inGoogle({ title: "Dentista (Google)" }),
    );
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Mío" }),
    });
    expect(result).toEqual({
      status: "conflict",
      server: expect.objectContaining({ title: "Dentista (Google)" }),
    });
    expect(session.updateEvent).not.toHaveBeenCalled();
    expect(await eventRow(event.id)).toMatchObject({ title: "Dentista" });
  });

  it("deleted in the provider: a conflict with nothing", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(null);
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Mío" }),
    });
    expect(result).toEqual({ status: "conflict", server: null });
    expect(session.updateEvent).not.toHaveBeenCalled();
  });

  it("with force, writes over the provider's version", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(
      inGoogle({ title: "Dentista (Google)" }),
    );
    const result = await apply(
      ana,
      {
        type: "event.update",
        id: event.id,
        base: data(),
        data: data({ title: "Mío" }),
      },
      true,
    );
    expect(result).toEqual({ status: "applied" });
    expect(await eventRow(event.id)).toMatchObject({ title: "Mío" });
  });
});

describe("refused changes (RF-2, RF-9)", () => {
  it("the provider refuses: rejected with the reason in Spanish", async () => {
    const event = await seedEvent();
    session.readEvent.mockResolvedValue(inGoogle());
    session.updateEvent.mockRejectedValue(
      new ProviderError("rejected", "403 forbidden"),
    );
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Mío" }),
    });
    expect(result).toEqual({
      status: "rejected",
      reason: writeErrorText("rejected", "google"),
    });
    expect(await eventRow(event.id)).toMatchObject({ title: "Dentista" });
  });

  it("a Reader is rejected without asking the provider", async () => {
    const event = await seedEvent();
    const result = await apply(luis, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Ajeno" }),
    });
    expect(result).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/permiso/i),
    });
    expect(session.readEvent).not.toHaveBeenCalled();
  });

  it("a calendar the provider only lets read is rejected", async () => {
    const event = await seedEvent(readerCal);
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data({ calendarId: readerCal }),
      data: data({ calendarId: readerCal, title: "Mío" }),
    });
    expect(result).toMatchObject({ status: "rejected" });
    expect(session.updateEvent).not.toHaveBeenCalled();
  });
});

describe("an account that needs reconnecting (RF-7, plan D8)", () => {
  // Last: it marks the connection as needing reauth, as with a connection.
  it("keeps the change held, with nothing written", async () => {
    const event = await seedEvent();
    session.readEvent.mockRejectedValue(new ProviderError("revoked", "401"));
    const result = await apply(ana, {
      type: "event.update",
      id: event.id,
      base: data(),
      data: data({ title: "Mío" }),
    });
    expect(result).toEqual({ status: "held", connectionId });
    expect(session.updateEvent).not.toHaveBeenCalled();
    expect(await eventRow(event.id)).toMatchObject({ title: "Dentista" });
    const { data: connection } = await admin
      .from("calendar_connections")
      .select("status")
      .eq("id", connectionId)
      .single();
    expect(connection).toEqual({ status: "needs_reauth" });
  });

  it("a create whose account was revoked is held too", async () => {
    session.insertEvent.mockRejectedValue(new ProviderError("revoked", "401"));
    const result = await apply(ana, {
      type: "event.create",
      id: randomUUID(),
      data: data({ title: "Retenido" }),
    });
    expect(result).toEqual({ status: "held", connectionId });
  });
});
