import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventForm,
  type EventFormValues,
} from "@/components/calendar/event-form";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { forgetConnection } from "@/lib/offline/db";
import { clearQueue, getQueueState } from "@/lib/offline/queue-store";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import type { Snapshot } from "@/lib/offline/snapshot";
import { memoryIndexedDb } from "./memory-indexeddb";

const CAL = "0b8f6c1e-2a4d-4c3b-9e7f-1a2b3c4d5e6f";

// Spec 034 T8: the event form without a connection (RF-19, RF-20, plan D17).
const loadPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/offline/navigate", () => ({ loadPage }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const INITIAL: EventFormValues = {
  title: "",
  calendarId: CAL,
  allDay: "",
  startDate: "2026-11-20",
  startTime: "09:00",
  endDate: "2026-11-20",
  endTime: "10:00",
  description: "",
  location: "",
  color: "",
  categoryId: "",
  repeat: "none",
  startTz: "",
  endTz: "",
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
  await setSnapshot({
    profile: { timeZone: "Europe/Madrid" },
    calendars: [
      { id: CAL, name: "Casa", color: "#A0C4FF", role: "editor", synced: null },
    ],
    events: [],
    notes: [],
  } as unknown as Snapshot);
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(async () => {
  resetConnection();
  await setSnapshot(null);
  vi.unstubAllGlobals();
});

function setup() {
  const action = vi.fn(async () => ({ values: INITIAL }));
  render(
    <EventForm
      action={action}
      initial={INITIAL}
      calendars={[{ id: CAL, name: "Casa", color: "#A0C4FF" }]}
      categories={[]}
      submitLabel="Crear evento"
      pendingLabel="Creando…"
      cancelHref="/dashboard/calendar"
    />,
  );
  return action;
}

describe("EventForm offline", () => {
  it("queues the new event with its own id and goes back to the calendar", async () => {
    const action = setup();
    await userEvent.type(screen.getByLabelText("Título"), "Dentista");
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: "Crear evento" }),
      );
    });
    expect(action).not.toHaveBeenCalled();
    const [entry] = getQueueState().queue;
    expect(entry?.change).toMatchObject({
      type: "event.create",
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      data: {
        title: "Dentista",
        calendarId: CAL,
        startsAt: "2026-11-20T08:00:00.000Z",
      },
    });
    expect(loadPage).toHaveBeenCalledWith("/dashboard/calendar");
  });

  it("says what is wrong here, as the server would, and queues nothing", async () => {
    const action = setup();
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: "Crear evento" }),
      );
    });
    expect(
      await screen.findByText(/título/i, { selector: "[id]" }),
    ).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
    expect(getQueueState().queue).toEqual([]);
  });
});
