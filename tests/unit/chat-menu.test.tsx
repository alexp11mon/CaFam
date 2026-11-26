import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 052 T5: the "⋯" of the chat and its saved conversations (RF-9 to
// RF-12, RF-14).

const actions = vi.hoisted(() => ({
  setSaveChats: vi.fn(),
  listConversations: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversations: vi.fn(),
}));
vi.mock("@/app/dashboard/assistant/conversation-actions", () => actions);

const { ChatMenu } = await import("@/components/assistant/chat-menu");

const ITEMS = [
  { id: "a", title: "¿Qué tengo mañana?", updatedAt: "2026-11-25T10:00:00Z" },
  { id: "b", title: "Borra la cena", updatedAt: "2026-11-20T10:00:00Z" },
];

function Harness({
  initial = false,
  onOpen = async () => true,
  speak,
}: {
  initial?: boolean;
  onOpen?: (id: string) => Promise<boolean>;
  speak?: { on: boolean; onChange: (on: boolean) => void };
}) {
  const [on, setOn] = useState(initial);
  return (
    <ChatMenu
      saveChats={on}
      onSaveChatsChange={setOn}
      onOpenConversation={onOpen}
      speak={speak}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  actions.setSaveChats.mockResolvedValue({ ok: true });
  actions.listConversations.mockResolvedValue(ITEMS);
  actions.deleteConversation.mockResolvedValue({ ok: true });
  actions.deleteConversations.mockResolvedValue({ ok: true });
});

async function openMenu() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Más opciones del chat" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Opciones del chat",
  });
  return { user, dialog };
}

describe("ChatMenu", () => {
  it("saving is off by default and turns on (RF-9)", async () => {
    render(<Harness />);
    const { user, dialog } = await openMenu();
    const toggle = within(dialog).getByRole("switch", {
      name: "Guardar conversaciones",
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(actions.setSaveChats).toHaveBeenCalledWith(true, false);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("asks whether to forget the saved ones when turned off (RF-12)", async () => {
    render(<Harness initial />);
    const { user, dialog } = await openMenu();
    await within(dialog).findByText("¿Qué tengo mañana?");
    await user.click(
      within(dialog).getByRole("switch", { name: "Guardar conversaciones" }),
    );
    expect(actions.setSaveChats).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Borrarlas" }));
    expect(actions.setSaveChats).toHaveBeenCalledWith(false, true);
    expect(
      await within(dialog).findByText("No hay conversaciones guardadas."),
    ).toBeInTheDocument();
  });

  it("goes back on the switch when saving fails", async () => {
    actions.setSaveChats.mockResolvedValue({ ok: false, error: "x" });
    render(<Harness />);
    const { user, dialog } = await openMenu();
    const toggle = within(dialog).getByRole("switch", {
      name: "Guardar conversaciones",
    });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("lists, opens and forgets conversations (RF-10)", async () => {
    const onOpen = vi.fn(async () => true);
    render(<Harness initial onOpen={onOpen} />);
    const { user, dialog } = await openMenu();
    await user.click(
      await within(dialog).findByRole("button", { name: /^Borra la cena/ }),
    );
    expect(onOpen).toHaveBeenCalledWith("b");

    await openMenu();
    const again = screen.getByRole("dialog", { name: "Opciones del chat" });
    await user.click(
      await within(again).findByRole("button", {
        name: "Borrar «¿Qué tengo mañana?»",
      }),
    );
    expect(actions.deleteConversation).toHaveBeenCalledWith("a");
    expect(within(again).queryByText("¿Qué tengo mañana?")).toBeNull();

    await user.click(
      within(again).getByRole("button", { name: "Borrar todas" }),
    );
    await user.click(
      within(again).getByRole("button", { name: "Sí, borrar todas" }),
    );
    expect(actions.deleteConversations).toHaveBeenCalled();
  });

  it("offers reading aloud only where the browser can (RF-14, RF-15)", async () => {
    const { unmount } = render(<Harness />);
    let { dialog } = await openMenu();
    expect(
      within(dialog).queryByRole("switch", {
        name: "Leer respuestas en voz alta",
      }),
    ).toBeNull();
    unmount();

    const onChange = vi.fn();
    render(<Harness speak={{ on: false, onChange }} />);
    ({ dialog } = await openMenu());
    await userEvent.click(
      within(dialog).getByRole("switch", {
        name: "Leer respuestas en voz alta",
      }),
    );
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
