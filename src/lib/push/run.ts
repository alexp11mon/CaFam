import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
import { reminderPayload, socialPayload, type PushPayload } from "./payload";
import type { SocialNotice } from "./payload";
import { dueReminders, EARLY_MS, LATE_MS, type ReminderRow } from "./reminders";
import { sendPush, type PushTarget } from "./send";
import type { VapidKeys } from "./vapid";

// The send job (spec 040, plan "Resumen de arquitectura"): reminders due now,
// then the social queue, to every device of each person. Server only.

type Client = SupabaseClient<Database>;

/** The publishable key without a session plus the cron secret (P4). */
export function pushClient(): Client {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
}

/** The VAPID keys and subject from the environment, or null (plan D7). */
export function vapidFromEnv(): { keys: VapidKeys; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    keys: { publicKey, privateKey },
    subject:
      process.env.VAPID_SUBJECT || "https://calendario-familia-five.vercel.app",
  };
}

interface Outgoing {
  userId: string;
  payload: PushPayload;
}

async function dueNow(
  supabase: Client,
  secret: string,
  now: Date,
): Promise<Outgoing[]> {
  const { data, error } = await supabase.rpc("push_due_reminders", {
    p_secret: secret,
    p_from: new Date(now.getTime() - LATE_MS).toISOString(),
    p_to: new Date(now.getTime() + EARLY_MS).toISOString(),
  });
  if (error) throw error;
  const rows: ReminderRow[] = (data ?? []).map((r) => ({
    userId: r.user_id,
    eventId: r.event_id,
    title: r.title,
    location: r.location,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    allDay: r.all_day,
    recurrence: r.recurrence,
    recurrenceTz: r.recurrence_tz,
    exdates: r.exdates ?? [],
    seriesId: r.series_id,
    minutes: r.minutes,
    timeZone: r.time_zone,
  }));
  const keys = (data ?? []).flatMap((r) =>
    (r.exceptions ?? []).map((start) => ({
      series_id: r.event_id,
      original_start: start,
    })),
  );
  const due = dueReminders(rows, keys, now);
  if (due.length === 0) return [];

  // Only what this run marked first is sent (RF-10).
  const { data: marked, error: markError } = await supabase.rpc(
    "push_mark_sent",
    {
      p_secret: secret,
      p_keys: due.map((d) => ({
        user_id: d.userId,
        event_id: d.deliveryEventId,
        occurrence_start: d.occurrenceStart,
        minutes: d.minutes,
      })),
    },
  );
  if (markError) throw markError;
  const fresh = new Set(
    (marked ?? []).map(
      (m) =>
        `${m.user_id}|${m.event_id}|${Date.parse(m.occurrence_start)}|${m.minutes}`,
    ),
  );
  return due
    .filter((d) =>
      fresh.has(
        `${d.userId}|${d.deliveryEventId}|${Date.parse(d.occurrenceStart)}|${d.minutes}`,
      ),
    )
    .map((d) => ({
      userId: d.userId,
      payload: reminderPayload(d, d.timeZone, now),
    }));
}

async function socialNow(
  supabase: Client,
  secret: string,
): Promise<Outgoing[]> {
  const { data, error } = await supabase.rpc("push_claim_notifications", {
    p_secret: secret,
  });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    userId: n.user_id,
    payload: socialPayload(n.payload as unknown as SocialNotice),
  }));
}

/** Sends what is due; returns how many notices reached a device. */
export async function runPush(
  supabase: Client,
  secret: string,
  vapid: { keys: VapidKeys; subject: string },
  now: Date = new Date(),
): Promise<number> {
  const outgoing = [
    ...(await dueNow(supabase, secret, now)),
    ...(await socialNow(supabase, secret)),
  ];
  if (outgoing.length === 0) return 0;

  const { data: subs, error } = await supabase.rpc("push_subscriptions_for", {
    p_secret: secret,
    p_user_ids: [...new Set(outgoing.map((o) => o.userId))],
  });
  if (error) throw error;
  const byUser = new Map<string, (PushTarget & { id: string })[]>();
  for (const s of subs ?? []) {
    byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  }

  const gone: string[] = [];
  const used = new Set<string>();
  let sent = 0;
  await Promise.all(
    outgoing.flatMap(({ userId, payload }) =>
      (byUser.get(userId) ?? []).map(async (target) => {
        const result = await sendPush(
          target,
          payload,
          vapid.keys,
          vapid.subject,
        );
        if (result === "gone") gone.push(target.id);
        if (result === "ok") {
          sent += 1;
          used.add(target.id);
        }
      }),
    ),
  );

  if (gone.length > 0) {
    await supabase.rpc("push_drop_subscription", {
      p_secret: secret,
      p_ids: gone,
    });
  }
  if (used.size > 0) {
    await supabase.rpc("push_touch_subscription", {
      p_secret: secret,
      p_ids: [...used],
    });
  }
  return sent;
}
