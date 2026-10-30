import { act, render, screen } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventForm,
  type EventFormValues,
} from "@/components/calendar/event-form";
import { EventModal } from "@/components/calendar/event-modal";
import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms/form-state";

// Spec 008, T5: the new-event form inside the window (RF-1, RF-7, RF-8, RF-9).
type State = FormState<keyof EventFormValues>;

const router = vi.hoisted(() => ({ back: vi.fn(), refresh: vi.fn() }));
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
  router.back.mockClear();
  router.refresh.mockClear();
});

const INITIAL: EventFormValues = {
  title: "",
  calendarId: "cal-a",
  allDay: "",
  startDate: "2026-11-02",
  startTime: "09:00",
  endDate: "2026-11-02",
  endTime: "10:00",
  description: "",
  location: "",
  color: "",
  categoryId: "",
  repeat: "none",
};

function setup(result: (formData: FormData) => State) {
  const action = vi.fn(async (_prev: State, formData: FormData) =>
    result(formData),
  );
  render(
    <ToastProvider>
      <EventModal title="Nuevo evento">
        <EventForm
          action={action}
          initial={INITIAL}
          calendars={[{ id: "cal-a", name: "Familia", color: "#A0C4FF" }]}
          categories={[]}
          submitLabel="Crear evento"
          pendingLabel="Creando…"
          cancelHref="/dashboard/calendar"
        />
      </EventModal>
    </ToastProvider>,
  );
  return action;
}

describe("event form in the window", () => {
  it("sends mode=modal, then closes, refreshes and announces the result (RF-8)", async () => {
    const action = setup(() => ({ values: INITIAL, done: "created" }));

    await userEvent.type(screen.getByLabelText("Título"), "Cena");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));

    expect(action.mock.calls[0]![1].get("mode")).toBe("modal");
    // The status region always exists: wait for the text, not for the region.
    expect(await screen.findByText("Evento creado")).toBeVisible();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("stays open with what was typed when saving fails (RF-9)", async () => {
    setup((formData) => ({
      values: { ...INITIAL, title: String(formData.get("title")) },
      formError: "No se ha podido conectar.",
    }));

    await userEvent.type(screen.getByLabelText("Título"), "Cena");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido conectar.",
    );
    expect(screen.getByLabelText("Título")).toHaveValue("Cena");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("closes at once when nothing was changed", async () => {
    setup(() => ({ values: INITIAL }));

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("asks before throwing away changes (RF-7)", async () => {
    setup(() => ({ values: INITIAL }));
    await userEvent.type(screen.getByLabelText("Título"), "Cena");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText("¿Descartar los cambios?")).toBeVisible();
    expect(router.back).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Seguir editando" }),
    );
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
    expect(screen.getByLabelText("Título")).toHaveValue("Cena");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Descartar cambios" }),
    );
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("opens fresh when Next shows the kept route again (Activity)", async () => {
    const action = vi.fn(async (_prev: State, formData: FormData) => ({
      values: { ...INITIAL, title: String(formData.get("title")) },
      done: "created" as const,
    }));
    const tree = (mode: "visible" | "hidden"): ReactNode => (
      <ToastProvider>
        <Activity mode={mode}>
          <EventModal title="Nuevo evento">
            <EventForm
              action={action}
              initial={INITIAL}
              calendars={[{ id: "cal-a", name: "Familia", color: "#A0C4FF" }]}
              categories={[]}
              submitLabel="Crear evento"
              pendingLabel="Creando…"
              cancelHref="/dashboard/calendar"
            />
          </EventModal>
        </Activity>
      </ToastProvider>
    );
    const { rerender } = render(tree("visible"));
    await userEvent.type(screen.getByLabelText("Título"), "Cena");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));
    await screen.findByText("Evento creado");
    expect(router.back).toHaveBeenCalledTimes(1);

    act(() => rerender(tree("hidden")));
    act(() => rerender(tree("visible")));

    // The old success must not close the window again, nor bring back the old title.
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Título")).toHaveValue("");
  });
});
