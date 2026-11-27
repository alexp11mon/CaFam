import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineApp } from "@/components/offline/offline-app";
import { ToastProvider } from "@/components/ui/toast";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import { offlineNowData } from "@/lib/offline/offline-sources";
import { clearQueue } from "@/lib/offline/queue-store";
import { SNAPSHOT_FORMAT, type Snapshot } from "@/lib/offline/snapshot";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 054 T8: "Ahora" from the device's copy (RF-21, RF-22, RF-25).
vi.mock("next/navigation", () => ({
  usePathname: () => "/offline",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/dashboard/offline-actions", () => ({
  loadOfflineSnapshot: vi.fn(),
  applyOfflineChange: vi.fn(),
}));
vi.mock("@/app/(auth)/actions", () => ({ signOut: vi.fn() }));
const live = vi.hoisted(() => ({ useLiveCalendar: vi.fn() }));
vi.mock("@/lib/hooks/use-live-calendar", () => live);

const NOW = Date.parse("2026-11-17T10:30:00Z");

const copy = (home?: "calendar" | "now") =>
  ({
    format: SNAPSHOT_FORMAT,
    userId: "me",
    savedAt: "2026-11-17T08:00:00Z",
    today: "2026-11-17",
    range: { from: "2026-10-17", to: "2027-02-17" },
    profile: {
      timeZone: "UTC",
      displayName: "Ana",
      accent: "red",
      theme: "light",
      lastView: "agenda",
      showWeekends: true,
      duration: 60,
      ...(home ? { home } : {}),
    },
    calendars: [
      {
        id: "school",
        name: "Cole",
        color: "#A0C4FF",
        ownerId: "son",
        role: "viewer",
        synced: null,
      },
    ],
    categories: [],
    groups: [],
    people: [
      { id: "me", displayName: "Ana" },
      { id: "son", displayName: "Hugo" },
    ],
    busyPeople: [{ id: "aunt", name: "Marta", shown: true }],
    preferences: { calendarPreferences: [], personPreferences: [] },
    series: [],
    exceptions: [],
    comments: [],
    images: [],
    notes: [],
    events: [
      {
        id: "e1",
        calendarId: "school",
        title: "Mates",
        startsAt: "2026-11-17T10:00:00Z",
        endsAt: "2026-11-17T11:00:00Z",
        allDay: false,
        location: null,
      },
    ],
  }) as unknown as Snapshot;

describe("offlineNowData", () => {
  it("takes the events of the copy and has no busy times (RF-21, RF-22)", () => {
    const data = offlineNowData(copy(), NOW)!;
    expect(data.day).toBe("2026-11-17");
    expect(data.busy).toBeNull();
    expect(data.events.map((e) => e.id)).toEqual(["e1"]);
    expect(data.busyPeople).toEqual([
      { id: "aunt", name: "Marta", shown: true },
    ]);
  });

  it("has nothing to say outside the copy or for an older copy", () => {
    expect(
      offlineNowData(copy(), Date.parse("2027-03-01T10:00:00Z")),
    ).toBeNull();
    const old = { ...copy(), busyPeople: undefined } as Snapshot;
    expect(offlineNowData(old, NOW)!.busyPeople).toEqual([]);
  });
});

async function open(from: string, snapshot: Snapshot) {
  await db.claimFor("me");
  await db.saveSnapshot(snapshot);
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  db.forgetConnection();
  await clearQueue();
  await setSnapshot(null);
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(() => {
  vi.useRealTimers();
  resetConnection();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("OfflineApp and Ahora", () => {
  it("opens Ahora at /dashboard when it is the home screen (RF-25)", async () => {
    await open("/dashboard", copy("now"));
    expect(
      await screen.findByRole("region", { name: "Hugo" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard/now");
    expect(screen.getByText("Cole · hasta las 11:00")).toBeInTheDocument();
    // Seen only through availability: no data without connection (RF-22).
    expect(screen.getByText("Sin datos sin conexión")).toBeInTheDocument();
    expect(live.useLiveCalendar).toHaveBeenCalledWith(undefined);
  });

  it("opens the calendar at /dashboard for an older copy without home", async () => {
    await open("/dashboard", copy());
    await waitFor(() =>
      expect(window.location.pathname).toBe("/dashboard/calendar"),
    );
    expect(screen.queryByRole("region", { name: "Hugo" })).toBeNull();
  });

  it("shows Ahora at its own address with the offline notice of the app", async () => {
    await open("/dashboard/now", copy());
    expect(
      await screen.findByRole("region", { name: "Ana (tú)" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Sin conexión/i).length).toBeGreaterThan(0);
  });
});
