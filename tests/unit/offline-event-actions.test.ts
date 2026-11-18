import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetConnection } from "@/lib/offline/db";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import {
  deleteFromDetailOrQueue,
  deleteOrQueue,
  eventFormOrQueue,
  quickChangeOrQueue,
} from "@/lib/offline/event-actions";
import { clearQueue, getQueueState } from "@/lib/offline/queue-store";
import type { Snapshot } from "@/lib/offline/snapshot";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T10: series, "Repetir" and Google or iCloud calendars offline,
// with the same rules as online (RF-1, RF-2, RF-10, RF-11, RF-13, RF-16).
vi.mock("@/app/dashboard/events/quick-actions", () => ({
  quickChange: vi.fn(),
  deleteForUndo: vi.fn(),
  pasteEvent: vi.fn(),
}));

const ZONE = "Europe/Madrid";
const S = "11111111-1111-4111-8111-111111111111";
const CAL = "22222222-2222-4222-8222-222222222222";
const GOOGLE = "33333333-3333-4333-8333-333333333333";
const READER = "44444444-4444-4444-8444-444444444444";
const SINGLE = "55555555-5555-4555-8555-555555555555";
const EXCEPTION = "66666666-6666-4666-8666-666666666666";
const ON_GOOGLE = "77777777-7777-4777-8777-777777777777";

const NOV2 = occurrenceId(S, "2026-11-02T17:00:00.000Z");
const NOV9 = "2026-11-09T17:00:00.000Z";

const synced = (canWrite: boolean) => ({
  lastSyncedAt: null,
  accountEmail: null,
  connectionId: "c1",
  canWrite,
  googleAccess: canWrite ? ("owner" as const) : ("reader" as const),
  provider: "google" as const,
});

const event = (id: string, calendarId: string, extra = {}) => ({
  id,
  calendarId,
  title: "Inglés",
  startsAt: "2026-11-02T17:00:00.000Z",
  endsAt: "2026-11-02T18:00:00.000Z",
  allDay: false,
  color: null,
  categoryId: null,
  location: null,
  description: null,
  imageCount: 0,
  commentCount: 0,
  seriesId: null,
  createdBy: null,
  createdByName: null,
  seriesSummary: null,
  seriesChanged: false,
  ...extra,
});

const copy = {
  userId: "u1",
  profile: { timeZone: ZONE },
  range: { from: "2026-10-01", to: "2026-12-31" },
  calendars: [
    { id: CAL, name: "Casa", color: null, role: "owner", synced: null },
    {
      id: GOOGLE,
      name: "Trabajo",
      color: null,
      role: "editor",
      synced: synced(true),
    },
    {
      id: READER,
      name: "Festivos",
      color: null,
      role: "owner",
      synced: synced(false),
    },
  ],
  events: [
    event(NOV2, CAL, { seriesId: S }),
    // A changed occurrence of 9 November, with an image and a comment.
    event(EXCEPTION, CAL, {
      seriesId: S,
      startsAt: NOV9,
      endsAt: "2026-11-09T18:30:00.000Z",
    }),
    event(SINGLE, CAL),
    event(ON_GOOGLE, GOOGLE),
    event("festivo", READER),
  ],
  series: [
    {
      id: S,
      calendarId: CAL,
      title: "Inglés",
      description: null,
      location: null,
      color: null,
      categoryId: null,
      startsAt: "2026-10-05T16:00:00.000Z",
      endsAt: "2026-10-05T17:00:00.000Z",
      allDay: false,
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      recurrenceTz: ZONE,
      recurrenceUntil: null,
      exdates: [],
      totals: { exceptions: 1, images: 1, comments: 1, latest: null },
    },
  ],
  exceptions: [{ id: EXCEPTION, seriesId: S, originalStart: NOV9 }],
  images: [{ id: "i1", eventId: EXCEPTION }],
  comments: [{ id: "k1", eventId: EXCEPTION }],
  notes: [],
} as unknown as Snapshot;

const changes = () => getQueueState().queue.map((entry) => entry.change);

function form(fields: Record<string, string>) {
  const data = new FormData();
  const all = {
    title: "Inglés",
    calendarId: CAL,
    startDate: "2026-11-02",
    startTime: "18:00",
    endDate: "2026-11-02",
    endTime: "19:30",
    repeat: "none",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) data.append(key, value);
  return data;
}

const neverOnline = vi.fn(async () => {
  throw new Error("not offline");
});
const EMPTY = { values: {} } as never;

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
  await setSnapshot(copy);
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(async () => {
  resetConnection();
  await setSnapshot(null);
  vi.unstubAllGlobals();
});

describe("series offline (RF-10, RF-13)", () => {
  it("'Todos los eventos' asks to confirm what the copy says is lost", async () => {
    const save = eventFormOrQueue(neverOnline, NOV2);
    const asked = await save(EMPTY, form({ scope: "all", repeat: "daily" }));
    expect(asked).toMatchObject({
      loss: { exceptions: 1, images: 1, comments: 1 },
    });
    expect(changes()).toEqual([]);

    const saved = await save(
      EMPTY,
      form({ scope: "all", repeat: "daily", confirmLoss: "1" }),
    );
    expect(saved).toMatchObject({ done: "updated" });
    expect(changes()).toEqual([
      expect.objectContaining({
        type: "series.update",
        id: NOV2,
        scope: "all",
        repeat: "daily",
        base: expect.objectContaining({
          recurrence: copy.series[0]!.recurrence,
        }),
      }),
    ]);
  });

  it("'Este y los siguientes' that loses nothing is saved at once", async () => {
    const save = eventFormOrQueue(neverOnline, NOV2);
    // From 2 November the exception of the 9th stays: only the title changes.
    const result = await save(
      EMPTY,
      form({
        scope: "following",
        title: "Inglés B2",
        repeat: `custom:${copy.series[0]!.recurrence}`,
      }),
    );
    expect(result).toMatchObject({ done: "updated" });
    expect(changes()[0]).toMatchObject({
      type: "series.update",
      scope: "following",
      data: expect.objectContaining({ title: "Inglés B2" }),
    });
  });

  it("deleting the whole series from the detail confirms first", async () => {
    const remove = deleteFromDetailOrQueue(NOV2, neverOnline);
    const data = new FormData();
    data.append("scope", "all");
    expect(await remove({}, data)).toMatchObject({
      loss: { exceptions: 1 },
    });
    data.append("confirmLoss", "1");
    expect(await remove({}, data)).toMatchObject({ done: "deleted" });
    expect(changes()).toEqual([
      expect.objectContaining({ type: "series.delete", scope: "all" }),
    ]);
  });

  it("dragging an occurrence in a wider scope moves the series", async () => {
    const result = await quickChangeOrQueue(
      NOV2,
      {
        kind: "times",
        startsAt: "2026-11-02T18:00:00.000Z",
        endsAt: "2026-11-02T19:00:00.000Z",
        allDay: false,
      },
      { scope: "following", confirmLoss: true },
    );
    expect(result).toMatchObject({ ok: true });
    expect(changes()[0]).toMatchObject({
      type: "series.update",
      scope: "following",
      repeat: `custom:${copy.series[0]!.recurrence}`,
    });
  });

  it("'Solo este evento' stays a change of that occurrence", async () => {
    await deleteOrQueue(NOV2, { scope: "this" });
    expect(changes()).toEqual([
      expect.objectContaining({ type: "event.delete", id: NOV2 }),
    ]);
  });
});

describe("'Repetir' offline (RF-11)", () => {
  it("creates a series", async () => {
    const result = await eventFormOrQueue(neverOnline)(
      EMPTY,
      form({ repeat: "weekly" }),
    );
    expect(result).toMatchObject({ done: "created" });
    expect(changes()[0]).toMatchObject({
      type: "event.create",
      repeat: "weekly",
    });
  });

  it("turns a single event into a series", async () => {
    await eventFormOrQueue(neverOnline, SINGLE)(
      EMPTY,
      form({ repeat: "daily" }),
    );
    expect(changes()[0]).toMatchObject({
      type: "event.update",
      id: SINGLE,
      repeat: "daily",
    });
  });

  it("refuses a rule that does not parse, as the server would", async () => {
    const result = await eventFormOrQueue(neverOnline)(
      EMPTY,
      form({ repeat: "custom:nope" }),
    );
    expect(result).toMatchObject({
      fieldErrors: { repeat: "Elige una repetición válida." },
    });
    expect(changes()).toEqual([]);
  });
});

describe("Google and iCloud offline (RF-1, RF-2)", () => {
  it("a writable synced calendar takes the change", async () => {
    const result = await eventFormOrQueue(neverOnline, ON_GOOGLE)(
      EMPTY,
      form({ calendarId: GOOGLE, title: "Reunión" }),
    );
    expect(result).toMatchObject({ done: "updated" });
    expect(changes()[0]).toMatchObject({ type: "event.update", id: ON_GOOGLE });
  });

  it("a read-only one says why, as with a connection", async () => {
    const result = await eventFormOrQueue(neverOnline)(
      EMPTY,
      form({ calendarId: READER }),
    );
    expect(result).toMatchObject({
      formError: expect.stringMatching(/solo puede ver este calendario/),
    });
    expect(changes()).toEqual([]);
  });
});
