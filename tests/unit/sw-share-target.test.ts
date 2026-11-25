// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 047 T2: public/sw.js receives what another app shares (RF-5, RF-10).
const ORIGIN = "https://app.test";
const code = readFileSync("public/sw.js", "utf8");

type FetchEvent = {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
};

let idb: ReturnType<typeof memoryIndexedDb>;
beforeEach(() => {
  idb = memoryIndexedDb();
});
afterEach(() => vi.useRealTimers());

function loadWorker() {
  const listeners: Record<string, (event: FetchEvent) => void> = {};
  let n = 0;
  runInNewContext(code, {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: (e: FetchEvent) => void) => {
        listeners[type] = listener;
      },
    },
    indexedDB: idb,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-00000000000${++n}` },
    Date,
    File,
    URL,
    Response,
    Promise,
  });
  return async (request: Request) => {
    let answer: Promise<Response> | undefined;
    listeners.fetch!({ request, respondWith: (r) => (answer = r) });
    return answer ? await answer : null;
  };
}

function share(fields: Record<string, string | File | File[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields))
    for (const item of Array.isArray(value) ? value : [value])
      form.append(key, item);
  return new Request(`${ORIGIN}/share-target`, { method: "POST", body: form });
}

const rows = () => [...(idb.databases.get("cafam-share")?.get("items") ?? [])];

describe("sw.js share target", () => {
  it("keeps the files on the device and answers 303 to the inbox", async () => {
    const fetch = loadWorker();
    const ics = new File(["BEGIN:VCALENDAR"], "cena.ics", {
      type: "text/calendar",
    });
    const response = await fetch(share({ files: ics, title: "Cena" }));
    expect(response?.status).toBe(303);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(response?.headers.get("Location")).toBe(
      `${ORIGIN}/dashboard/share?id=${id}`,
    );
    const [[key, item]] = rows() as [string, Record<string, unknown>][];
    expect(key).toBe(id);
    expect(item.text).toBe("Cena");
    const [file] = item.files as File[];
    expect(file.name).toBe("cena.ics");
    expect(await file.text()).toBe("BEGIN:VCALENDAR");
  });

  it("joins title, text and url and keeps at most 3 files", async () => {
    const fetch = loadWorker();
    const image = (n: number) =>
      new File(["x"], `foto${n}.jpg`, { type: "image/jpeg" });
    await fetch(
      share({
        title: "Mira",
        text: "cena el jueves",
        url: "https://ejemplo.test/x",
        files: [1, 2, 3, 4].map(image),
      }),
    );
    const [[, item]] = rows() as [string, Record<string, unknown>][];
    expect(item.text).toBe("Mira\ncena el jueves\nhttps://ejemplo.test/x");
    expect((item.files as File[]).map((f) => f.name)).toEqual([
      "foto1.jpg",
      "foto2.jpg",
      "foto3.jpg",
    ]);
  });

  it("drops what waited more than 10 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
    const fetch = loadWorker();
    await fetch(share({ text: "vieja" }));
    vi.setSystemTime(new Date("2026-11-25T10:11:00Z"));
    await fetch(share({ text: "nueva" }));
    expect(rows().map(([, item]) => (item as { text: string }).text)).toEqual([
      "nueva",
    ]);
  });

  it("leaves other requests alone", async () => {
    const fetch = loadWorker();
    expect(
      await fetch(new Request(`${ORIGIN}/api/x`, { method: "POST" })),
    ).toBeNull();
  });
});
