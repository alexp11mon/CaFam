// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Spec 040, T5: public/sw.js shows each push and opens its URL (RF-11).
const ORIGIN = "https://app.test";
const code = readFileSync("public/sw.js", "utf8");

type Listener = (event: Record<string, unknown>) => void;

interface FakeWindow {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
}

function loadWorker(windows: FakeWindow[] = []) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => null);
  runInNewContext(code, {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: Listener) => {
        listeners[type] = listener;
      },
      registration: { showNotification },
      clients: {
        matchAll: async () => windows,
        openWindow,
      },
    },
    URL,
    Response,
    Promise,
  });

  async function fire(type: string, event: Record<string, unknown>) {
    const work: Promise<unknown>[] = [];
    listeners[type]!({
      ...event,
      waitUntil: (p: Promise<unknown>) => work.push(p),
    });
    await Promise.all(work);
  }
  return { fire, showNotification, openWindow };
}

describe("sw.js push", () => {
  it("shows the notification with its tag and URL", async () => {
    const worker = loadWorker();
    const payload = {
      title: "Cena",
      body: "Hoy a las 18:30",
      url: "/dashboard/events/e1",
      tag: "event:e1",
    };
    await worker.fire("push", { data: { json: () => payload } });
    expect(worker.showNotification).toHaveBeenCalledWith(
      "Cena",
      expect.objectContaining({
        body: "Hoy a las 18:30",
        tag: "event:e1",
        renotify: true,
        icon: "/icons/icon-192.png",
        data: { url: "/dashboard/events/e1" },
      }),
    );
  });

  it("shows a plain notice when the push has no readable data", async () => {
    const worker = loadWorker();
    await worker.fire("push", { data: null });
    expect(worker.showNotification).toHaveBeenCalledWith(
      "CaFam",
      expect.objectContaining({ data: { url: "/dashboard/calendar" } }),
    );
  });
});

describe("sw.js notificationclick", () => {
  const click = (url: string) => ({
    notification: { data: { url }, close: vi.fn() },
  });

  it("focuses an open window of the app and takes it to the URL", async () => {
    const open: FakeWindow = {
      url: `${ORIGIN}/dashboard/calendar`,
      focus: vi.fn(async () => open),
      navigate: vi.fn(async () => open),
    };
    const worker = loadWorker([open]);
    const event = click("/dashboard/events/e1");
    await worker.fire("notificationclick", event);
    expect(event.notification.close).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/dashboard/events/e1`);
    expect(open.focus).toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens a window without one, and never another origin", async () => {
    const worker = loadWorker();
    await worker.fire("notificationclick", click("https://evil.test/x"));
    expect(worker.openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/dashboard/calendar`,
    );
  });
});

describe("sw.js cache", () => {
  it("is cafam-v8", () => {
    expect(code).toContain('const CACHE_NAME = "cafam-v8";');
  });
});
