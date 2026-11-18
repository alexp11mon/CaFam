import { render, screen, waitFor, within } from "@testing-library/react";
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
import { OfflineComments } from "@/components/offline/offline-comments";
import { ToastProvider } from "@/components/ui/toast";
import { COMMENTS_PAGE } from "@/lib/comments/limits";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { forgetConnection } from "@/lib/offline/db";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { clearQueue, getQueueState } from "@/lib/offline/queue-store";
import type { OfflineComment, Snapshot } from "@/lib/offline/snapshot";
import { setSnapshot } from "@/lib/offline/snapshot-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 035 T10: "Comentarios" without a connection (RF-18 to RF-25).
vi.mock("@/app/dashboard/events/quick-actions", () => ({
  undoAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const EVENT = "ev-1";
const CAL = "cal-a";
const ME = "user-me";

const comment = (n: number, authorId = ME): OfflineComment => ({
  id: `c${n}`,
  eventId: EVENT,
  authorId,
  authorName: authorId === ME ? "Yo" : "Bea",
  body: `Comentario ${n}`,
  createdAt: `2026-11-01T10:${String(n).padStart(2, "0")}:00Z`,
  editedAt: null,
});

function copyWith(comments: OfflineComment[]) {
  return {
    userId: ME,
    profile: { displayName: "Yo" },
    calendars: [{ id: CAL, role: "editor" }],
    comments,
  } as unknown as Snapshot;
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(async () => {
  resetConnection();
  await setSnapshot(null);
  vi.unstubAllGlobals();
});

const changes = () => getQueueState().queue.map((entry) => entry.change);

async function setup(comments: OfflineComment[]) {
  await setSnapshot(copyWith(comments));
  render(
    <ToastProvider>
      <OfflineComments
        eventId={EVENT}
        calendarId={CAL}
        timeZone="Europe/Madrid"
      />
    </ToastProvider>,
  );
}

async function undoLast(text: string) {
  const toast = await screen.findByText(text);
  await userEvent.click(
    within(toast.closest("[data-toast]") ?? document.body).getByRole("button", {
      name: "Deshacer",
    }),
  );
}

describe("OfflineComments", () => {
  it("shows the saved ones, and Ver anteriores needs a connection", async () => {
    await setup(
      Array.from({ length: COMMENTS_PAGE }, (_, i) => comment(i + 1, "bea")),
    );
    expect(await screen.findByText("Comentario 1")).toBeVisible();
    const older = screen.getByRole("button", { name: "Ver anteriores" });
    expect(older).toBeDisabled();
    expect(older).toHaveAccessibleDescription(OFFLINE_MESSAGES.needsNetwork);
  });

  it("adds one as pending, and Deshacer takes it back", async () => {
    await setup([]);
    await userEvent.type(await screen.findByRole("textbox"), "Llevo el postre");
    await userEvent.click(screen.getByRole("button", { name: "Comentar" }));

    expect(await screen.findByText("Llevo el postre")).toBeVisible();
    expect(screen.getByText("Pendiente de enviar")).toBeVisible();
    expect(changes()).toMatchObject([
      { type: "comment.add", eventId: EVENT, body: "Llevo el postre" },
    ]);

    await undoLast("Comentario guardado");
    await waitFor(() => expect(changes()).toEqual([]));
    expect(screen.queryByText("Llevo el postre")).toBeNull();
  });

  it("edits and deletes one of mine into the queue", async () => {
    await setup([comment(1)]);
    await userEvent.click(
      await screen.findByRole("button", { name: /Editar/ }),
    );
    const box = screen.getByDisplayValue("Comentario 1");
    await userEvent.clear(box);
    await userEvent.type(box, "Mejor a las 9");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Mejor a las 9")).toBeVisible();
    expect(screen.getByText("Pendiente de enviar")).toBeVisible();
    expect(changes()).toMatchObject([
      {
        type: "comment.update",
        id: "c1",
        base: { body: "Comentario 1" },
        body: "Mejor a las 9",
      },
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Borrar/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Borrar comentario" }),
    );
    await waitFor(() =>
      expect(changes().map((change) => change.type)).toEqual([
        "comment.delete",
      ]),
    );
    expect(screen.queryByText("Mejor a las 9")).toBeNull();
  });
});
