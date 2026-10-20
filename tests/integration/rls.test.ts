import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Permission matrix from the plan ("Políticas RLS"): RF-15..RF-20.
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let calendarId: string;
let eventId: string;

const EVENT_TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

async function adminEventTitle(id: string): Promise<string | undefined> {
  const { data } = await admin
    .from("events")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return data?.title;
}

beforeAll(async () => {
  [owner, editor, viewer, outsider] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Ajena" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);

  const { error: membersError } = await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: editor.id, role: "editor" },
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
  ]);
  if (membersError) throw membersError;

  const { data, error } = await owner.client
    .from("events")
    .insert({ calendar_id: calendarId, title: "Cena", ...EVENT_TIMES })
    .select("id")
    .single();
  if (error) throw error;
  eventId = data.id;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, outsider]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("RLS is enabled on every public table (P3)", () => {
  it("has no table in public without row level security", async () => {
    const { data, error } = await admin.rpc("list_tables_without_rls");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("outsider (RF-15)", () => {
  it("does not see the calendar, its members or its events", async () => {
    const [calendars, members, events] = await Promise.all([
      outsider.client.from("calendars").select("id").eq("id", calendarId),
      outsider.client
        .from("calendar_members")
        .select("user_id")
        .eq("calendar_id", calendarId),
      outsider.client.from("events").select("id").eq("calendar_id", calendarId),
    ]);

    expect(calendars.data).toEqual([]);
    expect(members.data).toEqual([]);
    expect(events.data).toEqual([]);
  });

  it("cannot create events in the calendar", async () => {
    const { error } = await outsider.client
      .from("events")
      .insert({ calendar_id: calendarId, title: "Intrusa", ...EVENT_TIMES });

    expect(error?.code).toBe("42501");
  });
});

describe("viewer (RF-16)", () => {
  it("sees the calendar, its members and its events", async () => {
    const [calendars, members, events] = await Promise.all([
      viewer.client.from("calendars").select("id").eq("id", calendarId),
      viewer.client
        .from("calendar_members")
        .select("user_id")
        .eq("calendar_id", calendarId),
      viewer.client.from("events").select("id").eq("calendar_id", calendarId),
    ]);

    expect(calendars.data).toHaveLength(1);
    expect(members.data).toHaveLength(3);
    expect(events.data?.map((event) => event.id)).toContain(eventId);
  });

  it("cannot create events", async () => {
    const { error } = await viewer.client
      .from("events")
      .insert({ calendar_id: calendarId, title: "Lectora", ...EVENT_TIMES });

    expect(error?.code).toBe("42501");
  });

  it("cannot modify events", async () => {
    const { data } = await viewer.client
      .from("events")
      .update({ title: "Cambiado" })
      .eq("id", eventId)
      .select("id");

    expect(data).toEqual([]);
    expect(await adminEventTitle(eventId)).toBe("Cena");
  });

  it("cannot delete events", async () => {
    const { data } = await viewer.client
      .from("events")
      .delete()
      .eq("id", eventId)
      .select("id");

    expect(data).toEqual([]);
    expect(await adminEventTitle(eventId)).toBe("Cena");
  });
});

describe("editor (RF-17)", () => {
  it("creates, modifies and deletes events", async () => {
    const created = await editor.client
      .from("events")
      .insert({ calendar_id: calendarId, title: "Excursión", ...EVENT_TIMES })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const id = created.data?.id ?? "";

    const updated = await editor.client
      .from("events")
      .update({ title: "Excursión al lago" })
      .eq("id", id)
      .select("title");
    expect(updated.data).toEqual([{ title: "Excursión al lago" }]);

    const deleted = await editor.client
      .from("events")
      .delete()
      .eq("id", id)
      .select("id");
    expect(deleted.data).toEqual([{ id }]);
    expect(await adminEventTitle(id)).toBeUndefined();
  });

  it("cannot move an event to a calendar where it is not editor", async () => {
    const outsiderCalendarId = await getOwnCalendarId(outsider.id);

    const { data } = await editor.client
      .from("events")
      .update({ calendar_id: outsiderCalendarId })
      .eq("id", eventId)
      .select("id");

    expect(data ?? []).toEqual([]);
  });
});

describe("calendars (RF-18)", () => {
  it("only the owner modifies the calendar", async () => {
    const byEditor = await editor.client
      .from("calendars")
      .update({ name: "De la editora" })
      .eq("id", calendarId)
      .select("id");
    expect(byEditor.data).toEqual([]);

    const byOwner = await owner.client
      .from("calendars")
      .update({ color: "#A6E1FA" })
      .eq("id", calendarId)
      .select("color");
    expect(byOwner.data).toEqual([{ color: "#A6E1FA" }]);
  });

  it("the owner cannot hand the calendar over by changing owner_id", async () => {
    const { error } = await owner.client
      .from("calendars")
      .update({ owner_id: editor.id })
      .eq("id", calendarId);

    expect(error).not.toBeNull();
  });

  it("users create calendars only for themselves", async () => {
    const forOther = await editor.client
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Ajeno" });
    expect(forOther.error?.code).toBe("42501");

    const own = await editor.client
      .from("calendars")
      .insert({ owner_id: editor.id, name: "Trabajo" })
      .select("id")
      .single();
    expect(own.error).toBeNull();
  });

  it("only the owner deletes the calendar", async () => {
    const { data: created } = await owner.client
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Temporal" })
      .select("id")
      .single();
    const tempId = created?.id ?? "";
    await admin
      .from("calendar_members")
      .insert({ calendar_id: tempId, user_id: editor.id, role: "editor" });

    const byEditor = await editor.client
      .from("calendars")
      .delete()
      .eq("id", tempId)
      .select("id");
    expect(byEditor.data).toEqual([]);

    const byOwner = await owner.client
      .from("calendars")
      .delete()
      .eq("id", tempId)
      .select("id");
    expect(byOwner.data).toEqual([{ id: tempId }]);
  });
});

describe("calendar_members (RF-19)", () => {
  it("nobody inserts memberships, not even the owner", async () => {
    const byOutsider = await outsider.client.from("calendar_members").insert({
      calendar_id: calendarId,
      user_id: outsider.id,
      role: "editor",
    });
    expect(byOutsider.error?.code).toBe("42501");

    const byOwner = await owner.client.from("calendar_members").insert({
      calendar_id: calendarId,
      user_id: outsider.id,
      role: "viewer",
    });
    expect(byOwner.error?.code).toBe("42501");
  });

  it("nobody modifies or deletes memberships", async () => {
    const promote = await viewer.client
      .from("calendar_members")
      .update({ role: "editor" })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .select("role");
    expect(promote.data ?? []).toEqual([]);

    const remove = await owner.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .select("user_id");
    expect(remove.data ?? []).toEqual([]);

    const { data } = await admin
      .from("calendar_members")
      .select("role")
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .single();
    expect(data?.role).toBe("viewer");
  });
});

describe("profiles (RF-20)", () => {
  it("each user sees only their own profile", async () => {
    const { data } = await viewer.client.from("profiles").select("id");

    expect(data).toEqual([{ id: viewer.id }]);
  });

  it("each user edits only their own profile", async () => {
    const other = await viewer.client
      .from("profiles")
      .update({ display_name: "Hackeado" })
      .eq("id", owner.id)
      .select("id");
    expect(other.data).toEqual([]);

    const own = await viewer.client
      .from("profiles")
      .update({ display_name: "Lectora 2" })
      .eq("id", viewer.id)
      .select("display_name");
    expect(own.data).toEqual([{ display_name: "Lectora 2" }]);
  });
});

describe("anon", () => {
  it("sees nothing in any table", async () => {
    const client = anonClient();
    const results = await Promise.all([
      client.from("profiles").select("id"),
      client.from("calendars").select("id"),
      client.from("calendar_members").select("user_id"),
      client.from("events").select("id"),
    ]);

    for (const { data } of results) {
      expect(data ?? []).toEqual([]);
    }
  });

  it("cannot call the permission functions", async () => {
    const { error } = await anonClient().rpc("is_calendar_member", {
      p_calendar_id: calendarId,
    });

    expect(error).not.toBeNull();
  });
});
