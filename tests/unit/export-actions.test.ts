// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Spec 049, T5: the export reads only with the user's session and never puts
// in other people's emails, ids or secrets (RF-13, RF-14).
const getMembers = vi.hoisted(() => vi.fn());

/** A query builder that answers `rows` for a table, whatever the filters. */
function table(rows: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "in"]) {
    chain[method] = () => chain;
  }
  chain.single = async () => ({ data: rows, error: null });
  chain.then = (resolve: (value: unknown) => void) =>
    resolve({ data: rows, error: null });
  return chain;
}

const TABLES: Record<string, unknown> = {
  profiles: { display_name: "Ana", time_zone: "Europe/Madrid", theme: "dark" },
  calendar_members: [
    {
      role: "owner",
      calendars: {
        id: "c1",
        name: "Familia",
        description: null,
        color: "#7c3aed",
        event_categories: [{ name: "Cole" }],
      },
    },
  ],
  event_comments: [
    {
      body: "Llevo pan",
      created_at: "t",
      edited_at: null,
      events: { title: "Cena", starts_at: "s" },
    },
  ],
  notes: [
    {
      kind: "list",
      title: "Compra",
      calendars: null,
      note_items: [
        { text: "pan", done: false, position: 2 },
        { text: "leche", done: true, position: 1 },
      ],
    },
  ],
  event_images: [
    { object_id: "o1", event_id: "e1", events: { title: "Cena" } },
  ],
};

vi.mock("@/lib/sharing/queries", () => ({ getMembers }));
vi.mock("@/lib/calendar/queries", () => ({
  allRows: async (
    page: (first: number, last: number) => PromiseLike<{ data: unknown[] }>,
  ) => (await page(0, 999)).data,
  requireActionUser: async () => ({
    userId: "me",
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { email: "ana@gmail.com" } } }),
      },
      from: (name: string) => table(TABLES[name]),
    },
  }),
}));

const { loadAccountExport } =
  await import("@/app/dashboard/settings/export-actions");

describe("loadAccountExport", () => {
  it("collects the own data, members only by name", async () => {
    getMembers.mockResolvedValue([
      { calendarId: "c1", userId: "u2", name: "Luis", role: "editor" },
    ]);
    const data = await loadAccountExport();
    expect(data?.profile).toMatchObject({
      name: "Ana",
      email: "ana@gmail.com",
    });
    expect(data?.calendars[0]).toMatchObject({
      name: "Familia",
      role: "owner",
      categories: ["Cole"],
      members: [{ name: "Luis", role: "editor" }],
    });
    expect(JSON.stringify(data?.calendars)).not.toContain("u2");
    expect(data?.comments).toEqual([
      {
        body: "Llevo pan",
        createdAt: "t",
        editedAt: null,
        event: { title: "Cena", startsAt: "s" },
      },
    ]);
    expect(data?.notes[0]).toMatchObject({
      title: "Compra",
      calendar: null,
      items: [
        { text: "leche", done: true },
        { text: "pan", done: false },
      ],
    });
    expect(data?.images).toEqual([
      { objectId: "o1", eventId: "e1", eventTitle: "Cena" },
    ]);
  });
});
