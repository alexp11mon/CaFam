import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineApp } from "@/components/offline/offline-app";
import { ToastProvider } from "@/components/ui/toast";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import { clearQueue } from "@/lib/offline/queue-store";
import { SNAPSHOT_FORMAT, type Snapshot } from "@/lib/offline/snapshot";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T9: /offline opens the app from the device's copy at the address
// it came from (RF-7, RF-8, RF-12, RF-16, RF-17).
vi.mock("next/navigation", () => ({
  usePathname: () => "/offline",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/dashboard/offline-actions", () => ({
  loadOfflineSnapshot: vi.fn(),
  applyOfflineChange: vi.fn(),
}));
vi.mock("@/app/(auth)/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/hooks/use-live-calendar", () => ({ useLiveCalendar: vi.fn() }));

const COPY = {
  format: SNAPSHOT_FORMAT,
  userId: "me",
  savedAt: "2026-11-17T08:00:00Z",
  today: "2026-11-17",
  range: { from: "2026-10-17", to: "2027-02-17" },
  profile: {
    timeZone: "UTC",
    displayName: "Ana López",
    accent: "red",
    theme: "light",
    lastView: "agenda",
    showWeekends: true,
    duration: 60,
  },
  calendars: [],
  categories: [],
  groups: [],
  people: [],
  preferences: { calendarPreferences: [], personPreferences: [] },
  events: [],
  notes: [
    {
      id: "n1",
      kind: "text",
      title: "Ideas para el viaje",
      body: "Llevar paraguas",
      color: null,
      pinned: false,
      archived: false,
      dueDate: null,
      updatedAt: "2026-11-15T10:00:00Z",
      ownerId: "me",
      calendarId: null,
      calendarName: null,
      items: [],
    },
  ],
} as unknown as Snapshot;

async function open(from: string) {
  window.history.replaceState(
    null,
    "",
    `/offline?from=${encodeURIComponent(from)}`,
  );
  render(
    <ToastProvider>
      <OfflineApp fallback={<p>Sin copia</p>} />
    </ToastProvider>,
  );
  await act(async () => {});
}

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  db.forgetConnection();
  await clearQueue();
  await setSnapshot(null);
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("OfflineApp", () => {
  it("shows the screen of always without a copy on the device", async () => {
    await open("/dashboard/notes");
    expect(await screen.findByText("Sin copia")).toBeInTheDocument();
  });

  it("opens the notes of the copy at the address it came from", async () => {
    await db.claimFor("me");
    await db.saveSnapshot(COPY);
    await open("/dashboard/notes");

    expect(await screen.findByText("Ideas para el viaje")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard/notes");
    // The assistant needs the network (R2).
    expect(
      screen.queryByRole("button", { name: /Venito|Asistente/ }),
    ).not.toBeInTheDocument();
  });

  it("says a screen needs a connection", async () => {
    await db.claimFor("me");
    await db.saveSnapshot(COPY);
    await open("/dashboard/settings");

    expect(await screen.findByText(/Necesita conexión/)).toBeInTheDocument();
  });
});
