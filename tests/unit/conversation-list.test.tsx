import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConversationList } from "@/components/assistant/conversation-list";

// Spec 052 T5: the list of saved conversations (RF-10).

const handlers = () => ({
  onOpen: vi.fn(),
  onDelete: vi.fn(),
  onDeleteAll: vi.fn(),
});

describe("ConversationList", () => {
  it("says it is loading, then that there are none", () => {
    const { rerender } = render(
      <ConversationList items={null} {...handlers()} />,
    );
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    rerender(<ConversationList items={[]} {...handlers()} />);
    expect(
      screen.getByText("No hay conversaciones guardadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar todas" })).toBeNull();
  });

  it("shows the title and the day, and asks before forgetting all", async () => {
    const props = handlers();
    render(
      <ConversationList
        items={[
          {
            id: "a",
            title: "¿Qué tengo mañana?",
            updatedAt: "2026-11-25T10:00:00Z",
          },
        ]}
        {...props}
      />,
    );
    expect(screen.getByText("25 nov 2026")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Borrar todas" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(props.onDeleteAll).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Borrar todas" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar todas" }));
    expect(props.onDeleteAll).toHaveBeenCalledTimes(1);
  });
});
