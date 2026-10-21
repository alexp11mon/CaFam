import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// ID and PIN functions (plan "Funciones SQL", D3..D5, D16, D17): RF-14, RF-15,
// RF-17..RF-23, RF-29.
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
const extraUsers: TestUser[] = [];

const PIN = "482915";
const WRONG_PIN = "000000";
const MINUTE = 60_000;

/** Fresh account: the limits are per person, so cases must not share one. */
async function freshUser(name = "Nueva"): Promise<TestUser> {
  const user = await createTestUser({ display_name: name });
  extraUsers.push(user);
  return user;
}

async function newCalendar(): Promise<string> {
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: "Con código" })
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

async function setCode(
  calendarId: string,
  role: "editor" | "viewer" = "viewer",
  pin = PIN,
): Promise<string> {
  const { data, error } = await owner.client.rpc("set_access_code", {
    p_calendar_id: calendarId,
    p_role: role,
    p_pin: pin,
  });
  if (error) throw error;
  return data;
}

async function join(user: TestUser, code: string, pin: string) {
  const { data, error } = await user.client.rpc("join_with_code", {
    p_code: code,
    p_pin: pin,
  });
  if (error) throw error;
  return data[0];
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

async function attemptsOf(userId: string) {
  const { data, error } = await admin
    .from("join_attempts")
    .select("id, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

/** Moves every attempt of the user back in time (the clock cannot be mocked). */
async function ageAttempts(userId: string, minutes: number) {
  for (const row of await attemptsOf(userId)) {
    const { error } = await admin
      .from("join_attempts")
      .update({
        created_at: new Date(
          new Date(row.created_at).getTime() - minutes * MINUTE,
        ).toISOString(),
      })
      .eq("id", row.id);
    if (error) throw error;
  }
}

beforeAll(async () => {
  [owner, editor, viewer, outsider] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Ajena" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, outsider, ...extraUsers]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("set_access_code (RF-14, RF-15, RF-17, RF-29)", () => {
  it("returns an 8 character ID and stores only a hash of the PIN", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId, "editor");

    // 31 characters: A-Z without I, L, O, plus 2-9.
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    const { data } = await admin
      .from("calendar_access_codes")
      .select("*")
      .eq("calendar_id", calendarId)
      .single();
    expect(data).toMatchObject({
      public_code: code,
      role: "editor",
      enabled: true,
    });
    expect(data?.pin_hash).not.toContain(PIN);
    expect(data?.pin_hash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects malformed PINs and the owner role", async () => {
    const calendarId = await newCalendar();
    for (const pin of ["12345", "12345678901", "12345a", "", "123 456"]) {
      const { error } = await owner.client.rpc("set_access_code", {
        p_calendar_id: calendarId,
        p_role: "viewer",
        p_pin: pin,
      });
      expect(error?.code).toBe("22023");
    }
    const { error } = await owner.client.rpc("set_access_code", {
      p_calendar_id: calendarId,
      p_role: "owner",
      p_pin: PIN,
    });
    expect(error?.code).toBe("22023");
  });

  it("rejects everyone who is not the owner", async () => {
    const calendarId = await newCalendar();
    for (const user of [editor, viewer, outsider]) {
      const { error } = await user.client.rpc("set_access_code", {
        p_calendar_id: calendarId,
        p_role: "viewer",
        p_pin: PIN,
      });
      expect(error?.code).toBe("42501");
    }
  });

  it("changing the PIN invalidates the old one and keeps the ID", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const again = await setCode(calendarId, "editor", "7351902846");

    expect(again).toBe(code);
    const guest = await freshUser();
    expect(await join(guest, code, PIN)).toMatchObject({ status: "invalid" });
    expect(await join(guest, code, "7351902846")).toMatchObject({
      status: "ok",
      calendar_id: calendarId,
    });
    expect(await roleOf(calendarId, guest.id)).toBe("editor");
  });
});

describe("disable_access_code (RF-18, RF-29)", () => {
  it("stops the ID and PIN, and re-enabling needs a new PIN", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);

    const { error } = await owner.client.rpc("disable_access_code", {
      p_calendar_id: calendarId,
    });
    expect(error).toBeNull();

    const guest = await freshUser();
    expect(await join(guest, code, PIN)).toMatchObject({ status: "invalid" });

    const reactivated = await setCode(calendarId, "viewer", "9087612345");
    expect(reactivated).toBe(code);
    expect(await join(guest, code, PIN)).toMatchObject({ status: "invalid" });
    expect(await join(guest, code, "9087612345")).toMatchObject({
      status: "ok",
    });
  });

  it("rejects everyone who is not the owner", async () => {
    const calendarId = await newCalendar();
    await setCode(calendarId);
    for (const user of [editor, viewer, outsider]) {
      const { error } = await user.client.rpc("disable_access_code", {
        p_calendar_id: calendarId,
      });
      expect(error?.code).toBe("42501");
    }
    const { data } = await admin
      .from("calendar_access_codes")
      .select("enabled")
      .eq("calendar_id", calendarId)
      .single();
    expect(data?.enabled).toBe(true);
  });
});

describe("join_with_code (RF-19..RF-23)", () => {
  it("adds the person with the role of the code", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId, "editor");
    const guest = await freshUser();

    expect(await join(guest, code, PIN)).toEqual({
      status: "ok",
      calendar_id: calendarId,
    });
    expect(await roleOf(calendarId, guest.id)).toBe("editor");
  });

  it("answers member and keeps the role of someone already inside", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId, "editor");

    for (const [user, expected] of [
      [viewer, "viewer"],
      [owner, "owner"],
    ] as const) {
      expect(await join(user, code, PIN)).toEqual({
        status: "member",
        calendar_id: calendarId,
      });
      expect(await roleOf(calendarId, user.id)).toBe(expected);
    }
  });

  it("accepts a lowercase ID with spaces and a PIN with outer spaces", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const guest = await freshUser();

    const result = await join(guest, `  ${code.toLowerCase()} `, ` ${PIN}  `);
    expect(result).toEqual({ status: "ok", calendar_id: calendarId });
  });

  it("does not tell apart a bad PIN, a missing ID and a disabled ID", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const disabledId = await newCalendar();
    const disabledCode = await setCode(disabledId);
    await owner.client.rpc("disable_access_code", {
      p_calendar_id: disabledId,
    });
    const guest = await freshUser();

    const invalid = { status: "invalid", calendar_id: null };
    expect(await join(guest, code, WRONG_PIN)).toEqual(invalid);
    expect(await join(guest, code, "abc")).toEqual(invalid);
    expect(await join(guest, "ZZZZZZZZ", PIN)).toEqual(invalid);
    expect(await join(guest, disabledCode, PIN)).toEqual(invalid);
    expect(await roleOf(calendarId, guest.id)).toBeUndefined();
  });

  it("limits a person to 5 failures in 15 minutes, even with the right PIN", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const guest = await freshUser();

    for (let i = 0; i < 5; i++) {
      expect(await join(guest, code, WRONG_PIN)).toMatchObject({
        status: "invalid",
      });
    }
    expect(await join(guest, code, PIN)).toEqual({
      status: "limited",
      calendar_id: null,
    });
    expect(await roleOf(calendarId, guest.id)).toBeUndefined();
    // Rejected attempts are not recorded.
    expect(await attemptsOf(guest.id)).toHaveLength(5);

    // The block lasts 15 minutes from the last failure.
    await ageAttempts(guest.id, 10);
    expect(await join(guest, code, PIN)).toMatchObject({ status: "limited" });
    await ageAttempts(guest.id, 6);
    expect(await join(guest, code, PIN)).toMatchObject({ status: "ok" });
  });

  it("does not count successful joins as failures", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const guest = await freshUser();

    for (let i = 0; i < 4; i++) await join(guest, code, WRONG_PIN);
    expect(await join(guest, code, PIN)).toMatchObject({ status: "ok" });
    expect(await attemptsOf(guest.id)).toHaveLength(4);
  });

  it("blocks an ID after 20 failures from several accounts", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const attackers = [owner, editor, viewer, outsider, await freshUser()];

    // 4 failures each stays under the per-person limit of 5.
    const { error } = await admin
      .from("join_attempts")
      .insert(
        attackers.flatMap((user) =>
          Array.from({ length: 4 }, () => ({ user_id: user.id, code })),
        ),
      );
    if (error) throw error;

    const guest = await freshUser();
    expect(await join(guest, code, PIN)).toMatchObject({ status: "limited" });
    expect(await roleOf(calendarId, guest.id)).toBeUndefined();

    // Another calendar is not affected.
    const otherId = await newCalendar();
    const otherCode = await setCode(otherId);
    expect(await join(guest, otherCode, PIN)).toMatchObject({ status: "ok" });
  });

  it("does not block an ID with 19 failures", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const attackers = [owner, editor, viewer, outsider, await freshUser()];
    const rows = attackers.flatMap((user) =>
      Array.from({ length: 4 }, () => ({ user_id: user.id, code })),
    );
    const { error } = await admin.from("join_attempts").insert(rows.slice(1));
    if (error) throw error;

    const guest = await freshUser();
    expect(await join(guest, code, PIN)).toMatchObject({ status: "ok" });
  });

  it("deletes attempts older than a day", async () => {
    const calendarId = await newCalendar();
    const code = await setCode(calendarId);
    const guest = await freshUser();
    const { error } = await admin.from("join_attempts").insert({
      user_id: guest.id,
      code,
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });
    if (error) throw error;

    await join(guest, code, PIN);
    expect(await attemptsOf(guest.id)).toEqual([]);
  });
});

describe("anon access", () => {
  it("cannot call any ID and PIN function", async () => {
    const anon = anonClient();
    const calls = await Promise.all([
      anon.rpc("set_access_code", {
        p_calendar_id: crypto.randomUUID(),
        p_role: "viewer",
        p_pin: PIN,
      }),
      anon.rpc("disable_access_code", { p_calendar_id: crypto.randomUUID() }),
      anon.rpc("join_with_code", { p_code: "ABCD2345", p_pin: PIN }),
    ]);
    for (const { error } of calls) {
      expect(error?.code).toBe("42501");
    }
  });
});
