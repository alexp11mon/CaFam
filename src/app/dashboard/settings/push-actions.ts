"use server";

import { revalidatePath } from "next/cache";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { REMINDER_OPTIONS } from "@/lib/push/options";
import { vapidFromEnv } from "@/lib/push/run";
import { sendPush } from "@/lib/push/send";

// "Notificaciones" in Ajustes (spec 040 RF-1 to RF-4, RF-6, RF-14, RF-18).

type Result = { error?: string };

const NOT_SAVED = "No se ha podido guardar. Inténtalo de nuevo.";

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

export async function savePushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
  device: string;
}): Promise<Result> {
  const { endpoint, p256dh, auth, device } = subscription ?? {};
  if (
    !isText(endpoint, 2000) ||
    !endpoint.startsWith("https://") ||
    !isText(p256dh, 200) ||
    !isText(auth, 100) ||
    !isText(device, 80)
  ) {
    return { error: NOT_SAVED };
  }
  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase.rpc("save_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_device: device,
    });
    if (error) return { error: NOT_SAVED };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
  revalidatePath("/dashboard/settings");
  return {};
}

export async function removePushSubscription(id: string): Promise<Result> {
  if (!isText(id, 64)) return { error: NOT_SAVED };
  const { supabase, userId } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return { error: NOT_SAVED };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
  revalidatePath("/dashboard/settings");
  return {};
}

/** Sign out: this device stops getting the user's notices (RF-18). */
export async function removeDeviceSubscription(
  endpoint: string,
): Promise<Result> {
  if (!isText(endpoint, 2000)) return {};
  const { supabase, userId } = await requireActionUser();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  return {};
}

/** "Enviar un aviso de prueba" to this device (RF-4). */
export async function sendTestPush(endpoint: string): Promise<Result> {
  if (!isText(endpoint, 2000)) return { error: TEST_FAILED };
  const vapid = vapidFromEnv();
  if (!vapid) return { error: TEST_FAILED };
  const { supabase, userId } = await requireActionUser();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { error: TEST_FAILED };
  const result = await sendPush(
    data,
    {
      title: "CaFam",
      body: "Así se verán tus avisos.",
      url: "/dashboard/settings",
      tag: "test",
    },
    vapid.keys,
    vapid.subject,
  );
  if (result === "gone") {
    await supabase.from("push_subscriptions").delete().eq("id", data.id);
    revalidatePath("/dashboard/settings");
  }
  return result === "ok" ? {} : { error: TEST_FAILED };
}

const TEST_FAILED =
  "No se ha podido enviar el aviso. Vuelve a activarlos en este dispositivo.";

const NOTIFY_KEYS = ["joined", "access", "comments", "changes"] as const;
export type NotifyPrefs = Record<(typeof NOTIFY_KEYS)[number], boolean>;

export async function setNotificationPrefs(
  notify: NotifyPrefs,
): Promise<Result> {
  if (!NOTIFY_KEYS.every((key) => typeof notify?.[key] === "boolean")) {
    return { error: NOT_SAVED };
  }
  const value = Object.fromEntries(NOTIFY_KEYS.map((k) => [k, notify[k]]));
  return updateProfile({ notify: value });
}

const TIMED = new Set<number>(REMINDER_OPTIONS.timed.map((o) => o.minutes));
const ALL_DAY = new Set<number>(REMINDER_OPTIONS.allDay.map((o) => o.minutes));

/** "Aviso por defecto"; null is "Ninguno" (RF-6). */
export async function setDefaultReminders(defaults: {
  timed: number | null;
  allDay: number | null;
}): Promise<Result> {
  const { timed, allDay } = defaults ?? {};
  const ok = (value: unknown, set: Set<number>) =>
    value === null || (typeof value === "number" && set.has(value));
  if (!ok(timed, TIMED) || !ok(allDay, ALL_DAY)) return { error: NOT_SAVED };
  return updateProfile({
    reminder_minutes: timed ?? null,
    reminder_all_day_minutes: allDay ?? null,
  });
}

async function updateProfile(
  update:
    | { notify: Record<string, boolean> }
    | {
        reminder_minutes: number | null;
        reminder_all_day_minutes: number | null;
      },
): Promise<Result> {
  const { supabase, userId } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", userId)
      .select("id");
    if (error || !data?.length) return { error: NOT_SAVED };
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
  return {};
}
