import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Permission matrix of the sharing tables (plan "Permisos y políticas"):
// RF-11, RF-16, RF-24..RF-31, RF-38.
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let other: TestUser;
let outsider: TestUser;
let calendarId: string;

const INVITE_PUBLIC_COLUMNS =
  "id, calendar_id, role, max_uses, use_count, created_by, expires_at, revoked_at, created_at";
const CODE_PUBLIC_COLUMNS =
  "calendar_id, public_code, role, enabled, created_at, updated_at";

function randomHash(): string {
  return `\\x${randomBytes(32).toString("hex")}`;
}

async function roleOf(userId: string): Promise<string | undefined> {
  const { data } = await admin
    .from("calendar_members")
    .select("role")
    .eq("calendar_id", calendarId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role;
}

beforeAll(async () => {
  [owner, editor, viewer, other, outsider] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Otra Lectora" }),
    createTestUser({ display_name: "Ajena" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);

  const { error: inviteError } = await admin.from("calendar_invites").insert({
    calendar_id: calendarId,
    token_hash: randomHash(),
    role: "viewer",
    max_uses: 5,
    created_by: owner.id,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (inviteError) throw inviteError;

  const { error: codeError } = await admin
    .from("calendar_access_codes")
    .insert({
      calendar_id: calendarId,
      public_code: "ABCD2345",
      pin_hash: "not-a-real-hash",
      role: "viewer",
      enabled: true,
    });
  if (codeError) throw codeError;

  const { error: attemptError } = await admin
    .from("join_attempts")
    .insert({ user_id: outsider.id, code: "ABCD2345" });
  if (attemptError) throw attemptError;
});

beforeEach(async () => {
  // Every case starts from owner + editor + viewer + other(viewer).
  await admin
    .from("calendar_members")
    .delete()
    .eq("calendar_id", calendarId)
    .neq("user_id", owner.id);
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: editor.id, role: "editor" },
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
    { calendar_id: calendarId, user_id: other.id, role: "viewer" },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, other, outsider]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("calendar_invites and calendar_access_codes (RF-11, RF-16)", () => {
  it("the owner reads invites without the token hash", async () => {
    const { data, error } = await owner.client
      .from("calendar_invites")
      .select(INVITE_PUBLIC_COLUMNS);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const hash = await owner.client
      .from("calendar_invites")
      .select("token_hash");
    expect(hash.error?.code).toBe("42501");
    const all = await owner.client.from("calendar_invites").select("*");
    expect(all.error?.code).toBe("42501");
  });

  it("the owner reads the access code without the pin hash", async () => {
    const { data, error } = await owner.client
      .from("calendar_access_codes")
      .select(CODE_PUBLIC_COLUMNS);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].public_code).toBe("ABCD2345");

    const hash = await owner.client
      .from("calendar_access_codes")
      .select("pin_hash");
    expect(hash.error?.code).toBe("42501");
    const all = await owner.client.from("calendar_access_codes").select("*");
    expect(all.error?.code).toBe("42501");
  });

  it("editor, viewer and outsider see no rows", async () => {
    for (const user of [editor, viewer, outsider]) {
      const invites = await user.client
        .from("calendar_invites")
        .select(INVITE_PUBLIC_COLUMNS);
      expect(invites.data ?? []).toEqual([]);
      const codes = await user.client
        .from("calendar_access_codes")
        .select(CODE_PUBLIC_COLUMNS);
      expect(codes.data ?? []).toEqual([]);
    }
  });

  it("anon cannot read either table", async () => {
    const anon = anonClient();
    const invites = await anon.from("calendar_invites").select("id");
    expect(invites.error?.code).toBe("42501");
    const codes = await anon
      .from("calendar_access_codes")
      .select("calendar_id");
    expect(codes.error?.code).toBe("42501");
  });

  it("nobody writes directly, not even the owner", async () => {
    for (const user of [owner, editor, viewer, outsider]) {
      const insertInvite = await user.client.from("calendar_invites").insert({
        calendar_id: calendarId,
        token_hash: randomHash(),
        role: "editor",
        max_uses: 1,
        created_by: user.id,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(insertInvite.error?.code).toBe("42501");

      const updateInvite = await user.client
        .from("calendar_invites")
        .update({ role: "editor" })
        .eq("calendar_id", calendarId);
      expect(updateInvite.error?.code).toBe("42501");

      const deleteInvite = await user.client
        .from("calendar_invites")
        .delete()
        .eq("calendar_id", calendarId);
      expect(deleteInvite.error?.code).toBe("42501");

      const insertCode = await user.client
        .from("calendar_access_codes")
        .insert({
          calendar_id: calendarId,
          public_code: "ZZZZ2222",
          pin_hash: "x",
          role: "editor",
        });
      expect(insertCode.error?.code).toBe("42501");

      const updateCode = await user.client
        .from("calendar_access_codes")
        .update({ role: "editor" })
        .eq("calendar_id", calendarId);
      expect(updateCode.error?.code).toBe("42501");

      const deleteCode = await user.client
        .from("calendar_access_codes")
        .delete()
        .eq("calendar_id", calendarId);
      expect(deleteCode.error?.code).toBe("42501");
    }

    const { data } = await admin
      .from("calendar_invites")
      .select("role")
      .eq("calendar_id", calendarId);
    expect(data).toEqual([{ role: "viewer" }]);
  });
});

describe("join_attempts", () => {
  it("cannot be read or written by any client", async () => {
    for (const user of [owner, editor, viewer, outsider]) {
      const read = await user.client.from("join_attempts").select("id");
      expect(read.error?.code).toBe("42501");
      const write = await user.client
        .from("join_attempts")
        .insert({ user_id: user.id, code: "ABCD2345" });
      expect(write.error?.code).toBe("42501");
    }
    const anon = await anonClient().from("join_attempts").select("id");
    expect(anon.error?.code).toBe("42501");
  });
});

describe("calendar_members update (RF-25, RF-28, RF-29)", () => {
  it("the owner switches another member between viewer and editor", async () => {
    const promote = await owner.client
      .from("calendar_members")
      .update({ role: "editor" })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .select("role");
    expect(promote.error).toBeNull();
    expect(promote.data).toEqual([{ role: "editor" }]);

    const demote = await owner.client
      .from("calendar_members")
      .update({ role: "viewer" })
      .eq("calendar_id", calendarId)
      .eq("user_id", editor.id)
      .select("role");
    expect(demote.data).toEqual([{ role: "viewer" }]);
  });

  it("the owner cannot make anyone an owner", async () => {
    const { error } = await owner.client
      .from("calendar_members")
      .update({ role: "owner" })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id);
    expect(error?.code).toBe("42501");
    expect(await roleOf(viewer.id)).toBe("viewer");
  });

  it("the owner row cannot be changed", async () => {
    const { data } = await owner.client
      .from("calendar_members")
      .update({ role: "editor" })
      .eq("calendar_id", calendarId)
      .eq("user_id", owner.id)
      .select("role");
    expect(data ?? []).toEqual([]);
    expect(await roleOf(owner.id)).toBe("owner");
  });

  it("user_id and calendar_id cannot be changed (column permission)", async () => {
    const user = await owner.client
      .from("calendar_members")
      .update({ user_id: outsider.id })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id);
    expect(user.error?.code).toBe("42501");

    const calendar = await owner.client
      .from("calendar_members")
      .update({ calendar_id: await getOwnCalendarId(outsider.id) })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id);
    expect(calendar.error?.code).toBe("42501");
    expect(await roleOf(viewer.id)).toBe("viewer");
  });

  it("editor, viewer and outsider cannot change roles", async () => {
    for (const user of [editor, viewer, outsider]) {
      const { data } = await user.client
        .from("calendar_members")
        .update({ role: "editor" })
        .eq("calendar_id", calendarId)
        .eq("user_id", other.id)
        .select("role");
      expect(data ?? []).toEqual([]);
    }
    const self = await viewer.client
      .from("calendar_members")
      .update({ role: "editor" })
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .select("role");
    expect(self.data ?? []).toEqual([]);
    expect(await roleOf(viewer.id)).toBe("viewer");
    expect(await roleOf(other.id)).toBe("viewer");
  });
});

describe("calendar_members delete (RF-26, RF-27, RF-28)", () => {
  it("the owner removes another member", async () => {
    const { data } = await owner.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id)
      .select("user_id");
    expect(data).toEqual([{ user_id: viewer.id }]);
    expect(await roleOf(viewer.id)).toBeUndefined();
  });

  it("any non-owner member removes their own row", async () => {
    for (const user of [editor, viewer]) {
      const { data } = await user.client
        .from("calendar_members")
        .delete()
        .eq("calendar_id", calendarId)
        .eq("user_id", user.id)
        .select("user_id");
      expect(data).toEqual([{ user_id: user.id }]);
      expect(await roleOf(user.id)).toBeUndefined();
    }
  });

  it("the owner cannot remove their own row", async () => {
    const { data } = await owner.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", owner.id)
      .select("user_id");
    expect(data ?? []).toEqual([]);
    expect(await roleOf(owner.id)).toBe("owner");
  });

  it("editor and outsider cannot remove others", async () => {
    for (const user of [editor, outsider]) {
      const { data } = await user.client
        .from("calendar_members")
        .delete()
        .eq("calendar_id", calendarId)
        .eq("user_id", viewer.id)
        .select("user_id");
      expect(data ?? []).toEqual([]);
    }
    expect(await roleOf(viewer.id)).toBe("viewer");
  });

  it("direct inserts stay rejected for everyone", async () => {
    for (const user of [owner, editor, viewer, outsider]) {
      const { error } = await user.client.from("calendar_members").insert({
        calendar_id: calendarId,
        user_id: outsider.id,
        role: "viewer",
      });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("leaving a calendar (RF-30, RF-31)", () => {
  it("drops the member's preferences and keeps what they created", async () => {
    const { data: category, error: categoryError } = await admin
      .from("event_categories")
      .insert({ calendar_id: calendarId, name: "De la editora" })
      .select("id")
      .single();
    if (categoryError) throw categoryError;
    const { data: event, error: eventError } = await admin
      .from("events")
      .insert({
        calendar_id: calendarId,
        title: "Evento de la editora",
        starts_at: "2026-11-02T10:00:00Z",
        ends_at: "2026-11-02T11:00:00Z",
        created_by: editor.id,
      })
      .select("id")
      .single();
    if (eventError) throw eventError;
    const { error: prefError } = await admin
      .from("calendar_preferences")
      .insert([
        { user_id: editor.id, calendar_id: calendarId, visible: false },
        { user_id: viewer.id, calendar_id: calendarId, visible: false },
      ]);
    if (prefError) throw prefError;

    const { error } = await owner.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", editor.id);
    expect(error).toBeNull();

    const { data: prefs } = await admin
      .from("calendar_preferences")
      .select("user_id")
      .eq("calendar_id", calendarId);
    expect(prefs).toEqual([{ user_id: viewer.id }]);

    const { data: kept } = await admin
      .from("events")
      .select("created_by")
      .eq("id", event.id)
      .single();
    expect(kept?.created_by).toBe(editor.id);
    const { data: keptCategory } = await admin
      .from("event_categories")
      .select("id")
      .eq("id", category.id);
    expect(keptCategory).toHaveLength(1);
  });
});

describe("calendar_members_with_names (RF-24)", () => {
  it("a member gets name and role of every member, owner included", async () => {
    const byUser = (a: { user_id: string }, b: { user_id: string }) =>
      a.user_id.localeCompare(b.user_id);
    const expected = [
      { user: owner, name: "Propietaria", role: "owner" },
      { user: editor, name: "Editora", role: "editor" },
      { user: viewer, name: "Lectora", role: "viewer" },
      { user: other, name: "Otra Lectora", role: "viewer" },
    ]
      .map((m) => ({
        calendar_id: calendarId,
        user_id: m.user.id,
        display_name: m.name,
        role: m.role,
      }))
      .sort(byUser);

    for (const user of [owner, editor, viewer]) {
      const { data, error } = await user.client.rpc(
        "calendar_members_with_names",
        { p_calendar_ids: [calendarId] },
      );
      expect(error).toBeNull();
      expect([...(data ?? [])].sort(byUser)).toEqual(expected);
    }
  });

  it("an outsider gets no rows", async () => {
    const { data, error } = await outsider.client.rpc(
      "calendar_members_with_names",
      { p_calendar_ids: [calendarId] },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("only returns the calendars the caller belongs to", async () => {
    const outsiderCalendar = await getOwnCalendarId(outsider.id);
    const { data } = await editor.client.rpc("calendar_members_with_names", {
      p_calendar_ids: [calendarId, outsiderCalendar],
    });
    expect(new Set((data ?? []).map((row) => row.calendar_id))).toEqual(
      new Set([calendarId]),
    );
  });

  it("anon cannot call it", async () => {
    const { error } = await anonClient().rpc("calendar_members_with_names", {
      p_calendar_ids: [calendarId],
    });
    expect(error?.code).toBe("42501");
  });
});
