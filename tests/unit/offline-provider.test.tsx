import { render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { ToastProvider } from "@/components/ui/toast";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import {
  addChange,
  clearQueue,
  getQueueState,
} from "@/lib/offline/queue-store";
import {
  forgetDevice,
  getSnapshot,
  setSnapshot,
} from "@/lib/offline/snapshot-store";
import { SNAPSHOT_FORMAT, type Snapshot } from "@/lib/offline/snapshot";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T8: the owner of the copy and the queue in the app with a
// connection (RF-4, RF-6, RF-38, RF-39, RF-45, RF-64).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const nav = vi.hoisted(() => ({ loadPage: vi.fn() }));
vi.mock("@/lib/offline/navigate", () => nav);
const server = vi.hoisted(() => ({
  loadOfflineSnapshot: vi.fn(),
  applyOfflineChange: vi.fn(),
}));
vi.mock("@/app/dashboard/offline-actions", () => server);

const copy = (userId: string, savedAt: string): Snapshot =>
  ({
    format: SNAPSHOT_FORMAT,
    userId,
    savedAt,
    today: "2026-11-17",
    range: { from: "2026-10-17", to: "2027-02-17" },
    profile: { timeZone: "UTC" },
    calendars: [],
    series: [],
    exceptions: [],
    comments: [],
    images: [],
    events: [],
    notes: [],
  }) as unknown as Snapshot;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  db.forgetConnection();
  await clearQueue();
  await setSnapshot(null);
  server.loadOfflineSnapshot.mockResolvedValue({
    snapshot: copy("u1", new Date().toISOString()),
  });
  server.applyOfflineChange.mockResolvedValue({ status: "applied", id: "x" });
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

const mount = (userId = "u1") =>
  render(
    <ToastProvider>
      <OfflineProvider userId={userId} />
    </ToastProvider>,
  );

describe("OfflineProvider", () => {
  it("reads the copy on opening with a connection and keeps it (RF-4)", async () => {
    mount();
    await waitFor(() => expect(getSnapshot()?.userId).toBe("u1"));
    expect((await db.loadState()).snapshot?.userId).toBe("u1");
  });

  it("keeps a fresh copy without reading it again (RNF-4)", async () => {
    await db.saveSnapshot(copy("u1", new Date().toISOString()));
    mount();
    await waitFor(() => expect(getSnapshot()).not.toBeNull());
    expect(server.loadOfflineSnapshot).not.toHaveBeenCalled();
  });

  it("reads again a copy older than 15 minutes (RF-6)", async () => {
    await db.saveSnapshot(
      copy("u1", new Date(Date.now() - 16 * 60_000).toISOString()),
    );
    mount();
    await waitFor(() => expect(server.loadOfflineSnapshot).toHaveBeenCalled());
  });

  it("sends what waits, says so and refreshes (RF-39, RF-44, RF-45)", async () => {
    await addChange({ type: "note.delete", id: "n", base: {} as never });
    mount();
    expect(
      await screen.findByText("1 cambio sincronizado"),
    ).toBeInTheDocument();
    expect(server.applyOfflineChange).toHaveBeenCalledOnce();
    expect(getQueueState().queue).toEqual([]);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("drops another account's data and changes without sending them (RF-64)", async () => {
    await db.saveSnapshot(copy("old", new Date().toISOString()));
    await addChange({ type: "note.delete", id: "n", base: {} as never });
    mount("u1");
    await waitFor(() => expect(getSnapshot()?.userId).toBe("u1"));
    expect(server.applyOfflineChange).not.toHaveBeenCalled();
    expect((await db.loadState()).queue).toEqual([]);
  });

  // Plan R10: offline, a link loads the page, which opens the offline app.
  it("loads a panel link without the network instead of a Next navigation", async () => {
    const { getByText } = render(
      <ToastProvider>
        <OfflineProvider userId="u1" />
        <Link href="/dashboard/notes">Notas</Link>
      </ToastProvider>,
    );
    startWatching();
    window.dispatchEvent(new Event("offline"));
    await waitFor(() => {
      getByText("Notas").click();
      expect(nav.loadPage).toHaveBeenCalledWith("/dashboard/notes");
    });
  });
});

/** What the service worker leaves after sending with the app closed. */
async function backgroundSent(applied: number) {
  await db.readMeta();
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(db.DB_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("meta", "readwrite");
      tx.objectStore("meta").put(
        { applied, at: new Date().toISOString() },
        "lastBackgroundSync",
      );
      tx.oncomplete = () => resolve();
    };
  });
}

// Spec 035 T11: after a send with the app closed, accounts connected again
// and signing out (RF-8, RF-43, RF-47).
describe("OfflineProvider, spec 035", () => {
  it("says on opening how many changes went with the app closed, once (RF-43)", async () => {
    await backgroundSent(3);
    mount();
    expect(
      await screen.findByText("3 cambios sincronizados"),
    ).toBeInTheDocument();
    await waitFor(async () =>
      expect(await db.readBackgroundSync()).toBeUndefined(),
    );
  });

  it("shows the conflicts the closed app left in the indicator's lists (RF-43)", async () => {
    await backgroundSent(1);
    await db.putConflict({
      changeId: "k1",
      change: { type: "note.delete", id: "n", base: {} as never },
      server: { title: "Compra" },
    });
    mount();
    await waitFor(() => expect(getQueueState().conflicts).toHaveLength(1));
  });

  it("keeps a change of an account to connect again, and sends it once connected (RF-7, RF-8)", async () => {
    server.applyOfflineChange.mockResolvedValue({
      status: "held",
      connectionId: "conn-1",
    });
    await addChange({ type: "note.delete", id: "n", base: {} as never });
    const first = mount();
    await waitFor(() =>
      expect(getQueueState().held).toEqual([
        expect.objectContaining({ connectionId: "conn-1" }),
      ]),
    );
    expect(getQueueState().queue).toHaveLength(1);
    first.unmount();

    // Connecting it again comes back to the app: the provider starts anew.
    server.applyOfflineChange.mockResolvedValue({ status: "applied" });
    mount();
    await waitFor(() => expect(getQueueState().queue).toEqual([]));
  });

  it("signing out leaves no thumbnails, images or pending images (RF-47)", async () => {
    await db.putThumb("i1", new Blob(["t"]));
    await db.putCachedImage("i1", { blob: new Blob(["f"]), usedAt: 1 });
    await db.savePendingImage({
      localId: "l1",
      eventId: "e1",
      full: new Blob(["f"]),
      thumb: new Blob(["t"]),
      width: 1,
      height: 1,
      bytes: 2,
      reservedId: null,
    });
    await forgetDevice();
    expect(await db.thumbIds()).toEqual([]);
    expect(await db.getCachedImage("i1")).toBeUndefined();
    expect(await db.getPendingImage("l1")).toBeUndefined();
  });
});
