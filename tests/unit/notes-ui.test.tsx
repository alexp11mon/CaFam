import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "@/components/notes/note-editor";
import { NoteForm } from "@/components/notes/note-form";
import { NotesBoard } from "@/components/notes/notes-board";
import { AUTOSAVE_MS } from "@/components/notes/text-note";
import { ToastProvider } from "@/components/ui/toast";
import type { NoteAccess } from "@/lib/notes/permissions";
import type { Note, NoteItem } from "@/lib/notes/types";

// Spec 028, T4 and T5: the list of notes, the form and one note.
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/hooks/use-live-calendar", () => ({ useLiveCalendar: vi.fn() }));
const actions = vi.hoisted(() => ({
  addItem: vi.fn(),
  clearDone: vi.fn(),
  deleteItem: vi.fn(),
  deleteNote: vi.fn(),
  moveItems: vi.fn(),
  updateItem: vi.fn(),
  updateNote: vi.fn(),
}));
vi.mock("@/app/dashboard/notes/actions", () => actions);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(actions)) action.mockResolvedValue({});
});

const item = (id: string, position: number, done = false): NoteItem => ({
  id,
  text: id,
  done,
  doneAt: done ? "2026-11-15T09:00:00Z" : null,
  position,
});

const note = (over: Partial<Note> = {}): Note => ({
  id: "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11",
  kind: "list",
  title: "Compra",
  body: "",
  color: null,
  pinned: false,
  archived: false,
  dueDate: null,
  updatedAt: "2026-11-15T10:00:00Z",
  ownerId: "me",
  calendarId: null,
  calendarName: null,
  items: [item("Pan", 0), item("Leche", 1), item("Huevos", 2, true)],
  ...over,
});

const FULL: NoteAccess = {
  canWrite: true,
  canDelete: true,
  canMove: true,
  readOnlyReason: null,
};

describe("NotesBoard (RF-1 to RF-3)", () => {
  const notes = [
    note({ id: "a", title: "Compra", updatedAt: "2026-11-10T00:00:00Z" }),
    note({
      id: "b",
      kind: "text",
      title: "Médico",
      body: "Pedir cita",
      items: [],
      updatedAt: "2026-11-14T00:00:00Z",
    }),
    note({
      id: "c",
      title: "Deberes",
      pinned: true,
      dueDate: "2026-11-19",
      items: [],
    }),
    note({ id: "d", title: "Vieja", archived: true, items: [] }),
  ];
  const titles = () =>
    screen
      .getAllByRole("link")
      .map((link) => within(link).getAllByText(/./)[0]!.textContent);

  it("shows the cards, pinned first and then the latest, without the archived", () => {
    render(<NotesBoard notes={notes} today="2026-11-15" userId="me" />);
    expect(titles()).toEqual(["Deberes", "Médico", "Compra"]);
    const shopping = screen.getByRole("link", { name: /Compra/ });
    expect(shopping).toHaveAttribute("href", "/dashboard/notes/a");
    // A look inside: the pending items and how many are done.
    expect(shopping).toHaveTextContent("Pan");
    expect(shopping).toHaveTextContent("1 de 3");
    expect(shopping).not.toHaveTextContent("Huevos");
    expect(screen.getByRole("link", { name: /Deberes/ })).toHaveTextContent(
      "Para el jueves, 19 de noviembre",
    );
    expect(screen.getByRole("link", { name: /Deberes/ })).toHaveTextContent(
      "Fijada",
    );
  });

  it("filters as it is typed, ignoring accents, and by kind", async () => {
    render(<NotesBoard notes={notes} today="2026-11-15" userId="me" />);
    await userEvent.type(
      screen.getByLabelText("Buscar en tus notas"),
      "medico",
    );
    expect(titles()).toEqual(["Médico"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 nota");

    await userEvent.clear(screen.getByLabelText("Buscar en tus notas"));
    await userEvent.click(screen.getByRole("button", { name: "Listas" }));
    expect(titles()).toEqual(["Deberes", "Compra"]);
    expect(screen.getByRole("button", { name: "Listas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Archivadas" }));
    expect(titles()).toEqual(["Vieja"]);
  });

  it("says so with Venito when there is nothing (RF-3)", async () => {
    const { container, rerender } = render(
      <NotesBoard notes={[]} today="2026-11-15" userId="me" />,
    );
    expect(screen.getByText("Todavía no tienes notas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva nota" })).toHaveAttribute(
      "href",
      "/dashboard/notes/new",
    );
    expect(container.querySelector("[data-venito]")).not.toBeNull();

    rerender(<NotesBoard notes={notes} today="2026-11-15" userId="me" />);
    await userEvent.type(screen.getByLabelText("Buscar en tus notas"), "zzz");
    expect(
      screen.getByText("Ninguna nota con esas palabras"),
    ).toBeInTheDocument();
  });
});

describe("NoteForm (RF-4)", () => {
  it("asks for the kind, an optional title and where it lives", () => {
    render(
      <NoteForm
        action={async () => ({})}
        calendars={[{ id: "c1", name: "Casa" }]}
      />,
    );
    expect(
      screen.getByRole("radio", { name: /Lista de tareas/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Nota de texto/ }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Título (opcional)")).toHaveClass("text-base");
    const where = screen.getByLabelText("Dónde se guarda");
    expect(
      within(where)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Personal (solo tú la ves)", "Compartida en Casa"]);
    expect(where).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear nota" })).toBeEnabled();
  });

  it("shows why it could not be created and keeps what was written", () => {
    function Failed() {
      return <NoteForm action={async () => ({})} calendars={[]} />;
    }
    render(<Failed />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

function editor(over: Partial<Note> = {}, access: NoteAccess = FULL) {
  const value = note(over);
  const view = render(
    <ToastProvider>
      <NoteEditor
        note={value}
        access={access}
        calendars={[{ id: "c1", name: "Casa" }]}
        today="2026-11-15"
        userId="me"
      />
    </ToastProvider>,
  );
  const pending = () =>
    within(screen.getByRole("list", { name: "Pendientes" }))
      .getAllByRole("checkbox")
      .map((box) => box.getAttribute("aria-label"));
  return { value, pending, ...view };
}

describe("a list (RF-6, RF-9)", () => {
  it("adds with Enter, keeps the focus for the next one and saves it with its own id", async () => {
    const { pending, value } = editor();
    const adder = screen.getByLabelText("Añadir elemento");
    await userEvent.type(adder, "Fruta{Enter}");

    expect(pending()).toEqual(["Pan", "Leche", "Fruta"]);
    expect(adder).toHaveValue("");
    expect(adder).toHaveFocus();
    expect(actions.addItem).toHaveBeenCalledExactlyOnceWith(value.id, {
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      text: "Fruta",
      position: 3,
    });
    // Said to who cannot see it, once it is saved.
    expect(await screen.findByText("Añadido «Fruta»")).toHaveClass("sr-only");
  });

  it("ticks an item at once and takes it down with the done ones", async () => {
    const { pending } = editor();
    await userEvent.click(screen.getByRole("checkbox", { name: "Pan" }));

    expect(pending()).toEqual(["Leche"]);
    const done = within(screen.getByRole("list", { name: "Completadas" }))
      .getAllByRole("checkbox")
      .map((box) => box.getAttribute("aria-label"));
    expect(done).toEqual(["Huevos", "Pan"]);
    expect(screen.getByText("Completadas: 2 de 3")).toBeInTheDocument();
    expect(actions.updateItem).toHaveBeenCalledExactlyOnceWith("Pan", {
      done: true,
    });
  });

  it("goes back and says why when saving fails (RF-9)", async () => {
    actions.updateItem.mockResolvedValue({
      error: "No se ha podido conectar.",
    });
    const { pending } = editor();
    await userEvent.click(screen.getByRole("checkbox", { name: "Pan" }));
    expect(
      await screen.findByText("No se ha podido conectar."),
    ).toBeInTheDocument();
    expect(pending()).toEqual(["Pan", "Leche"]);
  });

  it("moves an item with its buttons, which stop at the ends", async () => {
    const { pending, value } = editor();
    expect(screen.getByRole("button", { name: "Subir «Pan»" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Bajar «Leche»" }),
    ).toBeDisabled();
    // Done items do not move.
    expect(screen.queryByRole("button", { name: "Subir «Huevos»" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Bajar «Pan»" }));
    expect(pending()).toEqual(["Leche", "Pan"]);
    expect(actions.moveItems).toHaveBeenCalledExactlyOnceWith(value.id, [
      { id: "Pan", position: 1 },
      { id: "Leche", position: 0 },
    ]);
  });

  it("renames an item in place when its field is left", async () => {
    editor();
    const field = screen.getByLabelText("Texto de «Pan»");
    await userEvent.clear(field);
    await userEvent.type(field, "Pan integral{Enter}");
    expect(actions.updateItem).toHaveBeenCalledExactlyOnceWith("Pan", {
      text: "Pan integral",
    });
    expect(
      screen.getByRole("checkbox", { name: "Pan integral" }),
    ).toBeInTheDocument();
  });

  it("deletes an item and puts it back with Deshacer", async () => {
    const { pending, value } = editor();
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar «Leche»" }),
    );
    expect(pending()).toEqual(["Pan"]);
    expect(actions.deleteItem).toHaveBeenCalledExactlyOnceWith("Leche");

    await userEvent.click(
      await screen.findByRole("button", { name: "Deshacer" }),
    );
    await vi.waitFor(() => expect(pending()).toEqual(["Pan", "Leche"]));
    expect(actions.addItem).toHaveBeenCalledExactlyOnceWith(value.id, {
      id: "Leche",
      text: "Leche",
      position: 1,
      done: false,
    });
  });

  it("clears the done ones", async () => {
    const { value } = editor();
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar los completados" }),
    );
    expect(screen.queryByRole("list", { name: "Completadas" })).toBeNull();
    expect(actions.clearDone).toHaveBeenCalledExactlyOnceWith(value.id);
  });
});

describe("due dates of items (spec 048 RF-1, RF-2)", () => {
  it("sets one from its menu, shows it and saves it", async () => {
    const { value } = editor();
    await userEvent.click(
      screen.getByRole("button", { name: "Fecha de «Pan»" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Mañana" }));
    expect(screen.getByText("mañana")).toBeInTheDocument();
    expect(actions.updateItem).toHaveBeenCalledExactlyOnceWith("Pan", {
      dueDate: "2026-11-16",
      dueTime: null,
    });
    expect(value.items[0]!.text).toBe("Pan");
  });

  it("shows a past one in red, but not once done", () => {
    editor({
      items: [
        { ...item("Pan", 0), dueDate: "2026-11-14" },
        { ...item("Sal", 1, true), dueDate: "2026-11-14" },
      ],
    });
    const labels = screen.getAllByText("ayer");
    expect(labels[0]).toHaveClass("text-danger");
    expect(labels[1]).not.toHaveClass("text-danger");
  });

  it("the card shows the closest pending one", () => {
    render(
      <NotesBoard
        notes={[
          note({
            items: [
              { ...item("Pan", 0), dueDate: "2026-11-20" },
              { ...item("Sal", 1), dueDate: "2026-11-16", dueTime: "18:00" },
            ],
          }),
        ]}
        today="2026-11-15"
        userId="me"
      />,
    );
    expect(screen.getByText("Próximo: mañana · 18:00")).toBeInTheDocument();
  });
});

describe("the note itself (RF-5, RF-8)", () => {
  it("saves the title when its field is left", async () => {
    const { value } = editor();
    const title = screen.getByLabelText("Título");
    await userEvent.clear(title);
    await userEvent.type(title, "Mercado");
    await userEvent.tab();
    expect(actions.updateNote).toHaveBeenCalledExactlyOnceWith(value.id, {
      title: "Mercado",
    });
  });

  it("pins, archives, colors, dates and shares it, one change each", async () => {
    const { value } = editor();
    await userEvent.click(screen.getByRole("button", { name: "Fijar arriba" }));
    expect(
      screen.getByRole("button", { name: "Dejar de fijar" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Archivar" }));
    await userEvent.click(screen.getByRole("button", { name: "Menta" }));
    await userEvent.selectOptions(
      screen.getByLabelText("Dónde se guarda"),
      "c1",
    );
    expect(actions.updateNote.mock.calls).toEqual([
      [value.id, { pinned: true }],
      [value.id, { archived: true }],
      [value.id, { color: "#CAFFBF" }],
      [value.id, { calendarId: "c1" }],
    ]);
  });

  it("asks before deleting the note and goes back to the list", async () => {
    const { value } = editor();
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar la nota" }),
    );
    const sheet = screen.getByRole("dialog", { name: "¿Borrar esta nota?" });
    expect(actions.deleteNote).not.toHaveBeenCalled();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Borrar la nota" }),
    );
    expect(actions.deleteNote).toHaveBeenCalledExactlyOnceWith(value.id);
    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/dashboard/notes"),
    );
  });

  it("is read only for a viewer, who is told why (RF-10)", () => {
    editor(
      { calendarId: "c1", calendarName: "Casa", ownerId: "ana" },
      {
        canWrite: false,
        canDelete: false,
        canMove: false,
        readOnlyReason: "Solo lectura: eres Lector de «Casa».",
      },
    );
    expect(
      screen.getByText("Solo lectura: eres Lector de «Casa»."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compra" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Añadir elemento")).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar la nota" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Borrar «/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Pan" })).toBeDisabled();
    expect(
      screen.queryByRole("region", { name: "Opciones de la nota" }),
    ).toBeNull();
  });

  it("takes what the server sends later, when nothing is being saved (RF-12)", () => {
    const first = note();
    const props = {
      access: FULL,
      calendars: [],
      today: "2026-11-15",
      userId: "me",
    };
    const { rerender } = render(
      <ToastProvider>
        <NoteEditor note={first} {...props} />
      </ToastProvider>,
    );
    rerender(
      <ToastProvider>
        <NoteEditor
          note={{ ...first, items: [...first.items, item("Sal", 5)] }}
          {...props}
        />
      </ToastProvider>,
    );
    expect(screen.getByRole("checkbox", { name: "Sal" })).toBeInTheDocument();
  });
});

describe("a text note (RF-7)", () => {
  it("saves itself a while after the last key and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { value } = editor({ kind: "text", body: "Hola", items: [] });
    const body = screen.getByLabelText("Texto de la nota");
    await user.type(body, " mundo");
    expect(actions.updateNote).not.toHaveBeenCalled();

    await act(async () => void vi.advanceTimersByTime(AUTOSAVE_MS));
    expect(actions.updateNote).toHaveBeenCalledExactlyOnceWith(value.id, {
      body: "Hola mundo",
    });
    await vi.waitFor(() =>
      expect(screen.getByText("Guardado")).toBeInTheDocument(),
    );
    vi.useRealTimers();
  });
});
