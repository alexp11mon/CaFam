import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  TEST_PASSWORD,
  type TestUser,
} from "./helpers";

// Spec 002, T10: how the preference upserts behave in the database
// (RF-43, RF-45, RF-46, RF-48).
let owner: TestUser;
let viewer: TestUser;
let calendarId: string;

beforeAll(async () => {
  [owner, viewer] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Lectora" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: viewer.id, role: "viewer" });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, viewer].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

const CONFLICT = { onConflict: "user_id,calendar_id" };

describe("calendar preference upserts", () => {
  it("a visibility change keeps the saved position and vice versa", async () => {
    const first = await viewer.client
      .from("calendar_preferences")
      .upsert(
        { user_id: viewer.id, calendar_id: calendarId, position: 3 },
        CONFLICT,
      );
    const second = await viewer.client
      .from("calendar_preferences")
      .upsert(
        { user_id: viewer.id, calendar_id: calendarId, visible: false },
        CONFLICT,
      );

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const { data } = await admin
      .from("calendar_preferences")
      .select("visible, position")
      .eq("user_id", viewer.id)
      .eq("calendar_id", calendarId)
      .single();
    expect(data).toEqual({ visible: false, position: 3 });
  });

  it("a new row without visible defaults to visible (RF-47)", async () => {
    const { error } = await owner.client
      .from("calendar_preferences")
      .upsert(
        { user_id: owner.id, calendar_id: calendarId, position: 0 },
        CONFLICT,
      );

    expect(error).toBeNull();
    const { data } = await admin
      .from("calendar_preferences")
      .select("visible")
      .eq("user_id", owner.id)
      .single();
    expect(data?.visible).toBe(true);
  });

  it("is recovered by another session of the same user (RF-46)", async () => {
    const otherDevice = anonClient();
    const { error: signInError } = await otherDevice.auth.signInWithPassword({
      email: viewer.email,
      password: TEST_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { data } = await otherDevice
      .from("calendar_preferences")
      .select("calendar_id, visible, position")
      .eq("user_id", viewer.id);

    expect(data).toEqual([
      { calendar_id: calendarId, visible: false, position: 3 },
    ]);
  });

  it("is private: another user sees none of it and cannot overwrite it (RF-48)", async () => {
    const seen = await owner.client
      .from("calendar_preferences")
      .select("visible")
      .eq("user_id", viewer.id);
    const forged = await owner.client
      .from("calendar_preferences")
      .upsert(
        { user_id: viewer.id, calendar_id: calendarId, visible: true },
        CONFLICT,
      );

    expect(seen.data).toEqual([]);
    expect(forged.error?.code).toBe("42501");
    const { data } = await admin
      .from("calendar_preferences")
      .select("visible")
      .eq("user_id", viewer.id)
      .single();
    expect(data?.visible).toBe(false);
  });
});

describe("person preference upserts", () => {
  it("saves the order of people per user", async () => {
    const { error } = await viewer.client.from("person_preferences").upsert(
      [
        { user_id: viewer.id, person_id: owner.id, position: 0 },
        { user_id: viewer.id, person_id: viewer.id, position: 1 },
      ],
      { onConflict: "user_id,person_id" },
    );

    expect(error).toBeNull();
    const { data } = await viewer.client
      .from("person_preferences")
      .select("person_id, position")
      .order("position");
    expect(data).toEqual([
      { person_id: owner.id, position: 0 },
      { person_id: viewer.id, position: 1 },
    ]);
  });
});
