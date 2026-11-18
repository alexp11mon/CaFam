import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAction } from "@/lib/assistant/actions";

// Spec 036, T7: the cards of what Venito created or proposes (RF-17,
// RF-24 to RF-24d, RF-30, RF-32 to RF-37).

const { confirmChange, undoAssistantAction } = vi.hoisted(() => ({
  confirmChange: vi.fn(),
  undoAssistantAction: vi.fn(),
}));
vi.mock("@/app/dashboard/assistant/write-actions", () => ({
  confirmChange,
  undoAssistantAction,
}));

const { ActionCard } = await import("@/components/assistant/action-card");
type ChatAction = import("@/components/assistant/action-card").ChatAction;

const TZ = "Europe/Madrid";
const ID = "11111111-1111-4111-8111-111111111111";
const event = {
  id: ID,
  title: "Comida Uni",
  startsAt: "2026-11-19T12:30:00.000Z",
  endsAt: "2026-11-19T13:30:00.000Z",
  allDay: false,
  calendarName: "alexponmon@gmail.com",
  color: "#A0C4FF",
};
const created: AssistantAction = {
  kind: "created",
  key: "a1",
  event,
  anchor: {
    title: "PIAE",
    startsAt: "2026-11-19T11:00:00.000Z",
    endsAt: "2026-11-19T12:30:00.000Z",
    allDay: false,
  },
  undo: { kind: "uncreate", id: ID, updatedAt: "u1" },
};
const fields = {
  title: "Comida Uni",
  description: null,
  location: null,
  calendarId: "22222222-2222-4222-8222-222222222222",
  startsAt: "2026-11-19T13:00:00.000Z",
  endsAt: "2026-11-19T14:00:00.000Z",
  allDay: false,
};
const change: AssistantAction = {
  kind: "change",
  key: "a2",
  before: event,
  after: { ...event, startsAt: fields.startsAt, endsAt: fields.endsAt },
  scope: null,
  change: { id: ID, scope: null, updatedAt: "u1", fields },
};

function Harness({
  initial,
  onChanged = () => {},
}: {
  initial: ChatAction;
  onChanged?: () => void;
}) {
  const [card, setCard] = useState(initial);
  return (
    <ActionCard
      card={card}
      timeZone={TZ}
      onChange={setCard}
      onChanged={onChanged}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ActionCard of a created event", () => {
  it("shows what was created, against which event, and how to open it", () => {
    render(<Harness initial={{ action: created, status: "done" }} />);
    const card = screen.getByRole("region", {
      name: "[Evento creado: Comida Uni, jueves 19 de noviembre, de 13:30 a 14:30, en alexponmon@gmail.com]",
    });
    expect(card).toHaveTextContent("Evento creado");
    expect(card).toHaveTextContent("jueves 19 de noviembre, de 13:30 a 14:30");
    expect(card).toHaveTextContent("alexponmon@gmail.com");
    expect(card).toHaveTextContent(
      "Al acabar PIAE (jueves 19 de noviembre, de 12:00 a 13:30)",
    );
    expect(
      screen.getByRole("link", { name: "Abrir Comida Uni" }),
    ).toHaveAttribute("href", `/dashboard/events/${ID}`);
  });

  it("undoes it and says so (RF-34, RF-37)", async () => {
    undoAssistantAction.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(
      <Harness
        initial={{ action: created, status: "done" }}
        onChanged={onChanged}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(undoAssistantAction).toHaveBeenCalledWith(created.undo);
    expect(await screen.findByText("Deshecho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Abrir/ })).toBeNull();
    expect(onChanged).toHaveBeenCalled();
  });

  it("explains why it could not undo (RF-36)", async () => {
    undoAssistantAction.mockResolvedValue({
      ok: false,
      error: "Este evento ha cambiado entretanto; no se ha deshecho.",
    });
    render(<Harness initial={{ action: created, status: "done" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este evento ha cambiado entretanto",
    );
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
  });
});

describe("ActionCard of a change", () => {
  it("shows now and after, and writes nothing until confirmed (RF-24)", () => {
    render(<Harness initial={{ action: change, status: "pending" }} />);
    expect(screen.getByText("Cambio pendiente")).toBeInTheDocument();
    expect(screen.getByText("Ahora")).toBeInTheDocument();
    expect(screen.getByText("Quedará")).toBeInTheDocument();
    expect(
      screen.getByText("jueves 19 de noviembre, de 14:00 a 15:00"),
    ).toBeInTheDocument();
    expect(confirmChange).not.toHaveBeenCalled();
  });

  it("applies it on «Confirmar», then offers to undo it (RF-24a, RF-35)", async () => {
    const undo = {
      kind: "unchange" as const,
      id: ID,
      updatedAt: "u2",
      before: { ...fields, startsAt: event.startsAt, endsAt: event.endsAt },
      series: false,
    };
    confirmChange.mockResolvedValue({ ok: true, undo });
    undoAssistantAction.mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    render(
      <Harness
        initial={{ action: change, status: "pending" }}
        onChanged={onChanged}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(confirmChange).toHaveBeenCalledWith(change.change);
    expect(await screen.findByText("Cambio aplicado")).toBeInTheDocument();
    expect(screen.getByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("Después")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(undoAssistantAction).toHaveBeenCalledWith(undo);
    expect(await screen.findByText("Deshecho")).toBeInTheDocument();
  });

  it("cancels without writing (RF-24b)", async () => {
    render(<Harness initial={{ action: change, status: "pending" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(confirmChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  });

  it("keeps it pending with the reason when it cannot be applied (RF-24d)", async () => {
    confirmChange.mockResolvedValue({
      ok: false,
      error:
        "Este evento ha cambiado desde que te propuse el cambio; no lo he aplicado. Pídemelo otra vez.",
    });
    render(<Harness initial={{ action: change, status: "pending" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ha cambiado desde que te propuse",
    );
    expect(screen.getByText("No aplicado")).toBeInTheDocument();
  });

  it("warns of what a series change loses and that it cannot be undone (RF-30, D8)", async () => {
    confirmChange.mockResolvedValue({ ok: true });
    render(
      <Harness
        initial={{
          action: {
            ...change,
            scope: "all",
            loss: { exceptions: 2, images: 1, comments: 0 },
          },
          status: "pending",
        }}
      />,
    );
    expect(
      screen.getByText(
        "Todos los eventos de la serie. Se perderán 2 cambios y 1 imagen.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(
        "Este cambio afecta a varios eventos y no se puede deshacer.",
      ),
    ).toBeInTheDocument();
  });

  it("is only a record once replaced (RF-24c)", () => {
    render(<Harness initial={{ action: change, status: "superseded" }} />);
    expect(screen.getByText("Sustituido")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
