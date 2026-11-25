import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventNotes } from "@/components/notes/event-notes";
import { NoteForm } from "@/components/notes/note-form";

vi.mock("@/lib/offline/note-actions", () => ({
  createNoteOrQueue: vi.fn(),
}));

// Spec 048 RF-9, RF-10: the notes of an event and a note made for one.
const EVENT = "8b2f0c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f_20261210T190000Z";

describe("EventNotes", () => {
  it("lists the linked notes with their progress and adds one for the event", async () => {
    const loadNotes = vi.fn(async () => ({
      notes: [
        {
          id: "n1",
          title: "Compra",
          kind: "list" as const,
          done: { done: 2, total: 5 },
        },
        { id: "n2", title: "", kind: "text" as const, done: null },
      ],
    }));
    render(<EventNotes eventId={EVENT} loadNotes={loadNotes} />);
    expect(screen.getByRole("heading", { name: "Notas" })).toBeInTheDocument();
    const list = await screen.findByRole("link", { name: /Compra/ });
    expect(list).toHaveAttribute("href", "/dashboard/notes/n1");
    expect(list).toHaveTextContent("2/5");
    expect(
      screen.getByRole("link", { name: "(Sin título)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Añadir nota" })).toHaveAttribute(
      "href",
      `/dashboard/notes/new?event=${encodeURIComponent(EVENT)}`,
    );
    expect(loadNotes).toHaveBeenCalledWith(EVENT);
  });

  it("says when there are none or they could not be read", async () => {
    const view = render(
      <EventNotes eventId={EVENT} loadNotes={async () => ({ notes: [] })} />,
    );
    expect(await screen.findByText("Sin notas")).toBeInTheDocument();
    view.unmount();
    render(
      <EventNotes
        eventId={EVENT}
        loadNotes={async () => ({ error: "No se ha podido conectar." })}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido conectar.",
    );
  });
});

describe("NoteForm for an event", () => {
  it("says which event and sends it, shared in its calendar by default", () => {
    const { container } = render(
      <NoteForm
        action={vi.fn()}
        calendars={[{ id: "c1", name: "Casa" }]}
        event={{ id: EVENT, label: "Cena con Ana · 10 dic" }}
        defaultCalendarId="c1"
      />,
    );
    expect(screen.getByText("Cena con Ana · 10 dic")).toBeInTheDocument();
    expect(
      container.querySelector<HTMLInputElement>('input[name="eventId"]')?.value,
    ).toBe(EVENT);
    expect(screen.getByLabelText("Dónde se guarda")).toHaveValue("c1");
  });
});
