import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_STACK,
  pushAction,
  settle,
  STACK_LIMIT,
  take,
  undoLabel,
  type Step,
} from "@/lib/calendar/undo-stack";
import {
  UndoStackProvider,
  useUndoStack,
} from "@/components/calendar/undo-stack";
import { ToastProvider } from "@/components/ui/toast";

// Spec 046, T3: the undo and redo stack (RF-11 to RF-15, RF-17).
const ok: Step = async () => ({ ok: true });

describe("undo-stack (pure)", () => {
  it("keeps the last 20 and a new action clears the redo side (RF-11)", () => {
    let stack = EMPTY_STACK;
    for (let i = 0; i < STACK_LIMIT + 3; i++) {
      stack = pushAction(stack, { label: `a${i}`, step: ok });
    }
    expect(stack.undo).toHaveLength(20);
    expect(stack.undo[0].label).toBe("a3");
    stack = { ...stack, redo: [{ label: "r", step: ok }] };
    expect(pushAction(stack, { label: "b", step: ok }).redo).toEqual([]);
  });

  it("undoes and redoes in order through the inverses", () => {
    let stack = pushAction(EMPTY_STACK, { label: "a", step: ok });
    stack = pushAction(stack, { label: "b", step: ok });
    const first = take(stack, "undo")!;
    expect(first.entry.label).toBe("b");
    stack = settle(first.stack, "undo", first.entry, { ok: true, inverse: ok });
    expect(stack.undo.map((e) => e.label)).toEqual(["a"]);
    expect(stack.redo.map((e) => e.label)).toEqual(["b"]);

    const again = take(stack, "redo")!;
    stack = settle(again.stack, "redo", again.entry, { ok: true, inverse: ok });
    expect(stack.undo.map((e) => e.label)).toEqual(["a", "b"]);
    expect(stack.redo).toEqual([]);
  });

  it("drops an entry that fails, as when someone changed it (RF-13)", () => {
    const stack = pushAction(EMPTY_STACK, { label: "a", step: ok });
    const taken = take(stack, "undo")!;
    const after = settle(taken.stack, "undo", taken.entry, {
      ok: false,
      error: "x",
    });
    expect(after).toEqual(EMPTY_STACK);
    expect(take(after, "undo")).toBeNull();
  });

  it("names the action and its event", () => {
    expect(undoLabel("Evento movido", "Dentista")).toBe("mover «Dentista»");
    expect(undoLabel("Evento borrado")).toBe("borrar");
    expect(undoLabel("Algo nuevo")).toBe("algo nuevo");
  });
});

function Recorder({ steps }: { steps: Record<string, Step> }) {
  const stack = useUndoStack()!;
  return (
    <>
      {Object.entries(steps).map(([label, step]) => (
        <button
          key={label}
          type="button"
          onClick={() => stack.record(label, `Hecho ${label}`, step)}
        >
          {label}
        </button>
      ))}
      <input aria-label="Campo" />
    </>
  );
}

function setup(steps: Record<string, Step>) {
  return render(
    <ToastProvider>
      <UndoStackProvider>
        <Recorder steps={steps} />
      </UndoStackProvider>
    </ToastProvider>,
  );
}

const ctrl = (key: string, extra: object = {}) =>
  act(async () => {
    fireEvent.keyDown(window, { key, ctrlKey: true, ...extra });
  });

describe("UndoStackProvider", () => {
  it("Ctrl+Z undoes the last action even after its notice; Ctrl+Mayús+Z redoes it (RF-12)", async () => {
    const undone: string[] = [];
    const redone: string[] = [];
    const step =
      (label: string): Step =>
      async () => {
        undone.push(label);
        return {
          ok: true,
          inverse: async () => {
            redone.push(label);
            return { ok: true, inverse: step(label) };
          },
        };
      };
    setup({ mover: step("mover"), borrar: step("borrar") });
    await userEvent.click(screen.getByRole("button", { name: "mover" }));
    await userEvent.click(screen.getByRole("button", { name: "borrar" }));

    await ctrl("z");
    expect(await screen.findByText("Deshecho: borrar")).toBeInTheDocument();
    await ctrl("z");
    expect(undone).toEqual(["borrar", "mover"]);
    expect(await screen.findByText("Deshecho: mover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rehacer" })).toBeInTheDocument();

    await ctrl("z", { shiftKey: true });
    await ctrl("y");
    expect(redone).toEqual(["mover", "borrar"]);
    expect(await screen.findByText("Rehecho: borrar")).toBeInTheDocument();
  });

  it("says why when it cannot undo, and there is nothing left (RF-13)", async () => {
    setup({
      mover: async () => ({
        ok: false,
        error: "No se puede deshacer: alguien lo cambió",
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: "mover" }));
    await ctrl("z");
    expect(
      await screen.findByText("No se puede deshacer: alguien lo cambió"),
    ).toBeInTheDocument();
    await ctrl("z");
    expect(
      await screen.findByText("No hay nada que deshacer."),
    ).toBeInTheDocument();
  });

  it("leaves Ctrl+Z to a text field and to a modal window (RF-12)", async () => {
    const step = vi.fn(ok);
    setup({ mover: step });
    await userEvent.click(screen.getByRole("button", { name: "mover" }));
    const field = screen.getByLabelText("Campo");
    await act(async () => {
      fireEvent.keyDown(field, { key: "z", ctrlKey: true });
    });
    expect(step).not.toHaveBeenCalled();

    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    // jsdom has no showModal(): this one says it is modal, like a sheet.
    dialog.matches = (selector: string) => selector === ":modal";
    document.body.append(dialog);
    try {
      await ctrl("z");
      expect(step).not.toHaveBeenCalled();
    } finally {
      dialog.remove();
    }
  });

  it("the notice's button undoes the same entry", async () => {
    const step = vi.fn(ok);
    setup({ mover: step });
    await userEvent.click(screen.getByRole("button", { name: "mover" }));
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(step).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Deshecho: mover")).toBeInTheDocument();
  });
});
