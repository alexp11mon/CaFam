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
import { getSnapshot, setSnapshot } from "@/lib/offline/snapshot-store";
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
