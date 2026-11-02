// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 019, T9: the rest of the detail card, read after it opens (RF-4, RF-5, RF-7; plan D9).
const EVENT_ID = "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10";

const h = vi.hoisted(() => ({
  event: null as Record<string, unknown> | null,
  calendar: null as Record<string, unknown> | null,
  members: [] as { userId: string; name: string }[],
  getEvent: vi.fn(),
}));

vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: {}, userId: "me" }),
  getEvent: async (_client: unknown, id: string) => {
    h.getEvent(id);
    return h.event;
  },
  getCalendar: async () => h.calendar,
}));
vi.mock("@/lib/sharing/queries", () => ({
  getMembers: async () => h.members,
}));

const { loadEventCard } = await import("@/app/dashboard/events/card-actions");

const CALENDAR = {
  id: "cal",
  name: "Familia",
  role: "editor",
  synced: null,
};

beforeEach(() => {
  h.getEvent.mockClear();
  h.members = [{ userId: "ana", name: "Ana" }];
  h.calendar = { ...CALENDAR };
  h.event = {
    id: EVENT_ID,
    rowId: EVENT_ID,
    calendarId: "cal",
    description: "Traer postre",
    createdBy: "ana",
    series: null,
  };
});

describe("loadEventCard", () => {
  it("returns the description, the author and whether the user can edit", async () => {
    expect(await loadEventCard(EVENT_ID)).toEqual({
      description: "Traer postre",
      author: "Ana",
      repeat: null,
      readOnly: null,
      provider: undefined,
      canEdit: true,
    });
  });

  it("names a gone author as the detail does", async () => {
    h.event = { ...h.event, createdBy: null };
    expect(await loadEventCard(EVENT_ID)).toMatchObject({
      author: "Cuenta borrada",
    });
    h.event = { ...h.event, createdBy: "left" };
    expect(await loadEventCard(EVENT_ID)).toMatchObject({
      author: "un antiguo miembro",
    });
  });

  it("gives the rule of an occurrence", async () => {
    h.event = {
      ...h.event,
      id: `${EVENT_ID}_20261102T090000Z`,
      rowId: null,
      series: { summary: "Cada semana", changed: false, exceptions: 0 },
    };
    expect(await loadEventCard(`${EVENT_ID}_20261102T090000Z`)).toMatchObject({
      repeat: { summary: "Cada semana", changed: false, limitReached: false },
    });
  });

  it("tells a reader cannot edit, and why a synced calendar is read-only", async () => {
    h.calendar = { ...CALENDAR, role: "viewer" };
    expect(await loadEventCard(EVENT_ID)).toMatchObject({ canEdit: false });
    h.calendar = {
      ...CALENDAR,
      role: "owner",
      synced: { provider: "icloud", canWrite: false, googleAccess: "reader" },
    };
    expect(await loadEventCard(EVENT_ID)).toMatchObject({
      canEdit: false,
      provider: "icloud",
      readOnly: "provider",
    });
  });

  it("says gone for a foreign, deleted or malformed id", async () => {
    h.event = null;
    expect(await loadEventCard(EVENT_ID)).toEqual({ gone: true });
    expect(await loadEventCard("nope")).toEqual({ gone: true });
    expect(h.getEvent).toHaveBeenCalledTimes(1);
  });
});
