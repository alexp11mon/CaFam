import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventFormValues } from "@/components/calendar/event-form";
import { QuickCreate } from "@/components/calendar/quick-create";
import { ToastProvider } from "@/components/ui/toast";
import type { Draft } from "@/lib/calendar/draft";
import type { FormState } from "@/lib/forms/form-state";
import { isLiveHeld } from "@/lib/calendar/live-hold";

// Spec 008, T14: the quick window next to the chosen slot (RF-28, RF-37..RF-39, RF-41).
type State = FormState<keyof EventFormValues>;

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = function show() {
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
  const onDraftChange = vi.fn();
  const view = render(
    <ToastProvider>
      <QuickCreate
        draft={draft}
        anchor={{ left: 600, top: 300, width: 120, height: 48 }}
        calendars={CALENDARS}
        defaultCalendarId="cal-b"
        action={action}
        onClose={onClose}
        onTitleChange={onTitleChange}
        onDraftChange={onDraftChange}
        timeZone="Europe/Madrid"
        defaultMinutes={60}
      />
    </ToastProvider>,
  );
  return { action, onClose, onTitleChange, onDraftChange, view };
}

describe("QuickCreate", () => {
  it("opens with the cursor in the phrase, the day, the hours and the calendar (RF-37, spec 041 RF-13)", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Nuevo evento" })).toBeVisible();
    expect(screen.getByLabelText("Escribe el evento")).toHaveFocus();
    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(screen.getByText("jueves, 22 de octubre")).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Hora de inicio" }),
    ).toHaveValue("14:30");
    expect(screen.getByRole("combobox", { name: "Hora de fin" })).toHaveValue(
      "15:30",
    );
    expect(screen.getByLabelText("Calendario")).toHaveValue("cal-b");
  });

  it("grows out of the slot it was opened from (spec 021 RF-8)", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    // The slot is on its right: it grows from its right edge.
    expect(dialog.style.getPropertyValue("--pop-origin")).toMatch(
      /^384px \d+px$/,
    );
    expect(dialog).toHaveClass("origin-(--pop-origin)");
  });

  it("holds others' changes while open (spec 019 RF-43)", () => {
    const view = render(<span />);
    expect(isLiveHeld()).toBe(false);
    view.unmount();
    setup();
    expect(isLiveHeld()).toBe(true);
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

// Spec 019, T13: the hours of the sheet and the provisional block are one (RF-36, RF-37, RF-39).
describe("QuickCreate and the provisional block", () => {
  it("moves the block when the hours change in the window (RF-39)", async () => {
    const { onDraftChange } = setup();
    const start = screen.getByRole("combobox", { name: "Hora de inicio" });
    await userEvent.clear(start);
    await userEvent.type(start, "16:00");
    await userEvent.tab();

    // The end follows the start, keeping the hour.
    expect(onDraftChange).toHaveBeenLastCalledWith({
      startMinute: 960,
      endMinute: 1020,
    });
  });

  it("shows the hours of a block moved or stretched on the grid (RF-36, RF-37)", () => {
    const { view, onDraftChange } = setup();
    view.rerender(
      <ToastProvider>
        <QuickCreate
          draft={{ ...TIMED, startMinute: 15 * 60, endMinute: 16 * 60 + 15 }}
          anchor={null}
          calendars={CALENDARS}
          defaultCalendarId="cal-b"
          action={vi.fn()}
          onClose={vi.fn()}
          onTitleChange={vi.fn()}
          onDraftChange={onDraftChange}
          timeZone="Europe/Madrid"
          defaultMinutes={60}
        />
      </ToastProvider>,
    );

    expect(
      screen.getByRole("combobox", { name: "Hora de inicio" }),
    ).toHaveValue("15:00");
    expect(screen.getByRole("combobox", { name: "Hora de fin" })).toHaveValue(
      "16:15",
    );
  });

  it("leaves the week usable on a phone: not modal (RF-35)", () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof matchMedia;
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    setup();
    expect(showModal).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Nuevo evento" }),
    ).toHaveAttribute("open");
    // @ts-expect-error jsdom has none by default
    delete window.matchMedia;
  });

  describe("Escribe el evento (spec 041)", () => {
    it("previews and fills the window, without overwriting the title typed", async () => {
      const user = userEvent.setup();
      const { action, onTitleChange } = setup();
      await user.type(
        screen.getByLabelText("Escribe el evento"),
        "Cena con Ana el 25 de octubre de 2026 de 21 a 23 en casa @familia",
      );
      expect(
        await screen.findByText(
          "Cena con Ana · Domingo, 25 de octubre · 21:00–23:00 · casa · @Familia",
        ),
      ).toBeVisible();
      // Intro applies; it never saves.
      await user.keyboard("{Enter}");
      expect(action).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Título")).toHaveValue("Cena con Ana");
      expect(onTitleChange).toHaveBeenLastCalledWith("Cena con Ana");
      expect(
        screen.getByRole("combobox", { name: "Hora de inicio" }),
      ).toHaveValue("21:00");
      expect(screen.getByRole("combobox", { name: "Hora de fin" })).toHaveValue(
        "23:00",
      );
      expect(screen.getByLabelText("Calendario")).toHaveValue("cal-a");
      expect(screen.getByText("domingo, 25 de octubre")).toBeVisible();

      // A title changed by hand stays when the phrase is applied again.
      await user.clear(screen.getByLabelText("Título"));
      await user.type(screen.getByLabelText("Título"), "Cumple");
      await user.clear(screen.getByLabelText("Escribe el evento"));
      await user.type(
        screen.getByLabelText("Escribe el evento"),
        "Comida el 26 de octubre de 2026 cada semana",
      );
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByLabelText("Título")).toHaveValue("Cumple");

      await user.click(screen.getByRole("button", { name: "Guardar" }));
      const sent = action.mock.calls[0]![1];
      expect(sent.get("title")).toBe("Cumple");
      expect(sent.get("startDate")).toBe("2026-10-26");
      expect(sent.get("allDay")).toBe("on");
      expect(sent.get("location")).toBe("casa");
      expect(sent.get("repeat")).toBe("weekly");
      expect(sent.get("phrase")).toBeNull();
    });

    it("says what is not certain", async () => {
      const user = userEvent.setup();
      setup();
      await user.type(
        screen.getByLabelText("Escribe el evento"),
        "Médico el 25 de octubre de 2026 a las 5 @gimnasio",
      );
      expect(
        await screen.findByText("Se entiende por la tarde: 17:00."),
      ).toBeVisible();
      expect(
        screen.getByText("No hay ningún calendario «gimnasio»."),
      ).toBeVisible();
    });
  });
});
