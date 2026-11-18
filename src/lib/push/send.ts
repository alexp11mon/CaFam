import { encryptPayload } from "./encrypt";
import type { PushPayload } from "./payload";
import { vapidHeader, type VapidKeys } from "./vapid";

// One Web Push request (spec 040 RF-2, RF-17; plan D1). Server only.

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SendResult = "ok" | "gone" | "retry";

/** A reminder older than a day is pointless: the push service may drop it. */
const TTL_S = 24 * 3600;
const TIMEOUT_MS = 10_000;

export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
  keys: VapidKeys,
  subject: string,
): Promise<SendResult> {
  const body = encryptPayload(
    Buffer.from(JSON.stringify(payload)),
    target.p256dh,
    target.auth,
  );
  try {
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        TTL: String(TTL_S),
        Urgency: "high",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: vapidHeader(target.endpoint, subject, keys),
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) return "gone";
    return response.ok ? "ok" : "retry";
  } catch {
    return "retry";
  }
}
