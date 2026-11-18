// The device of a push subscription and whether this one can get notices
// (spec 040 RF-1, RF-3). Pure: the browser values come as arguments.

function browserOf(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

function systemOf(ua: string): string | null {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

/** "Chrome en Windows", "Safari en iPhone"… shown in "Dispositivos con avisos". */
export function deviceName(userAgent: string): string {
  const browser = browserOf(userAgent);
  const system = systemOf(userAgent);
  if (browser && system) return `${browser} en ${system}`;
  return browser ?? system ?? "Navegador";
}

export type PushSupport = "ready" | "denied" | "ios-install" | "unsupported";

/**
 * Whether this browser can turn notices on. iOS only has push in the app
 * added to the home screen (iOS 16.4+, RF-3).
 */
export function pushSupport({
  userAgent,
  hasPush,
  standalone,
  permission,
}: {
  userAgent: string;
  hasPush: boolean;
  standalone: boolean;
  permission: NotificationPermission;
}): PushSupport {
  const ios = /iPhone|iPad/.test(userAgent);
  if (ios && !standalone) return "ios-install";
  if (!hasPush) return "unsupported";
  if (permission === "denied") return "denied";
  return "ready";
}
