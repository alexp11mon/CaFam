import { describe, expect, it } from "vitest";
import { deviceName, pushSupport } from "@/lib/push/device";

// Spec 040, T2: the device of a subscription and whether it can get notices
// (RF-1, RF-3).
const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  firefoxMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:132.0) Gecko/20100101 Firefox/132.0",
};

describe("deviceName", () => {
  it.each([
    [UA.chromeWindows, "Chrome en Windows"],
    [UA.edge, "Edge en Windows"],
    [UA.iphone, "Safari en iPhone"],
    [UA.android, "Chrome en Android"],
    [UA.firefoxMac, "Firefox en Mac"],
    ["algo raro", "Navegador"],
  ])("%s → %s", (ua, name) => {
    expect(deviceName(ua)).toBe(name);
  });
});

describe("pushSupport", () => {
  const base = {
    userAgent: UA.chromeWindows,
    hasPush: true,
    standalone: false,
    permission: "default" as NotificationPermission,
  };

  it("is ready where push exists and is not denied", () => {
    expect(pushSupport(base)).toBe("ready");
  });

  it("asks to install on an iPhone outside the app", () => {
    expect(pushSupport({ ...base, userAgent: UA.iphone, hasPush: false })).toBe(
      "ios-install",
    );
    expect(
      pushSupport({ ...base, userAgent: UA.iphone, standalone: true }),
    ).toBe("ready");
  });

  it("explains a denied permission and a browser without push", () => {
    expect(pushSupport({ ...base, permission: "denied" })).toBe("denied");
    expect(pushSupport({ ...base, hasPush: false })).toBe("unsupported");
  });
});
