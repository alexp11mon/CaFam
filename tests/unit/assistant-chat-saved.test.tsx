import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeLine } from "@/lib/assistant/stream";

// Spec 052 T5, T6: the chat saves its conversation only with the switch on,
// opens a saved one with its waiting cards expired, and reads answers aloud
// only when asked (RF-9 to RF-11, RF-14).

const conversations = vi.hoisted(() => ({
  saveConversation: vi.fn(),
  loadConversation: vi.fn(),
  listConversations: vi.fn(),
  setSaveChats: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversations: vi.fn(),
}));
vi.mock("@/app/dashboard/assistant/conversation-actions", () => conversations);
vi.mock("@/app/dashboard/assistant/write-actions", () => ({
  confirmChange: vi.fn(),
  confirmDelete: vi.fn(),
  confirmSeries: vi.fn(),
  undoAssistantAction: vi.fn(),
}));

const { AssistantChat } = await import("@/components/assistant/assistant-chat");
const { setSpeakAnswers } = await import("@/lib/hooks/use-speak-answers");

const fetchMock = vi.fn();
const event = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Cena",
  startsAt: "2026-11-20T19:00:00.000Z",
  endsAt: "2026-11-20T21:00:00.000Z",
  allDay: false,
  calendarName: "Uni",
  color: "#A0C4FF",
};

function answer(text: string) {
  return new Response(
    encodeLine({ type: "done", answer: text, events: [], remaining: 20 }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  conversations.saveConversation.mockResolvedValue({ ok: true });
  conversations.listConversations.mockResolvedValue([
    { id: "c-1", title: "Borra la cena", updatedAt: "2026-11-20T10:00:00Z" },
  ]);
  setSpeakAnswers(null);
});
afterEach(() => vi.unstubAllGlobals());

function setup(saveChats: boolean) {
  const user = userEvent.setup();
  render(
    <AssistantChat
      loadContext={async () => ({
        timeZone: "Europe/Madrid",
        calendars: [],
        saveChats,
      })}
    />,
  );
  const say = (text: string) =>
    user.type(screen.getByLabelText("Tu pregunta"), `${text}{Enter}`);
  return { user, say };
}

describe("saved conversations", () => {
  it("saves nothing with the switch off (plan D3)", async () => {
    fetchMock.mockResolvedValue(answer("Mañana tienes PIAE."));
    const { say } = setup(false);
    await say("¿Qué tengo mañana?");
    await screen.findByText("Mañana tienes PIAE.");
    expect(conversations.saveConversation).not.toHaveBeenCalled();
  });

  it("saves after each answer with the switch on, under one id (RF-9)", async () => {
    fetchMock
      .mockResolvedValueOnce(answer("Mañana tienes PIAE."))
      .mockResolvedValueOnce(answer("Y el viernes, cine."));
    const { say } = setup(true);
    // The context arrives once the chat is painted.
    await waitFor(() =>
      expect(screen.getByLabelText("Tu pregunta")).toBeEnabled(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await say("¿Qué tengo mañana?");
    await screen.findByText("Mañana tienes PIAE.");
    await say("¿Y el viernes?");
    await screen.findByText("Y el viernes, cine.");
    const calls = conversations.saveConversation.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0]![0]).toBe(calls[1]![0]);
    expect(calls[1]![1]).toHaveLength(4);
  });

  it("opens a saved one: waiting cards come back expired (RF-11)", async () => {
    conversations.loadConversation.mockResolvedValue({
      ok: true,
      messages: [
        { role: "user", content: "Borra la cena", imageCount: 1 },
        {
          role: "assistant",
          content: "Revisa y pulsa Borrar.",
          actions: [
            {
              action: {
                kind: "delete",
                key: "d1",
                event,
                scope: null,
                remove: { id: event.id, scope: null, updatedAt: "u" },
              },
              status: "expired",
            },
          ],
        },
      ],
    });
    const { user } = setup(true);
    await user.click(
      screen.getByRole("button", { name: "Más opciones del chat" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Opciones del chat",
    });
    await user.click(
      await within(dialog).findByRole("button", { name: /^Borra la cena/ }),
    );
    const log = screen.getByRole("log");
    expect(await within(log).findByText("Caducada")).toBeInTheDocument();
    expect(within(log).getByText("1 imagen adjunta")).toBeInTheDocument();
    expect(within(log).queryByRole("button", { name: "Borrar" })).toBeNull();
  });
});

describe("reading answers aloud", () => {
  function fakeSpeech() {
    const spoken: string[] = [];
    const speechSynthesis = {
      speak: vi.fn((utterance: { text: string }) =>
        spoken.push(utterance.text),
      ),
      cancel: vi.fn(),
      getVoices: () => [{ lang: "es-ES", name: "Lucía" }],
    };
    class Utterance {
      lang = "";
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("speechSynthesis", speechSynthesis);
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    return { spoken, speechSynthesis };
  }

  it("reads nothing unless turned on (RF-14)", async () => {
    const { spoken } = fakeSpeech();
    fetchMock.mockResolvedValue(answer("Mañana tienes PIAE."));
    const { say } = setup(false);
    await say("¿Qué tengo mañana?");
    await screen.findByText("Mañana tienes PIAE.");
    expect(spoken).toEqual([]);
  });

  it("reads the answer once on, and stops it (RF-14)", async () => {
    const { spoken, speechSynthesis } = fakeSpeech();
    setSpeakAnswers(true);
    fetchMock.mockResolvedValue(answer("Mañana tienes PIAE."));
    const { say, user } = setup(false);
    await say("¿Qué tengo mañana?");
    await screen.findByText("Mañana tienes PIAE.");
    expect(spoken).toEqual(["Mañana tienes PIAE."]);
    await user.click(screen.getByRole("button", { name: "Parar la lectura" }));
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Parar la lectura" }),
    ).toBeNull();
  });
});
