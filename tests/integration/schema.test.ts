import { afterAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

const createdUsers: TestUser[] = [];

async function newUser(metadata: Record<string, unknown>): Promise<TestUser> {
  const user = await createTestUser(metadata);
  createdUsers.push(user);
  return user;
}

async function getProfile(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, time_zone")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

afterAll(async () => {
  await Promise.all(createdUsers.map((user) => deleteTestUser(user.id)));
});

describe("base schema", () => {
  it("creates profile, 'Mi calendario' and owner membership on sign-up (RF-4)", async () => {
    const user = await newUser({ display_name: "Ana" });

    const profile = await getProfile(user.id);
    expect(profile.display_name).toBe("Ana");

    const { data: calendars } = await admin
      .from("calendars")
      .select("id, name, color")
      .eq("owner_id", user.id);
    expect(calendars).toHaveLength(1);
    expect(calendars?.[0]).toMatchObject({
      name: "Mi calendario",
      color: "#A0C4FF",
    });

    const { data: members } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", calendars?.[0]?.id ?? "");
    expect(members).toEqual([{ user_id: user.id, role: "owner" }]);
  });

  it("stores the time zone sent in the sign-up metadata (RF-26)", async () => {
    const user = await newUser({
      display_name: "Bea",
      time_zone: "America/Bogota",
    });

    expect((await getProfile(user.id)).time_zone).toBe("America/Bogota");
  });

  it("falls back to Europe/Madrid when the time zone is missing (RF-26)", async () => {
    const user = await newUser({ display_name: "Carlos" });

    expect((await getProfile(user.id)).time_zone).toBe("Europe/Madrid");
  });

  it("falls back to Europe/Madrid and still creates the user with an invalid time zone (RF-26)", async () => {
    const user = await newUser({
      display_name: "Dani",
      time_zone: "Marte/Olympus",
    });

    expect((await getProfile(user.id)).time_zone).toBe("Europe/Madrid");
  });

  it("rejects updating a profile to an invalid time zone", async () => {
    const user = await newUser({ display_name: "Eva" });

    const { error } = await admin
      .from("profiles")
      .update({ time_zone: "Marte/Olympus" })
      .eq("id", user.id);

    expect(error).not.toBeNull();
    expect((await getProfile(user.id)).time_zone).toBe("Europe/Madrid");
  });

  it("rejects an event that ends before it starts", async () => {
    const user = await newUser({ display_name: "Fran" });
    const calendarId = await getOwnCalendarId(user.id);

    const { error } = await admin.from("events").insert({
      calendar_id: calendarId,
      title: "Al revés",
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T09:00:00Z",
    });

    expect(error?.code).toBe("23514");
  });

  it("cascades the deletion of a user to profile, calendars, members and events", async () => {
    const user = await createTestUser({ display_name: "Gema" });
    const calendarId = await getOwnCalendarId(user.id);
    const { error: insertError } = await admin.from("events").insert({
      calendar_id: calendarId,
      title: "Cumpleaños",
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
      created_by: user.id,
    });
    expect(insertError).toBeNull();

    await deleteTestUser(user.id);

    const counts = await Promise.all([
      admin.from("profiles").select("id").eq("id", user.id),
      admin.from("calendars").select("id").eq("id", calendarId),
      admin.from("calendar_members").select("user_id").eq("user_id", user.id),
      admin.from("events").select("id").eq("calendar_id", calendarId),
    ]);
    for (const { data, error } of counts) {
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});
