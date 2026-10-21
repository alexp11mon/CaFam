// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// Spec 002 RNF PWA (plan D10): the service worker must never keep calendar or
// event data, so a shared device does not leak them. It runs here in a fake worker scope.

const ORIGIN = "https://app.test";
const code = readFileSync("public/sw.js", "utf8");

type FetchListener = (event: {
  request: { method: string; url: string; mode: string };
  respondWith: (response: Promise<Response>) => void;
}) => void;

let cached: string[];
let handleFetch: FetchListener;
let networkDown: boolean;

beforeEach(() => {
  cached = [];
  networkDown = false;
  const cache = {
    match: async () => undefined,
    put: async (request: { url: string }) => {
      cached.push(request.url);
    },
    addAll: async () => {},
  };
  const listeners: Record<string, FetchListener> = {};
  runInNewContext(code, {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: FetchListener) => {
        listeners[type] = listener;
      },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => {
      if (networkDown) throw new TypeError("offline");
      return new Response("<html>private</html>", { status: 200 });
    },
    URL,
    Response,
    Promise,
  });
  handleFetch = listeners.fetch!;
});

/** Dispatches a request; resolves to whether the worker took it over. */
async function request(url: string, mode = "cors", method = "GET") {
  let handled = false;
  let response: Promise<Response> | undefined;
  handleFetch({
    request: { method, url: `${ORIGIN}${url}`, mode },
    respondWith: (value) => {
      handled = true;
      response = value;
    },
  });
  await response?.catch(() => undefined);
  return handled;
}

describe("service worker keeps no calendar data", () => {
  it("does not cache the calendar, event or panel pages when navigating", async () => {
    for (const path of [
      "/dashboard",
      "/dashboard/calendar?view=month&date=2026-11-02",
      "/dashboard/events/123",
      "/dashboard/calendars/1/edit",
      "/dashboard/calendars/merge",
    ]) {
      await request(path, "navigate");
    }

    expect(cached).toEqual([]);
  });

  it("leaves in-app data requests and server actions to the network", async () => {
    expect(await request("/dashboard/calendar?_rsc=abc")).toBe(false);
    expect(await request("/dashboard/events/123?_rsc=abc")).toBe(false);
    expect(await request("/dashboard/calendars/new", "cors", "POST")).toBe(
      false,
    );
    expect(cached).toEqual([]);
  });

  it("ignores other origins such as Supabase", async () => {
    let handled = false;
    handleFetch({
      request: {
        method: "GET",
        url: "https://abc.supabase.co/rest/v1/events?select=*",
        mode: "cors",
      },
      respondWith: () => {
        handled = true;
      },
    });

    expect(handled).toBe(false);
    expect(cached).toEqual([]);
  });

  it("shows the offline page, not stale data, when a page cannot load", async () => {
    networkDown = true;

    const handled = await request("/dashboard/calendar", "navigate");

    expect(handled).toBe(true);
    expect(cached).toEqual([]);
  });

  it("still caches hashed static assets, so the check above is meaningful", async () => {
    await request("/_next/static/chunks/app.js");

    expect(cached).toEqual([`${ORIGIN}/_next/static/chunks/app.js`]);
  });
});
