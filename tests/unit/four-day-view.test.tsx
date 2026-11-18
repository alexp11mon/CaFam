import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { ToastProvider } from "@/components/ui/toast";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 042 T3: the 4 days are the week's grid with 4 columns (RF-6, RF-7).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/calendar",
}));
vi.mock("@/app/dashboard/settings/actions", () => ({
  setTheme: vi.fn(async () => ({})),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const TZ = "Europe/Madrid";

function setup() {
  const days = getVisibleRange("4days", "2026-11-20", TZ).days;
  render(
    <ToastProvider>
      <CalendarWorkspace
        view="4days"
        date="2026-11-20"
        days={days}
        today="2026-11-19"
        timeZone={TZ}
        events={[
          {
            id: "e1",
            title: "Pádel",
            startsAt: "2026-11-22T09:00:00.000Z",
            endsAt: "2026-11-22T10:00:00.000Z",
            allDay: false,
            calendarId: "c1",
            categoryId: null,
            color: "#A0C4FF",
          },
        ]}
        canCreate
        groups={[
          {
            person: { id: "me", displayName: "Yo", isMe: true },
            calendars: [
              {
                id: "c1",
                name: "Mi calendario",
                ownerId: "me",
                createdAt: "2026-01-01T00:00:00Z",
                color: "#A0C4FF",
                visible: true,
              },
            ],
          },
        ]}
        categories={[]}
        setCalendarVisibility={vi.fn(async () => ({}))}
        setPersonVisibility={vi.fn(async () => ({}))}
        saveOrder={vi.fn(async () => ({}))}
        editableCalendars={[
          { id: "c1", name: "Mi calendario", color: "#A0C4FF" },
        ]}
        createAction={vi.fn(async () => ({ values: {} as never }))}
        busyPeople={[{ id: "ana", name: "Ana", shown: true }]}
        busyIntervals={[
          {
            personId: "ana",
            startsAt: "2026-11-21T16:00:00.000Z",
            endsAt: "2026-11-21T17:00:00.000Z",
            allDay: false,
          },
        ]}
      />
    </ToastProvider>,
  );
  return days;
}

describe("4-day view", () => {
  it("draws 4 days, weekend included, with slots to create", () => {
    setup();
    const headers = screen.getAllByTestId("day-header");
    expect(headers.map((h) => h.textContent)).toEqual([
      "V20",
      "S21",
      "D22",
      "L23",
    ]);
    expect(screen.getAllByTestId("slot-layer")).toHaveLength(4);
  });

  it("lets an editable event be moved and resized, as in the week", () => {
    setup();
    const block = document.querySelector('[data-event-id="e1"]')!;
    expect(block).not.toBeNull();
    expect(block.querySelector("[data-resize]")).not.toBeNull();
  });

  it("shows other people's busy times", () => {
    setup();
    expect(screen.getAllByText(/Ocupado · Ana/).length).toBeGreaterThan(0);
  });
});
