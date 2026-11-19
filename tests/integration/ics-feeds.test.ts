import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 043, T3: the subscription link (RF-7..RF-11, RNF-3).
let owner: TestUser;
let editor: TestUser;
let calendarId: string;

async function newCalendar(name: string): Promise<string> {
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function create(id: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_ics_feed", {
    p_calendar_id: id,
  });
  if (error) throw error;
  return data;
}

const feed = (token: string) =>
  anonClient().rpc("ics_feed", { p_token: token });

beforeAll(async () => {
  [owner, editor] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Editor" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: editor.id, role: "editor" });
  const { error } = await admin.from("events").insert([
    {
      calendar_id: calendarId,
      created_by: owner.id,
      title: "Reciente",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 90_000_000).toISOString(),
    },
    {
      calendar_id: calendarId,
      created_by: owner.id,
      title: "Antiguo",
      starts_at: "2020-01-01T10:00:00Z",
      ends_at: "2020-01-01T11:00:00Z",
    },
    {
      calendar_id: calendarId,
      created_by: owner.id,
      title: "Serie antigua viva",
      starts_at: "2020-01-06T17:00:00Z",
      ends_at: "2020-01-06T18:00:00Z",
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      recurrence_tz: "Europe/Madrid",
    },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("calendar feeds", () => {
  it("only the owner creates a link, and the token reads the calendar", async () => {
    const { error } = await editor.client.rpc("create_ics_feed", {
      p_calendar_id: calendarId,
    });
    expect(error?.code).toBe("CF404");

    const token = await create(calendarId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { data, error: feedError } = await feed(token);
    expect(feedError).toBeNull();
    const result = data as { name: string; rows: { title: string }[] };
    expect(result.name).toBeTruthy();
    expect(result.rows.map((row) => row.title).sort()).toEqual([
      "Reciente",
      "Serie antigua viva",
    ]);
  });

  it("never shows the hash; the owner sees that there is a link", async () => {
    const hash = await owner.client
      .from("calendar_feeds")
      .select("token_hash")
      .eq("calendar_id", calendarId);
    expect(hash.error?.code).toBe("42501");
    const own = await owner.client
      .from("calendar_feeds")
      .select("calendar_id, created_at")
      .eq("calendar_id", calendarId);
    expect(own.data).toHaveLength(1);
    const other = await editor.client
      .from("calendar_feeds")
      .select("calendar_id")
      .eq("calendar_id", calendarId);
    expect(other.data).toHaveLength(0);
  });

  it("a new link invalidates the old one, and disabling revokes it", async () => {
    const old = await create(calendarId);
    const fresh = await create(calendarId);
    expect((await feed(old)).error?.code).toBe("CF404");
    expect((await feed(fresh)).error).toBeNull();

    const { error } = await editor.client.rpc("disable_ics_feed", {
      p_calendar_id: calendarId,
    });
    expect(error?.code).toBe("CF404");
    await owner.client.rpc("disable_ics_feed", { p_calendar_id: calendarId });
    expect((await feed(fresh)).error?.code).toBe("CF404");
    expect((await feed("nope")).error?.code).toBe("CF404");
  });

  it("deleting, merging or orphaning the calendar ends the link", async () => {
    const deleted = await newCalendar("Borrado");
    const deletedToken = await create(deleted);
    await admin.from("calendars").delete().eq("id", deleted);
    expect((await feed(deletedToken)).error?.code).toBe("CF404");

    const source = await newCalendar("Origen");
    const target = await newCalendar("Destino");
    const sourceToken = await create(source);
    const { error: mergeError } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [source, target],
      p_target_id: target,
      p_name: "Destino",
      p_color: "#A0C4FF",
    });
    expect(mergeError).toBeNull();
    expect((await feed(sourceToken)).error?.code).toBe("CF404");

    // A shared calendar is left without an owner when its owner leaves (spec 006).
    const leaving = await createTestUser({ display_name: "Se va" });
    const orphan = await getOwnCalendarId(leaving.id);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: orphan, user_id: editor.id, role: "viewer" });
    const { data: orphanToken, error: tokenError } = await leaving.client.rpc(
      "create_ics_feed",
      { p_calendar_id: orphan },
    );
    expect(tokenError).toBeNull();
    expect((await feed(orphanToken!)).error).toBeNull();
    const { error: deleteError } =
      await leaving.client.rpc("delete_own_account");
    expect(deleteError).toBeNull();
    expect((await feed(orphanToken!)).error?.code).toBe("CF404");
    const { data: left } = await admin
      .from("calendar_feeds")
      .select("calendar_id")
      .eq("calendar_id", orphan);
    expect(left).toEqual([]);
    await admin.from("calendars").delete().eq("id", orphan);
    await deleteTestMail();
  });

  it("answers CF429 after 60 calls in an hour", async () => {
    const id = await newCalendar("Limitado");
    const token = await create(id);
    await admin
      .from("calendar_feeds")
      .update({ hits: 59, hits_window: new Date().toISOString() })
      .eq("calendar_id", id);
    expect((await feed(token)).error).toBeNull();
    expect((await feed(token)).error?.code).toBe("CF429");
    // An old window starts again.
    await admin
      .from("calendar_feeds")
      .update({
        hits: 60,
        hits_window: new Date(Date.now() - 7_200_000).toISOString(),
      })
      .eq("calendar_id", id);
    expect((await feed(token)).error).toBeNull();
  });
});
