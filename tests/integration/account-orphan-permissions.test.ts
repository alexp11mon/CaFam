import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 006, T22: a calendar without owner keeps each member's permissions until
// the decision is applied (RF-22).
let ana: TestUser; // deletes the account
let bea: TestUser; // editor
let cy: TestUser; // viewer
let calendarId: string;

function newEvent(user: TestUser) {
  return user.client.from("events").insert({
    calendar_id: calendarId,
    title: "Reunión",
    starts_at: "2026-11-20T10:00:00Z",
    ends_at: "2026-11-20T11:00:00Z",
    all_day: false,
    created_by: user.id,
  });
}

beforeAll(async () => {
  [ana, bea, cy] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
    createTestUser({ display_name: "Cy" }),
  ]);
  const { data: cal } = await admin
    .from("calendars")
    .insert({ owner_id: ana.id, name: "Familia" })
    .select("id")
    .single();
  calendarId = cal!.id;
  const { error: membersError } = await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: bea.id, role: "editor" },
    { calendar_id: calendarId, user_id: cy.id, role: "viewer" },
  ]);
  expect(membersError).toBeNull();
  const { error } = await ana.client.rpc("delete_own_account");
  expect(error).toBeNull();
});

afterAll(async () => {
  await deleteTestMail();
  await admin.from("calendars").delete().eq("id", calendarId);
  await Promise.all(
    [bea, cy].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("permissions on a calendar without owner (RF-22)", () => {
  it("an editor can still create events", async () => {
    const { error } = await newEvent(bea);
    expect(error).toBeNull();
  });

  it("a viewer still cannot create events", async () => {
    const { error } = await newEvent(cy);
    expect(error?.code).toBe("42501");
  });

  it("nobody can rename the calendar or change its color", async () => {
    for (const member of [bea, cy]) {
      const { data } = await member.client
        .from("calendars")
        .update({ name: "Cambiado", color: "#FFADAD" })
        .eq("id", calendarId)
        .select("id");
      expect(data).toEqual([]);
    }

    const { data: check } = await admin
      .from("calendars")
      .select("name")
      .eq("id", calendarId)
      .single();
    expect(check?.name).toBe("Familia");
  });
});
