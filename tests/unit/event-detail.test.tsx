import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  EventDetail,
  type EventDetailData,
} from "@/components/calendar/event-detail";
import type { ConfirmState } from "@/lib/forms/form-state";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const EVENT: EventDetailData = {
  id: "e1",
  title: "Matemáticas",
  startsAt: "2026-11-02T07:00:00Z",
  endsAt: "2026-11-02T08:30:00Z",
  allDay: false,
  description: "Álgebra lineal",
  location: "Aula 3",
  color: null,
  calendarName: "Clases Uni",
  calendarColor: "#A0C4FF",
  categoryName: "Clases de la UNI",
};

function setup(
  overrides: Partial<React.ComponentProps<typeof EventDetail>> = {},
) {
  const remove = vi.fn<(prev: ConfirmState) => Promise<ConfirmState>>(
    async () => ({}),
  );
  render(
    <EventDetail
      event={EVENT}
      timeZone="Europe/Madrid"
      canEdit
      deleteAction={remove}
      {...overrides}
    />,
  );
  return remove;
}

describe("EventDetail (RF-34, RF-36)", () => {
  it("shows title, dates, description, place, category and calendar", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Matemáticas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/lunes, 2 de noviembre de 2026/)).toHaveTextContent(
      "08:00 – 09:30",
    );
    expect(screen.getByText("Álgebra lineal")).toBeInTheDocument();
    expect(screen.getByText("Aula 3")).toBeInTheDocument();
    expect(screen.getByText("Clases de la UNI")).toBeInTheDocument();
    expect(screen.getByText("Clases Uni")).toBeInTheDocument();
  });

  it("shows the times in the zone of the profile (RF-34)", () => {
    setup({ timeZone: "America/New_York" });

    expect(screen.getByText(/lunes, 2 de noviembre de 2026/)).toHaveTextContent(
      "02:00 – 03:30",
    );
  });

  it("shows both days when the event crosses midnight", () => {
    setup({
      event: {
        ...EVENT,
        startsAt: "2026-11-02T22:00:00Z",
        endsAt: "2026-11-03T01:00:00Z",
      },
    });

    const when = screen.getByTestId("event-when");
    expect(when).toHaveTextContent("lunes, 2 de noviembre de 2026");
    expect(when).toHaveTextContent("23:00");
    expect(when).toHaveTextContent("martes, 3 de noviembre de 2026");
    expect(when).toHaveTextContent("02:00");
  });

  it("shows all-day events by date without hours, whatever the zone (RF-20)", () => {
    setup({
      timeZone: "America/New_York",
      event: {
        ...EVENT,
        allDay: true,
        startsAt: "2026-12-24T00:00:00Z",
        endsAt: "2026-12-27T00:00:00Z",
      },
    });

    const when = screen.getByTestId("event-when");
    expect(when).toHaveTextContent("jueves, 24 de diciembre de 2026");
    expect(when).toHaveTextContent("sábado, 26 de diciembre de 2026");
    expect(when).not.toHaveTextContent(/\d{2}:\d{2}/);
  });

  it("omits what the event does not have", () => {
    setup({
      event: {
        ...EVENT,
        description: null,
        location: null,
        categoryName: null,
      },
    });

    expect(screen.queryByText("Aula 3")).not.toBeInTheDocument();
    expect(screen.getByText("Sin categoría")).toBeInTheDocument();
  });

  it("uses the event's own color or else the calendar's (RF-17)", () => {
    const { rerender } = render(
      <EventDetail
        event={EVENT}
        timeZone="Europe/Madrid"
        canEdit={false}
        deleteAction={async () => ({})}
      />,
    );
    const colors = () =>
      screen
        .getAllByTestId("event-color")
        .map((el) => el.style.backgroundColor);
    expect(colors().at(-1)).toBe("rgb(160, 196, 255)");

    rerender(
      <EventDetail
        event={{ ...EVENT, color: "#FFADAD" }}
        timeZone="Europe/Madrid"
        canEdit={false}
        deleteAction={async () => ({})}
      />,
    );
    expect(colors().at(-1)).toBe("rgb(255, 173, 173)");
  });
});

describe("EventDetail permissions and deletion (RF-23, RF-24, RF-26)", () => {
  it("gives viewers no buttons or links", () => {
    setup({ canEdit: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("asks for confirmation before deleting, then deletes", async () => {
    const user = userEvent.setup();
    const remove = setup();

    await user.click(screen.getByRole("button", { name: "Borrar evento" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("¿Borrar «Matemáticas»?");
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
