import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CalendarWorkspace,
  type FilterSection,
} from "@/components/calendar/calendar-workspace";
import type { AgendaEvent } from "@/components/calendar/agenda-view";
import { ToastProvider } from "@/components/ui/toast";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 054 T6: the calendar of one person from "Ahora" (RF-17, plan D7, R4).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/calendar",
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
const DAY = "2026-11-02";
const calendar = (
  id: string,
  ownerId: string,
  visible: boolean,
  name = id,
) => ({
  id,
  name,
  ownerId,
  createdAt: "2026-01-01T00:00:00Z",
  color: "#A0C4FF",
  visible,
});

const GROUPS: FilterSection[] = [
  {
    person: { id: "me", displayName: "Yo", isMe: true },
    calendars: [calendar("mine", "me", true, "Mío")],
  },
  // A group of the user holding a calendar of Hugo's (R4).
  {
    person: { id: "g", displayName: "Colegio", isMe: false },
    groupId: "g",
    calendars: [calendar("school", "son", true, "Cole")],
  },
  {
    person: { id: "son", displayName: "Hugo", isMe: false },
    calendars: [calendar("football", "son", false, "Fútbol")],
  },
];

const event = (id: string, calendarId: string, title: string): AgendaEvent =>
  ({
    id,
    calendarId,
    title,
    startsAt: `${DAY}T00:00:00Z`,
    endsAt: "2026-11-03T00:00:00Z",
    allDay: true,
    color: null,
    categoryId: null,
    location: null,
    imageCount: 0,
    commentCount: 0,
    seriesId: null,
  }) as AgendaEvent;

const EVENTS = [
  event("e1", "mine", "Dentista"),
  event("e2", "school", "Mates"),
  event("e3", "football", "Partido"),
];

function setup(only?: string) {
  const setCalendarVisibility = vi.fn(async () => ({}));
  window.history.replaceState(
    null,
    "",
    `/dashboard/calendar?view=month&date=${DAY}${only ? `&only=${only}` : ""}`,
  );
  render(
    <ToastProvider>
      <CalendarWorkspace
        view="month"
        date={DAY}
        days={getVisibleRange("month", DAY, TZ).days}
        today={DAY}
        timeZone={TZ}
        events={EVENTS}
        groups={GROUPS}
        categories={[]}
        setCalendarVisibility={setCalendarVisibility}
        setPersonVisibility={vi.fn(async () => ({}))}
        saveOrder={vi.fn(async () => ({}))}
        only={only}
      />
    </ToastProvider>,
  );
  return { setCalendarVisibility };
}

const titles = () =>
  ["Dentista", "Mates", "Partido"].filter(
    (title) => screen.queryAllByText(title).length > 0,
  );

describe("only=<person>", () => {
  it("shows every calendar of that person, also in a group, and none else", () => {
    setup("son");
    expect(titles()).toEqual(["Mates", "Partido"]);
    expect(screen.getByText("Viendo solo a Hugo")).toBeVisible();
  });

  it("is ignored for someone not followed", () => {
    setup("stranger");
    expect(titles()).toEqual(["Dentista", "Mates"]);
    expect(screen.queryByText(/Viendo solo a/)).toBeNull();
  });

  it("goes back to the saved filters with Ver todos", async () => {
    setup("son");
    await userEvent.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(titles()).toEqual(["Dentista", "Mates"]);
    expect(window.location.search).toBe(`?view=month&date=${DAY}`);
  });

  it("leaves when a filter changes, saving only that change (D7)", async () => {
    const { setCalendarVisibility } = setup("son");
    const [checkbox] = screen.getAllByRole("checkbox", { name: /Mío/ });
    await userEvent.click(checkbox!);
    await waitFor(() => expect(setCalendarVisibility).toHaveBeenCalledTimes(1));
    expect(setCalendarVisibility).toHaveBeenCalledWith("mine", true);
    expect(window.location.search).not.toContain("only");
    expect(screen.queryByText(/Viendo solo a/)).toBeNull();
  });
});
