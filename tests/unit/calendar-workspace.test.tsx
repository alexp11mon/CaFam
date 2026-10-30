import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CalendarWorkspace,
  type PanelCalendar,
} from "@/components/calendar/calendar-workspace";
import { CalendarHeaderProvider } from "@/components/shell/calendar-header";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { PHONE_QUERY } from "@/lib/hooks/use-is-phone";
import type { PersonGroup } from "@/lib/calendar/grouping";
import { getVisibleRange } from "@/lib/calendar/ranges";

// Spec 008, T15: the quick window opens from an empty day of the month (RF-19, RF-37, RF-40).
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/dashboard/calendar",
}));
vi.mock("@/app/dashboard/settings/actions", () => ({
  setTheme: vi.fn(async () => ({})),
}));

// jsdom cannot run view transitions: a stand-in shows what the area gets.
const transitionTypes = vi.hoisted(() => [] as string[]);
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  const keys = (types?: Record<string, string>) =>
    Object.keys(types ?? {})
      .filter((type) => type !== "default")
      .join(" ");
  return {
    ...react,
    addTransitionType: (type: string) => transitionTypes.push(type),
    ViewTransition: ({
      children,
      enter,
      update,
    }: {
      children: React.ReactNode;
      enter?: Record<string, string>;
      update?: Record<string, string>;
    }) => (
      <div
        data-view-transition=""
        data-enter={keys(enter)}
        data-update={keys(update)}
      >
        {children}
      </div>
    ),
  };
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const TZ = "Europe/Madrid";
const DAYS = getVisibleRange("month", "2026-11-02", TZ).days;

const GROUPS: PersonGroup<PanelCalendar>[] = [
  {
    person: { id: "me", displayName: "Yo", isMe: true },
    calendars: [
      {
        id: "c1",
        name: "Mi calendario",
        ownerId: "me",
        createdAt: "2026-01-01T00:00:00Z",
        color: "#A0C4FF",
        visible: false,
      },
      {
        id: "c2",
        name: "Familia",
        ownerId: "me",
        createdAt: "2026-01-01T00:00:00Z",
        color: "#FFADAD",
        visible: true,
      },
    ],
  },
];

function setup(canCreate = true, wrap = (node: ReactNode) => node) {
  render(
    wrap(
      <ToastProvider>
        <CalendarWorkspace
          view="month"
          date="2026-11-02"
          days={DAYS}
          today="2026-10-21"
          timeZone={TZ}
          events={[]}
          canCreate={canCreate}
          groups={GROUPS}
          categories={[]}
          setCalendarVisibility={vi.fn(async () => ({}))}
          setPersonVisibility={vi.fn(async () => ({}))}
          saveOrder={vi.fn(async () => ({}))}
          editableCalendars={[
            { id: "c1", name: "Mi calendario", color: "#A0C4FF" },
            { id: "c2", name: "Familia", color: "#FFADAD" },
          ]}
          createAction={vi.fn(async () => ({
            values: {} as never,
          }))}
        />
      </ToastProvider>,
    ),
  );
}

// The phone header around the calendar, as AppFrame puts it.
const withHeader = (node: ReactNode) => (
  <CalendarHeaderProvider>
    <TopBar displayName="Ana López" signOutAction={vi.fn(async () => {})} />
    {node}
  </CalendarHeaderProvider>
);

function phone(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches && query === PHONE_QUERY,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  push.mockClear();
  phone(false);
});

describe("CalendarWorkspace: quick creation", () => {
  it("opens the quick window with an all-day event of that day (RF-19, RF-37)", async () => {
    setup();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Crear evento el miércoles, 4 de noviembre de 2026",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Nuevo evento" });
    expect(within(dialog).getByText("miércoles, 4 de noviembre")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Añadir hora" }),
    ).toBeVisible();
    // The first visible calendar the user can write to (plan workspace).
    expect(within(dialog).getByLabelText("Calendario")).toHaveValue("c2");
  });

  it("marks the chosen day while the window is open (RF-40)", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Crear evento el miércoles, 4 de noviembre de 2026",
      }),
    );
    const cell = screen
      .getAllByTestId("day-cell")
      .find((element) => element.dataset.date === "2026-11-04")!;
    expect(within(cell).getByText("(Sin título)")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Título"), "Cena");

    expect(within(cell).getByText("Cena")).toBeInTheDocument();
  });

  it("offers nothing to create for a reader (RF-36)", () => {
    setup(false);

    expect(
      screen.queryByRole("button", { name: /Crear evento el/ }),
    ).toBeNull();
  });
});

// Spec 011, T11: the view area is one ViewTransition per view and date, so a
// change exits the old one and enters the new one (RF-17, RF-18; plan D8).
describe("CalendarWorkspace view motion", () => {
  it("wraps the view in a ViewTransition with the calendar types", () => {
    setup();
    const area = document.querySelector("[data-view-transition]");
    expect(area).not.toBeNull();
    expect(area).toHaveAttribute("data-enter", "cal-view cal-next cal-prev");
  });
});

// Spec 011, T12: showing or hiding a calendar fades its events (people and
// categories go through the same fadeFilters)
// (RF-19; plan view-motion, flow step 8).
describe("CalendarWorkspace filter motion", () => {
  it("updates the view area with the cal-filter type", async () => {
    transitionTypes.length = 0;
    setup();
    expect(document.querySelector("[data-view-transition]")).toHaveAttribute(
      "data-update",
      "cal-filter",
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Familia" }));
    expect(transitionTypes).toEqual(["cal-filter"]);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Mi calendario" }),
    );
    expect(transitionTypes).toEqual(["cal-filter", "cal-filter"]);
  });
});

// Spec 016, T6: the calendar in the phone frame (RF-8, RF-10, RF-13, RF-17..RF-20, RF-25).
describe("CalendarWorkspace on a phone", () => {
  it("publishes the month as the header title and goes to today", async () => {
    setup(true, withHeader);

    expect(
      within(screen.getByRole("banner")).getByRole("button", {
        name: /noviembre/,
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Hoy/ }));
    expect(push).toHaveBeenCalledWith(
      "/dashboard/calendar?view=month&date=2026-10-21",
      expect.anything(),
    );
  });

  it("moves the views and the filters into the drawer", () => {
    phone(true);
    setup(true, withHeader);

    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    const drawer = document.querySelector("dialog[data-drawer]")!;
    expect(
      within(drawer as HTMLElement).getByRole("link", { name: "Mes" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(drawer as HTMLElement).getByRole("checkbox", { name: "Familia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: "Familia" })).toHaveLength(
      1,
    );
  });

  it("keeps the filters in the panel on a wider screen", () => {
    setup(true, withHeader);

    const drawer = document.querySelector("dialog[data-drawer]")!;
    expect(
      within(drawer as HTMLElement).queryByRole("checkbox", {
        name: "Familia",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: "Familia" }),
    ).toBeInTheDocument();
  });

  it("opens the month row under the header", async () => {
    setup(true, withHeader);

    await userEvent.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: /noviembre/,
      }),
    );
    expect(
      screen.getByRole("navigation", { name: "Meses" }),
    ).toBeInTheDocument();
  });

  it("shows the floating + only to who can create", () => {
    setup(true);
    expect(screen.getByRole("link", { name: "Nuevo evento" })).toHaveAttribute(
      "href",
      "/dashboard/events/new?date=2026-11-02",
    );
  });

  it("hides the floating + from a reader", () => {
    setup(false);
    expect(screen.queryByRole("link", { name: "Nuevo evento" })).toBeNull();
  });

  it("goes to the next month when a finger slides left", () => {
    setup();
    const area = document.querySelector<HTMLElement>(".touch-pan-y")!;
    act(() => {
      fireEvent.pointerDown(area, {
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerUp(area, {
        pointerType: "touch",
        clientX: 100,
        clientY: 110,
      });
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/calendar?view=month&date=2026-12-01",
      expect.anything(),
    );
  });
});
