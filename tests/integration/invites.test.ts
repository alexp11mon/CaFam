import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Invite-link functions (plan "Funciones SQL"): RF-1, RF-3..RF-6, RF-8..RF-10,
// RF-12, RF-13, RF-29.
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let guest: TestUser;
let guest2: TestUser;
let outsider: TestUser;

const NOT_VALID = "CF404";

async function newCalendar(): Promise<string> {
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: "Compartido" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: membersError } = await admin.from("calendar_members").insert([
    { calendar_id: data.id, user_id: editor.id, role: "editor" },
    { calendar_id: data.id, user_id: viewer.id, role: "viewer" },
  ]);
  if (membersError) throw membersError;
  return data.id;
}

async function createInvite(
  calendarId: string,
  role: "editor" | "viewer" = "viewer",
  maxUses = 5,
): Promise<string> {
  const { data, error } = await owner.client.rpc("create_invite", {
    p_calendar_id: calendarId,
    p_role: role,
    p_max_uses: maxUses,
  });
  if (error) throw error;
  return data;
}

function sha256Hex(token: string): string {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

async function inviteRow(token: string) {
  const { data, error } = await admin
    .from("calendar_invites")
    .select("*")
    .eq("token_hash", sha256Hex(token))
    .single();
  if (error) throw error;
  return data;
}

async function patchInvite(
  token: string,
  patch: { expires_at?: string; use_count?: number },
) {
  const { data, error } = await admin
    .from("calendar_invites")
    .update(patch)
    .eq("token_hash", sha256Hex(token))
    .select("id");
  if (error) throw error;
  if (data.length !== 1) throw new Error("invite not patched");
}

async function roleOf(calendarId: string, userId: string) {
  const { data } = await admin
    .from("calendar_members")
    .select("role")
    .eq("calendar_id", calendarId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role;
}

beforeAll(async () => {
  [owner, editor, viewer, guest, guest2, outsider] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Invitada" }),
    createTestUser({ display_name: "Invitado Dos" }),
    createTestUser({ display_name: "Ajena" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, guest, guest2, outsider]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("create_invite (RF-1, RF-3, RF-4, RF-29)", () => {
  it("returns a 43 character token and stores only its SHA-256", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "editor", 3);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await inviteRow(token);
    expect(row).toMatchObject({
      calendar_id: calendarId,
      role: "editor",
      max_uses: 3,
      use_count: 0,
      created_by: owner.id,
      revoked_at: null,
    });
    const days = (new Date(row.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("rejects the owner role and uses outside 1 to 20", async () => {
    const calendarId = await newCalendar();
    const cases = [
      { p_role: "owner" as const, p_max_uses: 5 },
      { p_role: "viewer" as const, p_max_uses: 0 },
      { p_role: "viewer" as const, p_max_uses: 21 },
    ];
    for (const params of cases) {
      const { error } = await owner.client.rpc("create_invite", {
        p_calendar_id: calendarId,
        ...params,
      });
      expect(error?.code).toBe("22023");
    }
  });

  it("rejects everyone who is not the owner", async () => {
    const calendarId = await newCalendar();
    for (const user of [editor, viewer, outsider]) {
      const { error } = await user.client.rpc("create_invite", {
        p_calendar_id: calendarId,
        p_role: "viewer",
        p_max_uses: 1,
      });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("get_invite_preview (RF-5, RF-8, RF-9)", () => {
  it("shows calendar, owner and role without changing anything", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "editor");

    const { data, error } = await guest.client.rpc("get_invite_preview", {
      p_token: token,
    });
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        calendar_name: "Compartido",
        owner_name: "Propietaria",
        role: "editor",
        already_member: false,
      },
    ]);
    expect((await inviteRow(token)).use_count).toBe(0);
    expect(await roleOf(calendarId, guest.id)).toBeUndefined();
  });

  it("tells a member they already belong", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId);

    const { data } = await editor.client.rpc("get_invite_preview", {
      p_token: token,
    });
    expect(data?.[0].already_member).toBe(true);
  });

  it("returns no rows when the invite is not valid", async () => {
    const preview = async (token: string) => {
      const { data, error } = await guest.client.rpc("get_invite_preview", {
        p_token: token,
      });
      expect(error).toBeNull();
      return data;
    };

    const calendarId = await newCalendar();

    const revoked = await createInvite(calendarId);
    await owner.client.rpc("revoke_invite", {
      p_invite_id: (await inviteRow(revoked)).id,
    });
    expect(await preview(revoked)).toEqual([]);

    const expired = await createInvite(calendarId);
    await patchInvite(expired, {
      expires_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    expect(await preview(expired)).toEqual([]);

    const spent = await createInvite(calendarId, "viewer", 1);
    await patchInvite(spent, { use_count: 1 });
    expect(await preview(spent)).toEqual([]);

    expect(await preview("x".repeat(43))).toEqual([]);

    const deleted = await newCalendar();
    const orphan = await createInvite(deleted);
    await admin.from("calendars").delete().eq("id", deleted);
    expect(await preview(orphan)).toEqual([]);
  });
});

describe("accept_invite (RF-6, RF-8..RF-10, RF-13)", () => {
  it("adds the member with the invite role and spends one use", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "editor", 2);

    const { data, error } = await guest.client.rpc("accept_invite", {
      p_token: token,
    });
    expect(error).toBeNull();
    expect(data).toBe(calendarId);
    expect(await roleOf(calendarId, guest.id)).toBe("editor");
    expect((await inviteRow(token)).use_count).toBe(1);

    const again = await guest.client.rpc("accept_invite", { p_token: token });
    expect(again.data).toBe(calendarId);
    expect((await inviteRow(token)).use_count).toBe(1);
  });

  it("does not spend a use or change the role of a member", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "editor");

    for (const [user, expected] of [
      [viewer, "viewer"],
      [owner, "owner"],
    ] as const) {
      const { data, error } = await user.client.rpc("accept_invite", {
        p_token: token,
      });
      expect(error).toBeNull();
      expect(data).toBe(calendarId);
      expect(await roleOf(calendarId, user.id)).toBe(expected);
    }
    expect((await inviteRow(token)).use_count).toBe(0);
  });

  it("fails with CF404 when the invite is not valid", async () => {
    const calendarId = await newCalendar();

    const missing = await guest.client.rpc("accept_invite", {
      p_token: "y".repeat(43),
    });
    expect(missing.error?.code).toBe(NOT_VALID);

    const revoked = await createInvite(calendarId);
    await owner.client.rpc("revoke_invite", {
      p_invite_id: (await inviteRow(revoked)).id,
    });
    const afterRevoke = await guest.client.rpc("accept_invite", {
      p_token: revoked,
    });
    expect(afterRevoke.error?.code).toBe(NOT_VALID);

    const expired = await createInvite(calendarId);
    await patchInvite(expired, {
      expires_at: new Date(Date.now() - 3_600_000).toISOString(),
    });
    const afterExpiry = await guest.client.rpc("accept_invite", {
      p_token: expired,
    });
    expect(afterExpiry.error?.code).toBe(NOT_VALID);

    expect(await roleOf(calendarId, guest.id)).toBeUndefined();
  });

  it("stops accepting when the maximum uses is reached", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "viewer", 2);

    for (const user of [guest, guest2]) {
      const { error } = await user.client.rpc("accept_invite", {
        p_token: token,
      });
      expect(error).toBeNull();
    }
    const { error } = await outsider.client.rpc("accept_invite", {
      p_token: token,
    });
    expect(error?.code).toBe(NOT_VALID);
    expect(await roleOf(calendarId, outsider.id)).toBeUndefined();
    expect((await inviteRow(token)).use_count).toBe(2);
  });

  it("two people racing for the last use give one success and one CF404", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId, "viewer", 1);

    const results = await Promise.all(
      [guest, guest2].map((user) =>
        user.client.rpc("accept_invite", { p_token: token }),
      ),
    );

    const failures = results.filter((r) => r.error);
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error?.code).toBe(NOT_VALID);
    expect((await inviteRow(token)).use_count).toBe(1);
  });
});

describe("revoke_invite (RF-12, RF-29)", () => {
  it("is immediate and keeps people who already joined", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId);
    await guest.client.rpc("accept_invite", { p_token: token });

    const row = await inviteRow(token);
    const { error } = await owner.client.rpc("revoke_invite", {
      p_invite_id: row.id,
    });
    expect(error).toBeNull();
    expect((await inviteRow(token)).revoked_at).not.toBeNull();

    const late = await guest2.client.rpc("accept_invite", { p_token: token });
    expect(late.error?.code).toBe(NOT_VALID);
    expect(await roleOf(calendarId, guest.id)).toBe("viewer");
  });

  it("rejects everyone who is not the owner", async () => {
    const calendarId = await newCalendar();
    const token = await createInvite(calendarId);
    const row = await inviteRow(token);

    for (const user of [editor, viewer, outsider]) {
      const { error } = await user.client.rpc("revoke_invite", {
        p_invite_id: row.id,
      });
      expect(error?.code).toBe("42501");
    }
    expect((await inviteRow(token)).revoked_at).toBeNull();
  });
});

describe("anon access", () => {
  it("cannot call any invite function", async () => {
    const anon = anonClient();
    const calls = await Promise.all([
      anon.rpc("create_invite", {
        p_calendar_id: crypto.randomUUID(),
        p_role: "viewer",
        p_max_uses: 1,
      }),
      anon.rpc("revoke_invite", { p_invite_id: crypto.randomUUID() }),
      anon.rpc("get_invite_preview", { p_token: "z".repeat(43) }),
      anon.rpc("accept_invite", { p_token: "z".repeat(43) }),
    ]);
    for (const { error } of calls) {
      expect(error?.code).toBe("42501");
    }
  });
});
