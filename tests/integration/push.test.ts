import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 040, T3: subscriptions, reminders, deliveries and the social queue
// (RF-2, RF-7, RF-10, RF-13 to RF-16, RF-18).
const SECRET = process.env.CRON_SECRET ?? "";
if (!SECRET) throw new Error("Missing CRON_SECRET: add it to .env.test.local");

let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendarId: string;

let endpointCount = 0;
async function subscribe(user: TestUser) {
  endpointCount += 1;
  const { data, error } = await user.client.rpc("save_push_subscription", {
    p_endpoint: `https://push.example.test/${user.id}/${endpointCount}`,
    p_p256dh: "BKey",
    p_auth: "auth",
    p_device: "Chrome en Windows",
  });
  if (error) throw error;
  return data;
}

async function newEvent(user: TestUser, extra: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("events")
    .insert({
      calendar_id: calendarId,
      title: "Cena",
      starts_at: "2030-01-10T19:00:00Z",
      ends_at: "2030-01-10T20:00:00Z",
      created_by: user.id,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function outboxOf(userId: string) {
  const { data, error } = await admin
    .from("push_outbox")
    .select("kind, payload, claimed_at")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  [owner, editor, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lector" }),
    createTestUser({ display_name: "Ajeno" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: editor.id, role: "editor" },
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, stranger]
      .filter(Boolean)
      .map((u) => deleteTestUser(u.id)),
  );
});

describe("push_subscriptions", () => {
  it("are only seen by their owner, and an endpoint moves to the last account", async () => {
    await subscribe(owner);
    const { data: mine } = await owner.client
      .from("push_subscriptions")
      .select("device");
    expect(mine).toEqual([{ device: "Chrome en Windows" }]);
    const { data: theirs } = await stranger.client
      .from("push_subscriptions")
      .select("id");
    expect(theirs).toEqual([]);

    const { error: direct } = await stranger.client
      .from("push_subscriptions")
      .insert({ endpoint: "https://x.test/1", p256dh: "a", auth: "b" });
    expect(direct?.code).toBe("42501");

    const endpoint = "https://push.example.test/shared";
    await stranger.client.rpc("save_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "k",
      p_auth: "a",
      p_device: "Edge en Windows",
    });
    await viewer.client.rpc("save_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "k",
      p_auth: "a",
      p_device: "Edge en Windows",
    });
    const { data: rows } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .eq("endpoint", endpoint);
    expect(rows).toEqual([{ user_id: viewer.id }]);
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  });
});

describe("event_reminders", () => {
  it("are personal, need membership and go when leaving the calendar (RF-7)", async () => {
    const eventId = await newEvent(owner);
    const { error } = await viewer.client
      .from("event_reminders")
      .insert({ event_id: eventId, minutes: [10, 60] });
    expect(error).toBeNull();

    const { error: outsider } = await stranger.client
      .from("event_reminders")
      .insert({ event_id: eventId, minutes: [10] });
    expect(outsider).not.toBeNull();

    const { error: tooMany } = await viewer.client
      .from("event_reminders")
      .update({ minutes: [0, 5, 10, 15] })
      .eq("event_id", eventId);
    expect(tooMany?.code).toBe("23514");

    const { data: seenByEditor } = await editor.client
      .from("event_reminders")
      .select("user_id")
      .eq("event_id", eventId);
    expect(seenByEditor).toEqual([]);

    // The default reminder of the creator is stored with the event (plan D2).
    const { data: own } = await owner.client
      .from("event_reminders")
      .select("minutes")
      .eq("event_id", eventId);
    expect(own).toEqual([{ minutes: [10] }]);

    await admin
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendarId)
      .eq("user_id", viewer.id);
    const { data: left } = await admin
      .from("event_reminders")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("user_id", viewer.id);
    expect(left).toEqual([]);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: calendarId, user_id: viewer.id, role: "viewer" });
  });

  it("uses the all-day default and none when the default is off", async () => {
    const allDay = await newEvent(owner, {
      all_day: true,
      starts_at: "2030-02-01T00:00:00Z",
      ends_at: "2030-02-02T00:00:00Z",
    });
    const { data } = await owner.client
      .from("event_reminders")
      .select("minutes")
      .eq("event_id", allDay);
    expect(data).toEqual([{ minutes: [1440] }]);

    await editor.client
      .from("profiles")
      .update({ reminder_minutes: null })
      .eq("id", editor.id);
    const none = await newEvent(editor);
    const { data: empty } = await admin
      .from("event_reminders")
      .select("user_id")
      .eq("event_id", none);
    expect(empty).toEqual([]);
  });
});

describe("the send functions", () => {
  it("refuse a wrong secret", async () => {
    const client = anonClient();
    const { error } = await client.rpc("push_mark_sent", {
      p_secret: "wrong",
      p_keys: [],
    });
    expect(error?.code).toBe("42501");
    const { error: claim } = await client.rpc("push_claim_notifications", {
      p_secret: "wrong",
    });
    expect(claim?.code).toBe("42501");
  });

  it("return due reminders with the zone and send each one once (RF-10)", async () => {
    const soon = new Date(Date.now() + 10 * 60_000);
    const eventId = await newEvent(owner, {
      starts_at: soon.toISOString(),
      ends_at: new Date(soon.getTime() + 3_600_000).toISOString(),
    });
    const client = anonClient();
    const { data: rows, error } = await client.rpc("push_due_reminders", {
      p_secret: SECRET,
      p_from: new Date(Date.now() - 15 * 60_000).toISOString(),
      p_to: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error).toBeNull();
    const row = rows?.find((r) => r.event_id === eventId);
    expect(row).toMatchObject({
      user_id: owner.id,
      minutes: [10],
      time_zone: "Europe/Madrid",
    });

    const key = {
      user_id: owner.id,
      event_id: eventId,
      occurrence_start: soon.toISOString(),
      minutes: 10,
    };
    const [first, second] = await Promise.all([
      client.rpc("push_mark_sent", { p_secret: SECRET, p_keys: [key] }),
      client.rpc("push_mark_sent", { p_secret: SECRET, p_keys: [key] }),
    ]);
    expect((first.data?.length ?? 0) + (second.data?.length ?? 0)).toBe(1);

    const { data: subs } = await client.rpc("push_subscriptions_for", {
      p_secret: SECRET,
      p_user_ids: [owner.id],
    });
    expect(subs).toHaveLength(1);
    await client.rpc("push_drop_subscription", {
      p_secret: SECRET,
      p_ids: [subs![0]!.id],
    });
    const { data: after } = await client.rpc("push_subscriptions_for", {
      p_secret: SECRET,
      p_user_ids: [owner.id],
    });
    expect(after).toEqual([]);
    // No device: no reminders to send.
    const { data: none } = await client.rpc("push_due_reminders", {
      p_secret: SECRET,
      p_from: new Date(Date.now() - 15 * 60_000).toISOString(),
      p_to: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(none?.some((r) => r.event_id === eventId)).toBe(false);
    await subscribe(owner);
  });
});

describe("social notices (RF-13 to RF-16)", () => {
  it("queue a comment by another person, never your own, and only with a device", async () => {
    const eventId = await newEvent(owner, { title: "Cumple" });
    await admin.from("push_outbox").delete().eq("user_id", owner.id);

    await owner.client.from("event_comments").insert({
      event_id: eventId,
      body: "Mío",
      client_id: crypto.randomUUID(),
    });
    expect(await outboxOf(owner.id)).toEqual([]);

    await viewer.client.from("event_comments").insert({
      event_id: eventId,
      body: "Llevo el postre",
      client_id: crypto.randomUUID(),
    });
    expect(await outboxOf(owner.id)).toMatchObject([
      {
        kind: "comment",
        payload: {
          actor: "Lector",
          title: "Cumple",
          eventId,
          body: "Llevo el postre",
        },
      },
    ]);
    // The viewer commented but has no device: nothing queued (RF-16).
    await editor.client.from("event_comments").insert({
      event_id: eventId,
      body: "Yo también",
      client_id: crypto.randomUUID(),
    });
    expect(await outboxOf(viewer.id)).toEqual([]);
  });

  it("respects the kinds turned off and joins changes of 2 minutes (RF-14, RF-15)", async () => {
    const eventId = await newEvent(owner, { title: "Reunión" });
    await admin.from("push_outbox").delete().eq("user_id", owner.id);

    // "changes" is off by default.
    await editor.client
      .from("events")
      .update({ title: "Reunión 2" })
      .eq("id", eventId);
    expect(await outboxOf(owner.id)).toEqual([]);

    await owner.client
      .from("profiles")
      .update({
        notify: { joined: true, access: true, comments: true, changes: true },
      })
      .eq("id", owner.id);
    await editor.client
      .from("events")
      .update({ title: "Reunión 3" })
      .eq("id", eventId);
    await editor.client
      .from("events")
      .update({ location: "Sala" })
      .eq("id", eventId);
    expect(await outboxOf(owner.id)).toMatchObject([
      { kind: "changed", payload: { actor: "Editora", title: "Reunión 3" } },
    ]);

    // The sync (no session) never notifies (plan D6).
    await admin.from("push_outbox").delete().eq("user_id", owner.id);
    await admin.from("events").update({ title: "Sync" }).eq("id", eventId);
    expect(await outboxOf(owner.id)).toEqual([]);

    await editor.client.from("events").delete().eq("id", eventId);
    expect(await outboxOf(owner.id)).toMatchObject([
      { kind: "deleted", payload: { actor: "Editora", title: "Sync" } },
    ]);

    const { data: claimed } = await anonClient().rpc(
      "push_claim_notifications",
      { p_secret: SECRET },
    );
    expect(claimed?.some((n) => n.user_id === owner.id)).toBe(true);
    expect((await outboxOf(owner.id))[0]?.claimed_at).not.toBeNull();
  });

  it("tell the owner who joins and the member who gets access", async () => {
    await subscribe(stranger);
    await admin.from("push_outbox").delete().eq("user_id", owner.id);
    const { data: token, error } = await owner.client.rpc("create_invite", {
      p_calendar_id: calendarId,
      p_role: "viewer",
      p_max_uses: 1,
    });
    expect(error).toBeNull();
    await stranger.client.rpc("accept_invite", { p_token: token as string });
    expect(await outboxOf(owner.id)).toMatchObject([
      { kind: "joined", payload: { actor: "Ajeno" } },
    ]);

    await owner.client
      .from("calendar_members")
      .update({ role: "editor" })
      .eq("calendar_id", calendarId)
      .eq("user_id", stranger.id);
    expect(await outboxOf(stranger.id)).toMatchObject([
      { kind: "access", payload: { actor: "Dueña", role: "editor" } },
    ]);
  });
});
