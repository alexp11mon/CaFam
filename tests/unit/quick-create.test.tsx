import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventFormValues } from "@/components/calendar/event-form";
import { QuickCreate } from "@/components/calendar/quick-create";
import { ToastProvider } from "@/components/ui/toast";
import type { Draft } from "@/lib/calendar/draft";
import type { FormState } from "@/lib/forms/form-state";

// Spec 008, T14: the quick window next to the chosen slot (RF-28, RF-37..RF-39, RF-41).
type State = FormState<keyof EventFormValues>;

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  router.push.mockClear();
  router.refresh.mockClear();
});

const CALENDARS = [
  { id: "cal-a", name: "Familia", color: "#A0C4FF" },
  { id: "cal-b", name: "Trabajo", color: "#FFADAD" },
];

const TIMED: Draft = {
  day: "2026-10-22",
  allDay: false,
  startMinute: 14 * 60 + 30,
  endMinute: 15 * 60 + 30,
};

function setup(
  draft: Draft = TIMED,
  result: (formData: FormData) => State = () => ({
    values: {} as State["values"],
    done: "created",
  }),
) {
  const action = vi.fn(async (_prev: State, formData: FormData) =>
    result(formData),
  );
  const onClose = vi.fn();
  const onTitleChange = vi.fn();
  render(
    <ToastProvider>
      <QuickCreate
        draft={draft}
        anchor={{ left: 600, top: 300, width: 120, height: 48 }}
        calendars={CALENDARS}
        defaultCalendarId="cal-b"
        action={action}
        onClose={onClose}
        onTitleChange={onTitleChange}
      />
    </ToastProvider>,
  );
  return { action, onClose, onTitleChange };
}

describe("QuickCreate", () => {
  it("opens with the cursor in the title, the day, the hours and the calendar (RF-37, RF-28)", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Nuevo evento" })).toBeVisible();
    expect(screen.getByLabelText("Título")).toHaveFocus();
    expect(screen.getByText("jueves, 22 de octubre")).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Hora de inicio" }),
    ).toHaveValue("14:30");
    expect(screen.getByRole("combobox", { name: "Hora de fin" })).toHaveValue(
      "15:30",
    );
    expect(screen.getByLabelText("Calendario")).toHaveValue("cal-b");
  });

  it("passes each typed title on to the slot block (RF-40)", async () => {
    const { onTitleChange } = setup();

    await userEvent.type(screen.getByLabelText("Título"), "Cena");

    expect(onTitleChange).toHaveBeenLastCalledWith("Cena");
  });

  it("offers 'Añadir hora' for an all-day draft (RF-19)", async () => {
    setup({ ...TIMED, allDay: true });
    expect(
      screen.queryByRole("combobox", { name: "Hora de inicio" }),
    ).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Añadir hora" }));

    expect(
      screen.getByRole("combobox", { name: "Hora de inicio" }),
    ).toHaveValue("09:00");
    expect(screen.getByRole("combobox", { name: "Hora de fin" })).toHaveValue(
      "10:00",
    );
  });

  it("saves in window mode, then closes, refreshes and says so (RF-38)", async () => {
    const { action, onClose } = setup();
    await userEvent.type(screen.getByLabelText("Título"), "Cena");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const sent = Object.fromEntries(action.mock.calls[0]![1].entries());
    expect(sent).toMatchObject({
      mode: "modal",
      title: "Cena",
      calendarId: "cal-b",
      startDate: "2026-10-22",
      startTime: "14:30",
      endDate: "2026-10-22",
      endTime: "15:30",
    });
    expect(sent.allDay).toBeUndefined();
    expect(await screen.findByText("Evento creado")).toBeVisible();
    expect(onClose).toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("sends an all-day event as such", async () => {
    const { action } = setup({ ...TIMED, allDay: true });
    await userEvent.type(screen.getByLabelText("Título"), "Excursión");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(action.mock.calls[0]![1].get("allDay")).toBe("on");
  });

  it("stays open with the error when saving fails (RF-9)", async () => {
    const { onClose } = setup(TIMED, () => ({
      values: {} as State["values"],
      fieldErrors: { title: "Escribe un título." },
    }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Escribe un título.")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("takes what was typed to the full form (RF-39)", async () => {
    const { onClose } = setup();
    await userEvent.type(screen.getByLabelText("Título"), "Cena & amigos");
    await userEvent.selectOptions(screen.getByLabelText("Calendario"), "cal-a");

    await userEvent.click(screen.getByRole("button", { name: "Más opciones" }));

    expect(onClose).toHaveBeenCalled();
    const url = new URL(router.push.mock.calls[0]![0], "http://x");
    expect(url.pathname).toBe("/dashboard/events/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      date: "2026-10-22",
      start: "14:30",
      end: "15:30",
      calendar: "cal-a",
      title: "Cena & amigos",
    });
  });

  it("closes on Escape", () => {
    const { onClose } = setup();

    // jsdom does not turn Escape into the dialog's cancel event, browsers do.
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("becomes a sheet at the bottom on a phone (RF-41)", () => {
    setup();

    expect(screen.getByRole("dialog").className).toMatch(
      /max-\[48\.0625rem\]:bottom-0/,
    );
  });
});
