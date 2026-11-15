import { act, render, screen } from "@testing-library/react";
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
import { AssistantFab } from "@/components/shell/assistant-fab";

// Venito's button and the chat panel (spec 015 RF-39; spec 027 RF-2, RF-3).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/calendar" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/app/dashboard/assistant/context-actions", () => ({
  loadAssistantContext: async () => ({
    timeZone: "Europe/Madrid",
    calendars: [],
  }),
}));

const fetchMock = vi.fn();
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  navigation.pathname = "/dashboard/calendar";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const venito = () =>
  screen.getByRole("button", { name: /^Venito, tu asistente/ });

describe("Venito's button (RF-2)", () => {
  it("is Venito's face, named, in the corner above the bottom bar", () => {
    render(<AssistantFab />);
    const button = venito();
    expect(button.querySelector("[data-venito]")).not.toBeNull();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button.className).toContain(
      "bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]",
    );
    // Above the calendar's own bar while it is on screen (spec 026 RF-7).
    expect(button.className).toContain("group-data-[has-dock]/frame:bottom-");
    expect(button).toHaveClass("size-14", "lg:bottom-6");
  });

  it("is on other screens too, but not on the assistant's own page", () => {
    navigation.pathname = "/dashboard/settings";
    const { unmount } = render(<AssistantFab />);
    expect(venito()).toBeInTheDocument();
    unmount();
    navigation.pathname = "/dashboard/assistant";
    render(<AssistantFab />);
    expect(screen.queryByRole("button", { name: /Venito/ })).toBeNull();
  });

  it("wakes the assistant up once, when it is touched (spec 024 RF-19)", () => {
    render(<AssistantFab />);
    const button = venito();
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    act(() => button.focus());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/assistant");
  });
});

describe("the chat panel (RF-2, RF-3)", () => {
  it("opens the chat right there, with no navigation, and closes back to the button", async () => {
    render(<AssistantFab />);
    // A closed dialog has no accessible name to be found by.
    const panel = document.querySelector<HTMLElement>(
      'dialog[aria-label="Chat con Venito"]',
    )!;
    expect(panel).not.toHaveAttribute("open");
    // The chat is not part of the first paint of a screen (RNF-2).
    expect(screen.queryByLabelText("Tu pregunta")).toBeNull();

    await userEvent.click(venito());
    expect(panel).toHaveAttribute("open");
    expect(await screen.findByLabelText("Tu pregunta")).toBeInTheDocument();
    expect(venito()).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar el chat" }),
    );
    expect(panel).not.toHaveAttribute("open");
    expect(venito()).toHaveFocus();
  });

  it("closes with Escape (the browser closes the dialog) and on a tap outside", async () => {
    render(<AssistantFab />);
    await userEvent.click(venito());
    const panel = screen.getByRole("dialog", { name: "Chat con Venito" });
    await screen.findByLabelText("Tu pregunta");

    panel.removeAttribute("open");
    act(() => void panel.dispatchEvent(new Event("close")));
    expect(venito()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(venito());
    await userEvent.click(panel);
    expect(panel).not.toHaveAttribute("open");
  });

  it("closes when its header is dragged down", async () => {
    render(<AssistantFab />);
    await userEvent.click(venito());
    const panel = screen.getByRole("dialog", { name: "Chat con Venito" });
    const header = (await screen.findByRole("banner")) as HTMLElement;

    const move = (type: string, clientY: number) =>
      act(() => {
        const event = new Event(type, { bubbles: true });
        Object.assign(event, { pointerId: 1, clientY });
        header.dispatchEvent(event);
      });
    move("pointerdown", 20);
    move("pointerup", 60);
    expect(panel).toHaveAttribute("open");
    move("pointerdown", 20);
    move("pointerup", 140);
    expect(panel).not.toHaveAttribute("open");
  });

  it("keeps the conversation while the app is open (RF-3)", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init
        ? json({ answer: "Hoy tienes dentista.", events: [], remaining: 29 })
        : new Response(null, { status: 204 }),
    );
    render(<AssistantFab />);
    await userEvent.click(venito());
    await userEvent.type(
      await screen.findByLabelText("Tu pregunta"),
      "¿Qué hay hoy?{Enter}",
    );
    await screen.findByText("Hoy tienes dentista.");

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar el chat" }),
    );
    await userEvent.click(venito());
    expect(screen.getByText("Hoy tienes dentista.")).toBeInTheDocument();
  });

  it("says on the button that an answer is on its way, and that it has come", async () => {
    let answer: (response: Response) => void = () => {};
    fetchMock.mockImplementation((_url, init) =>
      init
        ? new Promise<Response>((resolve) => (answer = resolve))
        : Promise.resolve(new Response(null, { status: 204 })),
    );
    render(<AssistantFab />);
    await userEvent.click(venito());
    await userEvent.type(
      await screen.findByLabelText("Tu pregunta"),
      "¿Qué hay hoy?{Enter}",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar el chat" }),
    );

    expect(venito()).toHaveAccessibleName(
      "Venito, tu asistente, está respondiendo",
    );
    expect(venito().querySelector('[data-venito="thinking"]')).not.toBeNull();

    await act(async () =>
      answer(json({ answer: "Nada.", events: [], remaining: 29 })),
    );
    await vi.waitFor(() =>
      expect(venito()).toHaveAccessibleName(
        "Venito, tu asistente, ha respondido",
      ),
    );
    // Opening it is seeing it.
    await userEvent.click(venito());
    expect(venito()).toHaveAccessibleName("Venito, tu asistente");
  });
});
