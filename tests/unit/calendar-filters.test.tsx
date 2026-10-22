import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CalendarWorkspace,
  type PanelCalendar,
} from "@/components/calendar/calendar-workspace";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import type { PersonGroup } from "@/lib/calendar/grouping";
import { getVisibleRange } from "@/lib/calendar/ranges";

const TZ = "Europe/Madrid";
const DAYS = getVisibleRange("month", "2026-11-02", TZ).days;

function calendar(
  id: string,
  name: string,
  ownerId: string,
  color: string,
  visible = true,
): PanelCalendar & { visible: boolean } {
  return {
    id,
    name,
    ownerId,
    createdAt: "2026-01-01T00:00:00Z",
    color,
    visible,
  };
}

function groups(): PersonGroup<PanelCalendar>[] {
  return [
    {
      person: { id: "me", displayName: "Yo", isMe: true },
      calendars: [
        calendar("c1", "Mi calendario", "me", "#A0C4FF"),
        calendar("c2", "Clases Uni", "me", "#A0C4FF"),
      ],
    },
    {
      person: { id: "ana", displayName: "Ana", isMe: false },
      calendars: [calendar("c3", "Familia de Ana", "ana", "#FFADAD")],
    },
  ];
}

function event(
  id: string,
  title: string,
  calendarId: string,
  day: string,
  categoryId: string | null = null,
): CalendarEventItem {
  return {
    id,
    title,
    startsAt: `${day}T09:00:00Z`,
    endsAt: `${day}T10:00:00Z`,
    allDay: false,
    color: "#A0C4FF",
    calendarId,
    categoryId,
  };
}

const EVENTS = [
  event("e1", "Evento mío", "c1", "2026-11-02"),
  event("e2", "Clase de mates", "c2", "2026-11-03", "k1"),
  event("e3", "Clase de física", "c2", "2026-11-03", "k2"),
  event("e4", "Cena de Ana", "c3", "2026-11-04"),
];

const CATEGORIES = [
  { id: "k1", name: "Matemáticas", calendarId: "c2" },
  { id: "k2", name: "Física", calendarId: "c2" },
];

type Result = { error?: string };

function setup(
  overrides: Partial<React.ComponentProps<typeof CalendarWorkspace>> = {},
) {
  const setCalendarVisibility = vi.fn<
    (id: string, visible: boolean) => Promise<Result>
  >(async () => ({}));
  const setPersonVisibility = vi.fn<
    (id: string, visible: boolean) => Promise<Result>
  >(async () => ({}));
  const saveOrder = vi.fn<
    (order: {
      people: string[];
      calendars: Record<string, string[]>;
    }) => Promise<Result>
  >(async () => ({}));
  render(
    <CalendarWorkspace
      view="month"
      date="2026-11-02"
      days={DAYS}
      today="2026-10-21"
      timeZone={TZ}
      events={EVENTS}
      groups={groups()}
      categories={CATEGORIES}
      setCalendarVisibility={setCalendarVisibility}
      setPersonVisibility={setPersonVisibility}
      saveOrder={saveOrder}
      {...overrides}
    />,
  );
  return { setCalendarVisibility, setPersonVisibility, saveOrder };
}

const chip = (name: RegExp) => screen.queryByRole("link", { name });

describe("CalendarWorkspace filter tree (RF-42)", () => {
  it("shows people, their calendars and the categories of each calendar", () => {
    setup();

    for (const name of [
      "Yo",
      "Ana",
      "Mi calendario",
      "Clases Uni",
      "Familia de Ana",
      "Matemáticas",
      "Física",
    ]) {
      expect(screen.getByRole("checkbox", { name }), name).toBeChecked();
    }
  });

  it("draws each person as an avatar with initials and a tint of their own (spec 005 RF-27, RF-28)", () => {
    setup({
      groups: [
        groups()[0]!,
        {
          person: { id: "ana", displayName: "Ana López", isMe: false },
          calendars: [calendar("c3", "Familia de Ana", "ana", "#FFADAD")],
        },
      ],
    });

    const ana = screen
      .getByRole("checkbox", { name: "Ana López" })
      .closest("label")!;
    const me = screen.getByRole("checkbox", { name: "Yo" }).closest("label")!;
    const anaAvatar = ana.querySelector<HTMLElement>("[data-avatar]")!;
    const myAvatar = me.querySelector<HTMLElement>("[data-avatar]")!;
    expect(anaAvatar).toHaveTextContent("AL");
    expect(anaAvatar).toHaveAttribute("aria-hidden", "true");
    expect(myAvatar).toHaveTextContent("Y");
    expect(anaAvatar.style.backgroundColor).not.toBe(
      myAvatar.style.backgroundColor,
    );
  });

  it("shows only my own calendars when nobody shares with me", () => {
    setup({ groups: [groups()[0]!] });

    expect(
      screen.queryByRole("checkbox", { name: "Yo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Mi calendario" }),
    ).toBeChecked();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });
});

describe("visibility (RF-32, RF-33, RF-43, RF-44)", () => {
  it("hides the events of a calendar when its box is unchecked, and saves it", async () => {
    const user = userEvent.setup();
    const { setCalendarVisibility } = setup();
    expect(chip(/Clase de mates/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Clases Uni" }));

    expect(chip(/Clase de mates/)).not.toBeInTheDocument();
    expect(chip(/Clase de física/)).not.toBeInTheDocument();
    expect(chip(/Evento mío/)).toBeInTheDocument();
    expect(setCalendarVisibility).toHaveBeenCalledWith("c2", false);

    await user.click(screen.getByRole("checkbox", { name: "Clases Uni" }));
    expect(chip(/Clase de mates/)).toBeInTheDocument();
    expect(setCalendarVisibility).toHaveBeenLastCalledWith("c2", true);
  });

  it("toggles every calendar of a person at once (RF-44)", async () => {
    const user = userEvent.setup();
    const { setPersonVisibility } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Yo" }));

    expect(
      screen.getByRole("checkbox", { name: "Mi calendario" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Clases Uni" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Familia de Ana" }),
    ).toBeChecked();
    expect(chip(/Evento mío/)).not.toBeInTheDocument();
    expect(chip(/Cena de Ana/)).toBeInTheDocument();
    expect(setPersonVisibility).toHaveBeenCalledWith("me", false);

    await user.click(screen.getByRole("checkbox", { name: "Yo" }));
    expect(chip(/Evento mío/)).toBeInTheDocument();
    expect(setPersonVisibility).toHaveBeenLastCalledWith("me", true);
  });

  it("marks a person as partially selected when only some calendars are visible", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("checkbox", { name: "Clases Uni" }));

    const person = screen.getByRole("checkbox", {
      name: "Yo",
    }) as HTMLInputElement;
    expect(person.indeterminate).toBe(true);
  });

  it("hides one category without touching the others or the server (RF-32)", async () => {
    const user = userEvent.setup();
    const { setCalendarVisibility, setPersonVisibility } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Matemáticas" }));

    expect(chip(/Clase de mates/)).not.toBeInTheDocument();
    expect(chip(/Clase de física/)).toBeInTheDocument();
    expect(chip(/Evento mío/)).toBeInTheDocument();
    expect(setCalendarVisibility).not.toHaveBeenCalled();
    expect(setPersonVisibility).not.toHaveBeenCalled();
  });

  it("starts with the saved visibility", () => {
    const saved = groups();
    saved[0]!.calendars[1]!.visible = false;
    setup({ groups: saved });

    expect(
      screen.getByRole("checkbox", { name: "Clases Uni" }),
    ).not.toBeChecked();
    expect(chip(/Clase de mates/)).not.toBeInTheDocument();
  });
});

describe("failed saves", () => {
  it("reverts a visibility change and shows the error", async () => {
    const user = userEvent.setup();
    const failing = vi.fn(async () => ({
      error:
        "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    }));
    setup({ setCalendarVisibility: failing });

    await user.click(screen.getByRole("checkbox", { name: "Clases Uni" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido conectar",
    );
    expect(screen.getByRole("checkbox", { name: "Clases Uni" })).toBeChecked();
    expect(chip(/Clase de mates/)).toBeInTheDocument();
  });
});

describe("order (RF-45)", () => {
  function labels() {
    // The avatar initials are decorative (spec 005 RF-27): read the name only.
    return (screen.getAllByRole("checkbox") as HTMLInputElement[]).map(
      (box) => {
        const label = box.labels?.[0]?.cloneNode(true) as
          HTMLElement | undefined;
        label?.querySelector("[data-avatar]")?.remove();
        return label?.textContent?.trim() ?? "";
      },
    );
  }

  function calendarNames() {
    return labels().filter((name) =>
      ["Mi calendario", "Clases Uni", "Familia de Ana"].includes(name),
    );
  }

  it("moves a calendar down, saves the whole order and keeps the focus", async () => {
    const user = userEvent.setup();
    const { saveOrder } = setup();

    await user.click(
      screen.getByRole("button", { name: "Bajar Mi calendario" }),
    );

    expect(calendarNames()).toEqual([
      "Clases Uni",
      "Mi calendario",
      "Familia de Ana",
    ]);
    expect(saveOrder).toHaveBeenCalledWith({
      people: ["me", "ana"],
      calendars: { me: ["c2", "c1"], ana: ["c3"] },
    });
    // At the end of its list "Bajar" is disabled, so the focus follows to "Subir".
    expect(
      screen.getByRole("button", { name: "Subir Mi calendario" }),
    ).toHaveFocus();
  });

  it("moves a person up", async () => {
    const user = userEvent.setup();
    const { saveOrder } = setup();

    await user.click(screen.getByRole("button", { name: "Subir Ana" }));

    expect(saveOrder).toHaveBeenCalledWith({
      people: ["ana", "me"],
      calendars: { me: ["c1", "c2"], ana: ["c3"] },
    });
    expect(labels().indexOf("Ana")).toBeLessThan(labels().indexOf("Yo"));
  });

  it("disables the moves that would go past the ends", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Subir Mi calendario" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Bajar Clases Uni" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Subir Yo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Ana" })).toBeDisabled();
  });

  it("reverts the order and shows the error when saving fails", async () => {
    const user = userEvent.setup();
    setup({
      saveOrder: async () => ({ error: "No tienes permiso para hacer esto." }),
    });

    await user.click(
      screen.getByRole("button", { name: "Bajar Mi calendario" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permiso",
    );
    expect(calendarNames()).toEqual([
      "Mi calendario",
      "Clases Uni",
      "Familia de Ana",
    ]);
  });
});
