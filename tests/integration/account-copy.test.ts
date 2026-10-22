import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T6: each member who keeps a shared calendar gets a full copy of it
// (plan D9; RF-28, RF-20). The function is internal: only the scheduled job
// (postgres) and this test (service role) call it.
let ana: TestUser; // original owner
let bea: TestUser; // keeps a copy
let cy: TestUser; // member of the original, gets no copy here
let calendarId: string;
let copyId: string;

beforeAll(async () => {
  [ana, bea, cy] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Cy" }),
  ]);

  const { data: cal } = await admin
    .from("calendars")
    .insert({
      owner_id: ana.id,
      name: "Familia",
      description: "Plan del año",
      color: "#A0C4FF",
    })
    .select("id")
    .single();
  calendarId = cal!.id;

  await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: bea.id, role: "editor" },
    { calendar_id: calendarId, user_id: cy.id, role: "viewer" },
  ]);

  const { data: category } = await admin
    .from("event_categories")
    .insert({ calendar_id: calendarId, name: "Deporte" })
    .select("id")
    .single();

  const { error: eventsError } = await admin.from("events").insert([
    {
      calendar_id: calendarId,
      title: "Partido",
      all_day: false,
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
      category_id: category!.id,
      created_by: ana.id,
    },
    {
      calendar_id: calendarId,
      title: "Cumpleaños de Bea",
      starts_at: "2026-11-05T00:00:00Z",
      ends_at: "2026-11-06T00:00:00Z",
      all_day: true,
      created_by: bea.id,
    },
  ]);

  const { error: invitesError } = await admin.from("calendar_invites").insert({
    calendar_id: calendarId,
    token_hash: "\\x0102030405",
    role: "viewer",
    max_uses: 1,
    created_by: ana.id,
    expires_at: "2099-01-01T00:00:00Z",
  });

  expect(eventsError).toBeNull();
  expect(invitesError).toBeNull();

  const { data, error } = await admin.rpc("copy_calendar_for_owner", {
    p_calendar_id: calendarId,
    p_user_id: bea.id,
  });
  expect(error).toBeNull();
  copyId = data as string;
});

afterAll(async () => {
  await admin
    .from("calendars")
    .delete()
    .in("id", [calendarId, copyId].filter(Boolean));
  await Promise.all(
    [ana, bea, cy].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("copy_calendar_for_owner (RF-28, RF-20)", () => {
  it("the copy belongs to the member who keeps it, with the same name, description and color", async () => {
    const { data } = await admin
      .from("calendars")
      .select("name, description, color, owner_id")
      .eq("id", copyId)
      .single();
    expect(data).toEqual({
      name: "Familia",
      description: "Plan del año",
      color: "#A0C4FF",
      owner_id: bea.id,
    });
  });

  it("the new owner has the owner membership, and nobody else is a member", async () => {
    const { data } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", copyId);
    expect(data).toEqual([{ user_id: bea.id, role: "owner" }]);
  });

  it("copies the categories with their own ids", async () => {
    const { data: original } = await admin
      .from("event_categories")
      .select("id, name")
      .eq("calendar_id", calendarId);
    const { data: copied } = await admin
      .from("event_categories")
      .select("id, name")
      .eq("calendar_id", copyId);
    expect(copied?.map((c) => c.name)).toEqual(["Deporte"]);
    expect(copied![0].id).not.toBe(original![0].id);
  });

  it("copies every event, keeping its authorship and pointing to the copied category", async () => {
    const { data: copied } = await admin
      .from("events")
      .select("title, starts_at, all_day, created_by, category_id")
      .eq("calendar_id", copyId);
    const { data: copiedCategory } = await admin
      .from("event_categories")
      .select("id")
      .eq("calendar_id", copyId)
      .single();

    expect(copied).toHaveLength(2);
    expect(copied).toContainEqual({
      title: "Partido",
      starts_at: "2026-11-02T10:00:00+00:00",
      all_day: false,
      created_by: ana.id,
      category_id: copiedCategory!.id,
    });
    expect(copied).toContainEqual(
      expect.objectContaining({
        title: "Cumpleaños de Bea",
        all_day: true,
        created_by: bea.id,
        category_id: null,
      }),
    );
  });

  it("does not copy invitations and leaves the original untouched", async () => {
    const { data: invites } = await admin
      .from("calendar_invites")
      .select("id")
      .eq("calendar_id", copyId);
    expect(invites).toEqual([]);

    const { data: original } = await admin
      .from("events")
      .select("id")
      .eq("calendar_id", calendarId);
    expect(original).toHaveLength(2);
  });

  it("fails without leaving anything behind for an unknown calendar (P0002)", async () => {
    const before = await admin
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", bea.id);

    const { error } = await admin.rpc("copy_calendar_for_owner", {
      p_calendar_id: "00000000-0000-4000-8000-00000000dead",
      p_user_id: bea.id,
    });
    expect(error?.code).toBe("P0002");

    const after = await admin
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", bea.id);
    expect(after.count).toBe(before.count);
  });
});
