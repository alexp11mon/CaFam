import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventClipboardProvider } from "@/components/calendar/event-clipboard";
import { EventBlock } from "@/components/calendar/event-block";
import {
  EventInteractionsProvider,
  useEventInteractionsState,
} from "@/components/calendar/event-interactions";
import { ToastProvider } from "@/components/ui/toast";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { markRemoteRefresh } from "@/lib/calendar/live-hold";

// Spec 019, T10 and T11: the detail card beside the event (RF-1 to RF-16, RF-44).
const h = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  loadEventCard: vi.fn(),
  deleteForUndo: vi.fn(),
  morphIn: vi.fn(),
  morphOut: vi.fn(),
  findVisibleBlock: vi.fn(),
}));
vi.mock("@/lib/motion/morph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/morph")>()),
  morphIn: h.morphIn,
  morphOut: h.morphOut,
  findVisibleBlock: h.findVisibleBlock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: h.refresh }),
}));
vi.mock("@/app/dashboard/events/card-actions", () => ({
  loadEventCard: h.loadEventCard,
}));
vi.mock("@/app/dashboard/events/quick-actions", () => ({
  quickChange: vi.fn(),
  deleteForUndo: h.deleteForUndo,
  undoAction: vi.fn(),
  pasteEvent: vi.fn(),
}));

const TZ = "Europe/Madrid";
type Item = CalendarEventItem & { location?: string; calendarName?: string };
const DINNER: Item = {
  id: "e1",
  title: "Cena",
  startsAt: "2026-11-03T19:00:00.000Z",
  endsAt: "2026-11-03T20:00:00.000Z",
  allDay: false,
  calendarId: "mine",
  categoryId: null,
  color: "#FFADAD",
  location: "Casa de Ana",
  calendarName: "Familia",
  imageCount: 2,
  commentCount: 1,
};
const MATCH: Item = {
  ...DINNER,
  id: "e2",
  title: "Partido",
  calendarId: "theirs",
  calendarName: "Fútbol",
  imageCount: 0,
  commentCount: 0,
};
const BOTH = [DINNER, MATCH];
let shown: Item[] = BOTH;
const EDITABLE = new Set(["mine"]);
const COLORS = new Map<string, string>();

function Harness() {
  const state = useEventInteractionsState({
    events: shown,
    editableCalendarIds: EDITABLE,
    calendarColors: COLORS,
    timeZone: TZ,
  });
  return (
    <EventInteractionsProvider value={state.api}>
      {state.events.map((event) => (
        <EventBlock key={event.id} event={event} timeZone={TZ} shape="card" />
      ))}
      <button type="button">Fuera</button>
      {state.dialog}
    </EventInteractionsProvider>
  );
}

function setup() {
  return render(
    <ToastProvider>
      <EventClipboardProvider>
        <Harness />
      </EventClipboardProvider>
    </ToastProvider>,
  );
}

const block = (title: string) =>
  screen.getByRole("link", { name: new RegExp(title) });
const card = () => screen.queryByRole("dialog");

function setPhone(phone: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return phone;
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  window.matchMedia = vi.fn(() => media) as unknown as typeof matchMedia;
  return (next: boolean) => {
    phone = next;
    for (const listener of listeners) listener();
  };
}

beforeEach(() => {
  h.morphIn.mockReset().mockResolvedValue(undefined);
  h.morphOut.mockReset().mockResolvedValue(undefined);
  h.findVisibleBlock.mockReset().mockReturnValue(null);
  shown = BOTH;
  setPhone(false);
  h.push.mockClear();
  h.deleteForUndo.mockReset();
  h.deleteForUndo.mockResolvedValue({
    ok: true,
    undo: { kind: "unpaste", id: "e1" },
  });
  h.loadEventCard.mockReset();
  h.loadEventCard.mockResolvedValue({
    description: "Traer postre\nY bebida\nY pan\nY servilletas",
    author: "Ana",
    repeat: { summary: "Cada semana", changed: false, limitReached: false },
    readOnly: null,
    canEdit: true,
  });
});

afterEach(() => {
  // @ts-expect-error jsdom has none by default
  delete window.matchMedia;
});

describe("EventCard", () => {
  it("opens beside the event on a click, without navigating or blocking the page (RF-1, RF-3)", async () => {
    setup();
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      block("Cena").dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(true);
    const dialog = await screen.findByRole("dialog", { name: "Cena" });
    expect(dialog).toHaveAttribute("open");
    // Not modal: the rest of the page stays usable.
    expect(screen.getByRole("button", { name: "Fuera" })).not.toHaveAttribute(
      "inert",
    );
  });

  it("shows what the view has at once and the rest when it arrives (RF-4 to RF-6)", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    h.loadEventCard.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    await userEvent.click(block("Cena"));

    const dialog = screen.getByRole("dialog", { name: "Cena" });
    expect(dialog).toHaveTextContent("Casa de Ana");
    expect(dialog).toHaveTextContent("Familia");
    expect(dialog).toHaveTextContent("2 imágenes · 1 comentario");
    expect(screen.getByTestId("card-when")).toHaveTextContent("20:00");

    await act(async () =>
      resolve({
        description: "Traer postre",
        author: "Ana",
        repeat: { summary: "Cada semana", changed: false, limitReached: false },
        readOnly: null,
        canEdit: true,
      }),
    );
    expect(dialog).toHaveTextContent("Creado por Ana");
    expect(dialog).toHaveTextContent("Cada semana");
    expect(screen.getByTestId("card-description")).toHaveClass("line-clamp-3");
    expect(h.loadEventCard).toHaveBeenCalledWith("e1");
  });

  it("says all day for an all-day event", async () => {
    shown = [
      {
        ...DINNER,
        allDay: true,
        startsAt: "2026-11-03T00:00:00Z",
        endsAt: "2026-11-04T00:00:00Z",
      },
    ];
    setup();
    await userEvent.click(block("Cena"));
    expect(screen.getByTestId("card-when")).toHaveTextContent("Todo el día");
  });

  it("puts the focus in the card and back on the event when it closes (RF-11, RF-13)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(card()).toBeNull());
    expect(block("Cena")).toHaveFocus();

    await userEvent.click(block("Cena"));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it("grows out of the pressed block (spec 021 RF-55)", async () => {
    setup();
    vi.spyOn(block("Cena"), "getBoundingClientRect").mockReturnValue({
      left: 40,
      top: 300,
      width: 120,
      height: 20,
    } as DOMRect);
    await userEvent.click(block("Cena"));
    const dialog = screen.getByRole("dialog", { name: "Cena" });
    expect(h.morphIn).toHaveBeenCalledWith(
      dialog,
      { left: 40, top: 300, width: 120, height: 20 },
      "#FFADAD",
    );
  });

  it("shrinks into the block if it is still on screen (spec 021 RF-57)", async () => {
    let shrunk: () => void = () => undefined;
    h.morphOut.mockReturnValue(
      new Promise<void>((resolve) => {
        shrunk = resolve;
      }),
    );
    setup();
    await userEvent.click(block("Cena"));
    const dialog = screen.getByRole("dialog", { name: "Cena" });
    const target = block("Cena");
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    } as DOMRect);
    h.findVisibleBlock.mockReturnValue(target);

    await userEvent.keyboard("{Escape}");
    expect(h.findVisibleBlock).toHaveBeenCalledWith("e1", undefined);
    expect(h.morphOut).toHaveBeenCalledWith(
      dialog,
      { left: 10, top: 20, width: 30, height: 40 },
      "#FFADAD",
    );
    // Still there until it has shrunk.
    expect(card()).not.toBeNull();
    await act(async () => shrunk());
    expect(card()).toBeNull();
    expect(block("Cena")).toHaveFocus();
  });

  it("leaves with the pop exit when the block is gone (spec 021 RF-58)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    const dialog = screen.getByRole("dialog", { name: "Cena", hidden: true });
    expect(dialog).toHaveAttribute("data-leaving");
    expect(dialog).toHaveClass("pop");
    expect(h.morphOut).not.toHaveBeenCalled();
    await waitFor(() => expect(card()).toBeNull());
  });

  it("closes on a click outside and moves on a click on another event (RF-11, RF-12)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    await userEvent.click(block("Partido"));
    expect(screen.getByRole("dialog", { name: "Partido" })).toBeVisible();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Fuera" }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it("keeps the link with Ctrl and on a phone, where the sheet is the detail (RF-15, RF-16)", () => {
    setup();
    const withCtrl = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    act(() => {
      block("Cena").dispatchEvent(withCtrl);
    });
    expect(card()).toBeNull();

    setPhone(true);
    const onPhone = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      block("Cena").dispatchEvent(onPhone);
    });
    expect(card()).toBeNull();
  });

  it("closes when the window narrows under 769 px", async () => {
    const narrow = setPhone(false);
    setup();
    await userEvent.click(block("Cena"));
    act(() => narrow(true));
    expect(card()).toBeNull();
  });

  it("closes and says so when someone else deletes the event (RF-44)", async () => {
    const view = setup();
    await userEvent.click(block("Cena"));
    markRemoteRefresh();
    shown = [MATCH];
    view.rerender(
      <ToastProvider>
        <EventClipboardProvider>
          <Harness />
        </EventClipboardProvider>
      </ToastProvider>,
    );
    expect(card()).toBeNull();
    expect(
      await screen.findByText("Otra persona ha borrado este evento"),
    ).toBeVisible();
  });

  it("closes if the event is gone when its data is read", async () => {
    h.loadEventCard.mockResolvedValueOnce({ gone: true });
    setup();
    await userEvent.click(block("Cena"));
    await act(async () => {});
    expect(card()).toBeNull();
  });
});

describe("EventCard actions", () => {
  it("Editar, Duplicar and Abrir go to the window of spec 008 (RF-8, RF-9)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/dashboard/events/e1?edit=1",
    );
    expect(screen.getByRole("link", { name: "Duplicar" })).toHaveAttribute(
      "href",
      "/dashboard/events/new?from=e1",
    );
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute(
      "href",
      "/dashboard/events/e1",
    );
  });

  it("Borrar deletes with Deshacer and closes the card (RF-10)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(card()).toBeNull();
    expect(h.deleteForUndo).toHaveBeenCalledWith("e1", {});
    expect(await screen.findByText("Evento borrado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeVisible();
  });

  it("a reader only opens, and sees why a synced event is read-only (RF-7, RF-8)", async () => {
    h.loadEventCard.mockResolvedValue({
      description: null,
      author: "Ana",
      repeat: null,
      readOnly: "provider",
      provider: "icloud",
      canEdit: false,
    });
    setup();
    await userEvent.click(block("Partido"));
    await act(async () => {});

    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir" })).toBeVisible();
    expect(card()).toHaveTextContent("solo se puede cambiar en iCloud");
  });

  it("E edits, Supr deletes and Ctrl+C copies with the card focused (RF-14)", async () => {
    setup();
    await userEvent.click(block("Cena"));
    await userEvent.keyboard("{Control>}c{/Control}");
    expect(await screen.findByText("Evento copiado")).toBeVisible();

    await userEvent.keyboard("e");
    expect(h.push).toHaveBeenCalledWith("/dashboard/events/e1?edit=1");
    expect(card()).toBeNull();

    await userEvent.click(block("Cena"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Delete" });
    expect(card()).toBeNull();
    expect(h.deleteForUndo).toHaveBeenCalledTimes(1);
  });
});
