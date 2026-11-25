import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "@/components/notes/note-editor";
import { ToastProvider } from "@/components/ui/toast";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import { forgetConnection } from "@/lib/offline/db";
import { clearQueue, getQueueState } from "@/lib/offline/queue-store";
import type { Note } from "@/lib/notes/types";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T8: a list without a connection (RF-32, RF-33, RF-37).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/hooks/use-live-calendar", () => ({ useLiveCalendar: vi.fn() }));
const actions = vi.hoisted(() => ({
  addItem: vi.fn(),
  clearDone: vi.fn(),
  createNote: vi.fn(),
  deleteItem: vi.fn(),
  deleteNote: vi.fn(),
  moveItems: vi.fn(),
  updateItem: vi.fn(),
  updateNote: vi.fn(),
}));
vi.mock("@/app/dashboard/notes/actions", () => actions);

const NOTE: Note = {
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
  items: [{ id: "Pan", text: "Pan", done: false, doneAt: null, position: 0 }],
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  forgetConnection();
  await clearQueue();
  startWatching();
  window.dispatchEvent(new Event("offline"));
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

describe("NoteEditor offline", () => {
  it("ticks an item at once, queues it and marks the note as pending", async () => {
    render(
      <ToastProvider>
        <NoteEditor
          note={NOTE}
          access={{
            canWrite: true,
            canDelete: true,
            canMove: true,
            readOnlyReason: null,
          }}
          calendars={[]}
          today="2026-11-17"
          userId="me"
        />
      </ToastProvider>,
    );
    await act(async () => {
      await userEvent.click(screen.getByRole("checkbox", { name: "Pan" }));
    });
    expect(actions.updateItem).not.toHaveBeenCalled();
    expect(getQueueState().queue[0]?.change).toEqual({
      type: "item.update",
      noteId: NOTE.id,
      id: "Pan",
      base: { text: "Pan", done: false, dueDate: null, dueTime: null },
      change: { done: true },
    });
    expect(screen.getByText("Pendiente de enviar")).toBeVisible();
  });
});
