import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DayTasks,
  TasksContext,
  tasksByDay,
  taskLabel,
  type CalendarTask,
} from "@/components/calendar/task-block";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import {
  AgendaView,
  type AgendaEvent,
} from "@/components/calendar/agenda-view";
import { getVisibleRange } from "@/lib/calendar/ranges";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Spec 048 RF-6, RF-7: dated tasks in the calendar.
const task = (over: Partial<CalendarTask> = {}): CalendarTask => ({
  noteId: "n1",
  itemId: "i1",
  text: "Pan",
  noteTitle: "Compra",
  calendarId: null,
  dueDate: "2026-12-03",
  dueTime: null,
  ...over,
});

function day(tasks: CalendarTask[], shown = true, limit?: number) {
  const complete = vi.fn();
  render(
    <TasksContext
      value={{ shown, setShown: vi.fn(), byDay: tasksByDay(tasks), complete }}
    >
      <DayTasks day="2026-12-03" limit={limit} />
    </TasksContext>,
  );
  return complete;
}

describe("task blocks", () => {
  it("says the item, its note and its hour", () => {
    expect(taskLabel(task())).toBe("Pan · Compra");
    expect(taskLabel(task({ dueTime: "09:00:00" }))).toBe("09:00 Pan · Compra");
    // A dated note is only its title.
    expect(
      taskLabel(task({ itemId: null, text: "Regalos", noteTitle: "Regalos" })),
    ).toBe("Regalos");
  });

  it("completes an item from its box and opens the note from its text", async () => {
    const complete = day([
      task(),
      task({
        itemId: null,
        text: "Regalos",
        noteTitle: "Regalos",
        noteId: "n2",
      }),
    ]);
    const list = screen.getByRole("list", { name: "Tareas con fecha" });
    expect(
      within(list).getByRole("link", { name: "Tarea: Pan · Compra" }),
    ).toHaveAttribute("href", "/dashboard/notes/n1");
    // Nothing to tick for a note.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Completar «Pan»" }),
    );
    expect(complete).toHaveBeenCalledWith(task());
  });

  it("draws nothing while hidden or without context, and counts the rest", () => {
    day([task()], false);
    expect(screen.queryByRole("list")).toBeNull();
    render(<DayTasks day="2026-12-03" />);
    expect(screen.queryByRole("list")).toBeNull();
    day(
      [
        task(),
        task({ itemId: "i2", text: "Leche" }),
        task({ itemId: "i3", text: "Fruta" }),
      ],
      true,
      1,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});

// Where each view puts them (spec 048 RF-6): the all-day strip, the month's
// cell and the agenda's day.
describe("tasks in the views", () => {
  const TZ = "Europe/Madrid";
  const DAY = "2026-12-03";
  const provide = (ui: React.ReactNode, shown = true) =>
    render(
      <TasksContext
        value={{
          shown,
          setShown: vi.fn(),
          byDay: tasksByDay([task()]),
          complete: vi.fn(),
        }}
      >
        {ui}
      </TasksContext>,
    );
  const week = getVisibleRange("week", DAY, TZ).days;

  it("week: in the all-day strip of its day", () => {
    provide(<WeekView days={week} events={[]} timeZone={TZ} today={DAY} />);
    const strip = screen.getByTestId("banner-strip");
    expect(
      within(strip).getByRole("checkbox", { name: "Completar «Pan»" }),
    ).toBeInTheDocument();
  });

  it("month: at the foot of its cell", () => {
    const month = getVisibleRange("month", DAY, TZ).days;
    provide(
      <MonthView
        date={DAY}
        days={month}
        events={[]}
        timeZone={TZ}
        today={DAY}
      />,
    );
    const cell = document.querySelector(`[data-date="${DAY}"]`) as HTMLElement;
    expect(
      within(cell).getByRole("link", { name: "Tarea: Pan · Compra" }),
    ).toBeInTheDocument();
  });

  // jsdom has no scrolling.
  HTMLElement.prototype.scrollIntoView ??= () => {};

  it("agenda: with the events of its day, and nothing while the switch is off", () => {
    const event = {
      id: "e1",
      title: "Cena",
      startsAt: `${DAY}T19:00:00Z`,
      endsAt: `${DAY}T20:00:00Z`,
      allDay: false,
      color: "#FFADAD",
      calendarId: "c1",
      categoryId: null,
      location: null,
      calendarName: "Casa",
    } satisfies AgendaEvent;
    const view = provide(
      <AgendaView days={week} events={[event]} timeZone={TZ} today={DAY} />,
    );
    const day = document.querySelector(`[data-day="${DAY}"]`) as HTMLElement;
    expect(
      within(day).getByRole("list", { name: "Tareas con fecha" }),
    ).toBeInTheDocument();
    view.unmount();
    provide(
      <AgendaView days={week} events={[event]} timeZone={TZ} today={DAY} />,
      false,
    );
    expect(screen.queryByRole("list", { name: "Tareas con fecha" })).toBeNull();
  });
});
