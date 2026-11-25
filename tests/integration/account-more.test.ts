import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  uniqueEmail,
  type TestUser,
} from "./helpers";

// Spec 049, T1: resend limit, transfer of a calendar and purge of accounts
// never confirmed (RF-1, RF-6 to RF-11).
const hashOf = (email: string) =>
  `\\x${createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex")}`;

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
const emails: string[] = [];
const extraUsers: string[] = [];

beforeAll(async () => {
  [owner, editor, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Eva" }),
    createTestUser({ display_name: "Otro" }),
  ]);
});

afterAll(async () => {
  for (const email of emails) {
    await admin
      .from("auth_email_requests")
      .delete()
      .eq("email_hash", hashOf(email));
  }
  for (const id of [owner, editor, viewer, stranger]
    .map((u) => u.id)
    .concat(extraUsers)) {
    await deleteTestUser(id);
  }
  await deleteTestMail();
});

async function sharedCalendar(name = "Familia"): Promise<string> {
  const { data, error } = await owner.client
    .from("calendars")
    .insert({ name, owner_id: owner.id })
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

const transfer = (user: TestUser, calendarId: string, to: string) =>
  user.client.rpc("transfer_calendar", {
    p_calendar_id: calendarId,
    p_new_owner: to,
  });

describe("request_signup_resend (RF-1)", () => {
  it("allows one a minute", async () => {
    const email = uniqueEmail();
    emails.push(email);
    const send = () =>
      anonClient().rpc("request_signup_resend", { p_email: email });
    expect((await send()).data).toBe(true);
    expect((await send()).data).toBe(false);
  });

  it("allows three every 15 minutes", async () => {
    const email = uniqueEmail();
    emails.push(email);
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    await admin.from("auth_email_requests").insert([
      { email_hash: hashOf(email), created_at: old },
      { email_hash: hashOf(email), created_at: old },
      { email_hash: hashOf(email), created_at: old },
    ] as never);
    const { data } = await anonClient().rpc("request_signup_resend", {
      p_email: email,
    });
    expect(data).toBe(false);
  });
});

describe("transfer_calendar (RF-7 to RF-11)", () => {
  it("makes a member the owner, the old owner an Editor, and revokes every way in", async () => {
    const calendarId = await sharedCalendar();
    const { data: token } = await owner.client.rpc("create_invite", {
      p_calendar_id: calendarId,
      p_role: "viewer",
      p_max_uses: 2,
    });
    expect(token).toBeTruthy();
    const { error: codeError } = await owner.client.rpc("set_access_code", {
      p_calendar_id: calendarId,
      p_role: "viewer",
      p_pin: "482913",
    });
    expect(codeError).toBeNull();
    const { error: feedError } = await owner.client.rpc("create_ics_feed", {
      p_calendar_id: calendarId,
    });
    expect(feedError).toBeNull();
    await admin.from("ics_subscriptions").insert({
      calendar_id: calendarId,
      created_by: owner.id,
      secret_id: randomUUID(),
    });

    const { error } = await transfer(owner, calendarId, editor.id);
    expect(error).toBeNull();

    const { data: calendar } = await admin
      .from("calendars")
      .select("owner_id")
      .eq("id", calendarId)
      .single();
    expect(calendar?.owner_id).toBe(editor.id);
    const { data: members } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", calendarId);
    expect(
      Object.fromEntries(members!.map((m) => [m.user_id, m.role])),
    ).toEqual({
      [owner.id]: "editor",
      [editor.id]: "owner",
      [viewer.id]: "viewer",
    });

    const { data: invites } = await admin
      .from("calendar_invites")
      .select("revoked_at")
      .eq("calendar_id", calendarId);
    expect(invites!.every((i) => i.revoked_at !== null)).toBe(true);
    for (const table of [
      "calendar_access_codes",
      "calendar_feeds",
      "ics_subscriptions",
    ] as const) {
      const { count } = await admin
        .from(table)
        .select("calendar_id", { count: "exact", head: true })
        .eq("calendar_id", calendarId);
      expect(count, table).toBe(0);
    }

    const { data: notices } = await editor.client
      .from("account_notices")
      .select("kind, person_name, calendar_name")
      .eq("kind", "transferred");
    expect(notices).toContainEqual({
      kind: "transferred",
      person_name: "Ana",
      calendar_name: "Familia",
    });
    const { data: mail } = await admin
      .from("email_outbox")
      .select("subject")
      .eq("to_email", editor.email);
    expect(mail).toContainEqual({
      subject: "Ahora eres el propietario de «Familia»",
    });

    // The new owner can pass it on; the old one no longer can.
    expect((await transfer(owner, calendarId, viewer.id)).error?.code).toBe(
      "CF404",
    );
  });

  it("refuses others than the owner, outsiders and synced calendars", async () => {
    const calendarId = await sharedCalendar("Casa");
    expect((await transfer(editor, calendarId, viewer.id)).error?.code).toBe(
      "CF404",
    );
    expect((await transfer(owner, calendarId, stranger.id)).error?.code).toBe(
      "22023",
    );
    expect((await transfer(owner, calendarId, owner.id)).error?.code).toBe(
      "22023",
    );

    const { data: connection, error: connectionError } = await admin
      .from("calendar_connections")
      .insert({
        owner_id: owner.id,
        provider: "google",
        account_subject: `sub-${randomUUID()}`,
        account_email: "x@gmail.test",
      })
      .select("id")
      .single();
    if (connectionError) throw connectionError;
    await admin.from("synced_calendars").insert({
      calendar_id: calendarId,
      connection_id: connection.id,
      provider: "google",
      external_id: `cal-${randomUUID()}`,
    });
    expect((await transfer(owner, calendarId, editor.id)).error?.code).toBe(
      "CF409",
    );
  });
});

describe("account_purge_unconfirmed (RF-6)", () => {
  it("deletes accounts never confirmed and keeps the confirmed ones", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: uniqueEmail(),
      password: "test-password-1234",
      email_confirm: false,
      user_metadata: { display_name: "Sin confirmar" },
    });
    if (error) throw error;
    extraUsers.push(data.user.id);

    const { error: purgeError } = await admin.rpc("account_purge_unconfirmed", {
      p_older_than: "0 seconds",
    });
    expect(purgeError).toBeNull();

    const { data: gone } = await admin.auth.admin.getUserById(data.user.id);
    expect(gone.user).toBeNull();
    extraUsers.pop();
    const { data: kept } = await admin.auth.admin.getUserById(owner.id);
    expect(kept.user?.id).toBe(owner.id);
  });
});
