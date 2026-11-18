"use client";

import { useSyncExternalStore } from "react";
import { deviceName, pushSupport, type PushSupport } from "./device";

// The push subscription of this browser (spec 040 RF-1, RF-3, RF-18).

function readSupport(): PushSupport {
  const hasPush =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return pushSupport({
    userAgent: navigator.userAgent,
    hasPush,
    standalone,
    permission: "Notification" in window ? Notification.permission : "default",
  });
}

const noop = () => () => {};

/** Only known in the browser: "unsupported" while rendering on the server. */
export function useBrowserSupport(): PushSupport {
  return useSyncExternalStore(noop, readSupport, () => "unsupported");
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentEndpoint(): Promise<string | null> {
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  device: string;
}

/**
 * Asks permission (only after a press, RF-1) and subscribes. Null when the
 * user says no or there is no service worker (it only runs in production).
 */
export async function subscribeDevice(
  publicKey: string,
): Promise<DeviceSubscription | null> {
  if ((await Notification.requestPermission()) !== "granted") return null;
  const reg = await registration();
  if (!reg) return null;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(
        atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      ),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device: deviceName(navigator.userAgent),
  };
}

/** On sign out: this browser stops getting the user's notices (RF-18). */
export async function forgetPushSubscription(
  remove: (endpoint: string) => Promise<unknown>,
): Promise<void> {
  try {
    const reg = await registration();
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return;
    await remove(subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    // Nothing subscribed here, or no network: the server drops it when gone.
  }
}
