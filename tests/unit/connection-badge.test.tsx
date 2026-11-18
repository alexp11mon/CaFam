import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  badgeText,
  ConnectionBadge,
} from "@/components/offline/connection-badge";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { forgetConnection } from "@/lib/offline/db";
import { addChange, clearQueue } from "@/lib/offline/queue-store";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import type { Snapshot } from "@/lib/offline/snapshot";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T8: the state of the connection and what waits (RF-9, RF-29).
// T11: it opens the "Cambios" sheet.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/dashboard/offline-actions", () => ({
  applyOfflineChange: vi.fn(),
  loadOfflineSnapshot: vi.fn(),
}));
beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
});
afterEach(async () => {
  resetConnection();
  await setSnapshot(null);
  vi.unstubAllGlobals();
});

describe("badgeText (RF-9)", () => {
  const now = new Date("2026-11-17T18:00:00Z");
  it("says the hour of today's copy in the profile's zone", () => {
    expect(badgeText("2026-11-17T17:40:00Z", "Europe/Madrid", now)).toBe(
      "Sin conexión · datos de las 18:40",
    );
  });
  it("puts the day before an older copy", () => {
    expect(badgeText("2026-11-15T08:05:00Z", "Europe/Madrid", now)).toBe(
      "Sin conexión · datos del 15 nov a las 09:05",
    );
  });
});

describe("ConnectionBadge", () => {
  it("is not there online with nothing waiting", () => {
    const { container } = render(<ConnectionBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offline, says since when the data are and how many changes wait (RF-29)", async () => {
    await setSnapshot({
      savedAt: "2026-11-17T08:00:00Z",
      profile: { timeZone: "UTC" },
    } as Snapshot);
    render(<ConnectionBadge />);
    startWatching();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await act(async () => {
      await addChange({ type: "note.delete", id: "n", base: {} as never });
    });
    const badge = screen.getByRole("button");
    expect(badge.getAttribute("aria-label")).toMatch(
      /^Sin conexión · datos (de las|del .* a las) 08:00 · 1 cambio pendiente$/,
    );
  });
});
