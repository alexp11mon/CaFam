import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity, useState } from "react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { EventModal, useEventModal } from "@/components/calendar/event-modal";
import { setMorphOrigin } from "@/lib/motion/morph";

// Spec 008, T1: the event window over the calendar (RF-4, RF-5, RF-6, RF-12, RF-29).
const router = vi.hoisted(() => ({ back: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const morph = vi.hoisted(() => ({
  morphIn: vi.fn(),
  morphOut: vi.fn(),
  findVisibleBlock: vi.fn(),
}));
vi.mock("@/lib/motion/morph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/morph")>()),
  ...morph,
}));

const motion = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/lib/motion/play", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion/play")>()),
  play: motion.play,
}));

// jsdom does not implement the modal methods of <dialog>.
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
  morph.morphIn.mockReset().mockResolvedValue(undefined);
  morph.morphOut.mockReset().mockResolvedValue(undefined);
  morph.findVisibleBlock.mockReset().mockReturnValue(null);
  motion.play.mockReset().mockReturnValue(null);
});

// Spec 021, T15: the window and the sheet grow from the block or the card
// and shrink back into the block (RF-55, RF-57..RF-60).
describe("EventModal morph", () => {
  const BLOCK = { left: 40, top: 300, width: 120, height: 20 };

  function open(variant: "window" | "sheet" = "window") {
    render(
      <EventModal title="Cena familiar" variant={variant} morphId="e1">
        <p>Contenido</p>
      </EventModal>,
    );
    return screen.getByRole("dialog", { name: "Cena familiar" });
  }

  it.each(["window", "sheet"] as const)(
    "the %s grows from the block that opened it",
    (variant) => {
      setMorphOrigin({ eventId: "e1", box: BLOCK, color: "#FFADAD" });
      const dialog = open(variant);
      expect(morph.morphIn).toHaveBeenCalledWith(dialog, BLOCK, "#FFADAD");
    },
  );

  it("enters as usual without an origin, or one of another event (RF-59)", () => {
    setMorphOrigin({ eventId: "e2", box: BLOCK, color: "#FFADAD" });
    open();
    expect(morph.morphIn).not.toHaveBeenCalled();
  });

  it("shrinks into the block before going back (RF-57)", async () => {
    let shrunk: () => void = () => undefined;
    morph.morphOut.mockReturnValue(
      new Promise<void>((resolve) => {
        shrunk = resolve;
      }),
    );
    setMorphOrigin({ eventId: "e1", box: BLOCK, color: "#FFADAD" });
    const dialog = open();
    const target = document.createElement("a");
    target.getBoundingClientRect = () => BLOCK as DOMRect;
    morph.findVisibleBlock.mockReturnValue(target);

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(morph.morphOut).toHaveBeenCalledWith(dialog, BLOCK, "#FFADAD");
    expect(router.back).not.toHaveBeenCalled();
    await act(async () => shrunk());
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("goes back at once when the block is not on screen (RF-58)", async () => {
    setMorphOrigin({ eventId: "e1", box: BLOCK, color: "#FFADAD" });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(morph.morphOut).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

function renderModal() {
  const opener = document.createElement("button");
  opener.textContent = "Cena familiar";
  document.body.append(opener);
  opener.focus();
  const view = render(
    <EventModal title="Cena familiar">
      <p>Contenido</p>
    </EventModal>,
  );
  return { opener, ...view };
}

describe("EventModal", () => {
  it("opens as a modal dialog named by its title (RF-4, RF-12)", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "Cena familiar" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Contenido")).toBeVisible();
  });

  it("goes back when 'Cerrar' is pressed (RF-6)", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("goes back on Escape instead of letting the dialog close itself (RF-6)", () => {
    renderModal();

    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("gives the focus back to what opened it when it goes away (RF-6)", () => {
    const { opener, unmount } = renderModal();
    screen.getByRole("button", { name: "Cerrar" }).focus();
    expect(opener).not.toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("switches between window and full screen (RF-5)", async () => {
    renderModal();
    const toggle = screen.getByRole("button", { name: "Pantalla completa" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-fullscreen",
      "true",
    );
  });

  it("is always full screen on a phone, without the toggle (RF-29)", () => {
    renderModal();

    // Up to 768 px the CSS forces full screen and hides the toggle.
    expect(screen.getByRole("dialog").className).toMatch(
      /max-\[48\.0625rem\]:h-full/,
    );
    expect(
      screen.getByRole("button", { name: "Pantalla completa" }).className,
    ).toMatch(/max-\[48\.0625rem\]:hidden/);
  });

  it("starts its content afresh each time Next shows the kept route again", async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount((n) => n + 1)}>
          Pulsado {count}
        </button>
      );
    }
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <EventModal title="Cena familiar">
          <Counter />
        </EventModal>
      </Activity>
    );
    const { rerender } = render(tree("visible"));
    await userEvent.click(screen.getByRole("button", { name: "Pulsado 0" }));
    expect(screen.getByRole("button", { name: "Pulsado 1" })).toBeVisible();

    act(() => rerender(tree("hidden")));
    act(() => rerender(tree("visible")));

    expect(screen.getByRole("button", { name: "Pulsado 0" })).toBeVisible();
  });

  it("puts the focus on the field marked for it once open (spec 008 RF-28)", () => {
    render(
      <EventModal title="Nuevo evento">
        <input aria-label="Título" data-autofocus="" />
      </EventModal>,
    );

    expect(screen.getByLabelText("Título")).toHaveFocus();
  });
});

// Spec 017, T14: the detail as a sheet from the bottom on a phone (RF-44 to RF-48).
describe("EventModal as a sheet", () => {
  function phone(matches: boolean) {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  }

  function Expand() {
    const modal = useEventModal();
    return (
      <>
        <button type="button" onClick={() => modal?.expand()}>
          Editar
        </button>
        <button type="button" onClick={() => modal?.setDirty(true)}>
          Escribir
        </button>
      </>
    );
  }

  function renderSheet() {
    render(
      <EventModal title="Cena familiar" variant="sheet">
        <Expand />
      </EventModal>,
    );
    return screen.getByRole("dialog", { name: "Cena familiar" });
  }

  function drag(handle: Element, dy: number) {
    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientY: 400 + dy, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 400 + dy, pointerId: 1 });
  }

  afterEach(() => {
    // @ts-expect-error jsdom has none; each test sets its own.
    delete window.matchMedia;
  });

  it("opens at half the screen with a handle on a phone (RF-44)", () => {
    phone(true);
    const dialog = renderSheet();
    expect(dialog).toHaveAttribute("data-sheet", "half");
    expect(screen.getByRole("button", { name: "Ampliar" })).toBeVisible();
  });

  it("dragging up fills the screen, down from half closes (RF-45, RF-46)", () => {
    phone(true);
    const dialog = renderSheet();
    const handle = screen.getByRole("button", { name: "Ampliar" });
    drag(handle, -120);
    expect(dialog).toHaveAttribute("data-sheet", "full");
    drag(screen.getByRole("button", { name: "Reducir" }), 150);
    expect(dialog).toHaveAttribute("data-sheet", "half");
    drag(screen.getByRole("button", { name: "Ampliar" }), 150);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("a press on the backdrop closes it (RF-46)", () => {
    phone(true);
    const dialog = renderSheet();
    fireEvent.click(dialog);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("asks before closing with unsaved changes (RF-48)", async () => {
    phone(true);
    const dialog = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Escribir" }));
    drag(screen.getByRole("button", { name: "Ampliar" }), 150);
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar los cambios?")).toBeVisible();
    // The question takes the focus, or a screen reader never hears it
    // (spec 023 RF-19).
    expect(
      screen.getByRole("button", { name: "Seguir editando" }),
    ).toHaveFocus();
    expect(dialog).toHaveAttribute("data-sheet", "half");
  });

  it("Editar fills the screen (RF-47)", async () => {
    phone(true);
    const dialog = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(dialog).toHaveAttribute("data-sheet", "full");
  });

  // Spec 021, T18: past its limits the sheet follows less and less (RF-32,
  // RF-33) and comes back with an animation (RF-24).
  function hold(handle: Element, dy: number) {
    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientY: 400 + dy, pointerId: 1 });
  }
  const lift = (dialog: HTMLElement) =>
    parseFloat(dialog.style.translate.split(" ")[1] ?? "0");

  it("bands upwards from 0 once full, and comes back with play", async () => {
    phone(true);
    const dialog = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const handle = screen.getByRole("button", { name: "Reducir" });
    hold(handle, -300);
    expect(lift(dialog)).toBeLessThan(0);
    expect(lift(dialog)).toBeGreaterThan(-64);
    fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 });
    expect(dialog).toHaveAttribute("data-sheet", "full");
    expect(dialog.style.translate).toBe("");
    const [target, frames] = motion.play.mock.calls.at(-1)!;
    expect(target).toBe(dialog);
    expect(frames.at(-1)).toEqual({ translate: "0px 0px" });
  });

  it("at half follows up to the full height, then bands", () => {
    phone(true);
    const dialog = renderSheet();
    dialog.getBoundingClientRect = () => ({ height: 400 }) as DOMRect;
    const handle = screen.getByRole("button", { name: "Ampliar" });
    hold(handle, -100);
    expect(lift(dialog)).toBe(-100);
    const room = -(window.innerHeight - 400);
    hold(handle, room - 300);
    expect(lift(dialog)).toBeLessThan(room);
    expect(lift(dialog)).toBeGreaterThan(room - 64);
  });

  it("is the usual window from 769 px", () => {
    phone(false);
    const dialog = renderSheet();
    expect(dialog).not.toHaveAttribute("data-sheet");
    expect(screen.queryByRole("button", { name: "Ampliar" })).toBeNull();
  });
});
