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
import { ChangesSheet } from "@/components/offline/changes-sheet";
import { ToastProvider } from "@/components/ui/toast";
import type { EventData } from "@/lib/calendar/schemas";
import { conflictRows, versionRows } from "@/lib/offline/changes";
import { resetConnection } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import {
  addChange,
  addConflict,
  addRejected,
  clearQueue,
  setHeld,
  getQueueState,
  loadQueue,
} from "@/lib/offline/queue-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T11: the conflicts and the refused changes (RF-48, RF-50 to
// RF-53, RF-55, RF-57 to RF-59).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const server = vi.hoisted(() => ({
  applyOfflineChange: vi.fn(),
  loadOfflineSnapshot: vi.fn(),
}));
vi.mock("@/app/dashboard/offline-actions", () => server);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

const BASE: EventData = {
  title: "Cena",
  calendarId: "c1",
  allDay: false,
  startsAt: "2026-11-20T19:00:00Z",
  endsAt: "2026-11-20T20:00:00Z",
  description: null,
  location: "Casa",
  color: null,
  categoryId: null,
};
const MINE = { ...BASE, location: "Restaurante" };
const THEIRS = { ...BASE, location: "Casa de Luis" };
const UPDATE = {
  type: "event.update",
  id: "e1",
  base: BASE,
  data: MINE,
} as const;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  db.forgetConnection();
  await clearQueue();
  server.applyOfflineChange.mockResolvedValue({ status: "applied" });
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <ToastProvider>
      <ChangesSheet open onClose={() => {}} />
    </ToastProvider>,
  );

describe("ChangesSheet", () => {
  it("shows both versions and keeps mine with force (RF-50, RF-58)", async () => {
    await addConflict({ changeId: "k1", change: UPDATE, server: THEIRS });
    mount();
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Evento cambiado: Cena");
    expect(item).toHaveTextContent("Restaurante");
    expect(item).toHaveTextContent("Casa de Luis");
    await userEvent.click(
      within(item).getByRole("button", { name: "Conservar la mía" }),
    );
    expect(server.applyOfflineChange).toHaveBeenCalledWith(UPDATE, {
      force: true,
    });
    await waitFor(() => expect(getQueueState().conflicts).toEqual([]));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps theirs without sending anything (RF-59)", async () => {
    await addConflict({ changeId: "k1", change: UPDATE, server: THEIRS });
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Conservar la suya" }),
    );
    await waitFor(() => expect(getQueueState().conflicts).toEqual([]));
    expect(server.applyOfflineChange).not.toHaveBeenCalled();
  });

  it("creates it again when another person deleted it (RF-51)", async () => {
    await addConflict({ changeId: "k1", change: UPDATE, server: null });
    mount();
    expect(screen.getByText("Otra persona lo ha borrado.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar mi cambio" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Volver a crearlo" }),
    );
    expect(server.applyOfflineChange).toHaveBeenCalledWith(
      { type: "event.create", id: "e1", data: MINE },
      { force: true },
    );
  });

  it("asks before deleting what another person changed (RF-52)", async () => {
    await addConflict({
      changeId: "k1",
      change: { type: "event.delete", id: "e1", base: BASE },
      server: THEIRS,
    });
    mount();
    expect(
      screen.getByRole("button", { name: "Borrarlo igualmente" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Conservar el suyo" }),
    );
    await waitFor(() => expect(getQueueState().conflicts).toEqual([]));
  });

  it("asks about the same item of a list like an event (RF-55)", async () => {
    await addConflict({
      changeId: "k1",
      change: {
        type: "item.update",
        noteId: "n1",
        id: "i1",
        base: { text: "Pan", done: false },
        change: { done: true },
      },
      server: { text: "Pan integral", done: false, position: 0 },
    });
    mount();
    expect(screen.getByRole("listitem")).toHaveTextContent("Pan integral");
    expect(
      screen.getByRole("button", { name: "Conservar la mía" }),
    ).toBeInTheDocument();
  });

  it("lists a refused change readable, with its reason, and discards it (RF-48)", async () => {
    await addRejected({
      changeId: "r1",
      change: { type: "event.create", id: "e2", data: MINE },
      reason: "Ya no tienes permiso en este calendario.",
    });
    mount();
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Evento nuevo: Cena");
    expect(item).toHaveTextContent("Ya no tienes permiso en este calendario.");
    expect(item).toHaveTextContent("Restaurante");
    expect(item).toHaveTextContent("20 nov 2026");
    await userEvent.click(
      within(item).getByRole("button", { name: "Descartar" }),
    );
    await waitFor(() => expect(getQueueState().rejected).toEqual([]));
  });

  it("keeps conflicts after closing the app (RF-57)", async () => {
    await addConflict({ changeId: "k1", change: UPDATE, server: THEIRS });
    expect((await db.loadState()).conflicts).toHaveLength(1);
    await loadQueue();
    expect(getQueueState().conflicts).toHaveLength(1);
  });
});

// Spec 035 T11: series, comments, images and held accounts (RF-7, RF-14,
// RF-15, RF-21, RF-27, RF-40).
describe("ChangesSheet, spec 035", () => {
  it("shows a series in conflict with how it repeats now and what would be lost", async () => {
    await addConflict({
      changeId: "k1",
      change: {
        type: "series.update",
        id: "s1",
        scope: "all",
        base: { fields: BASE },
        data: MINE,
        repeat: "none",
      } as never,
      server: {
        ...THEIRS,
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        loss: { exceptions: 2, images: 1, comments: 3 },
      },
    });
    mount();
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Serie cambiada: Cena");
    expect(item).toHaveTextContent("Restaurante");
    expect(item).toHaveTextContent("Casa de Luis");
    expect(item).toHaveTextContent(/Ahora se repite: .*lunes/i);
    expect(item).toHaveTextContent(
      "Se perderán 2 cambios, 1 imagen y 3 comentarios.",
    );
    expect(
      within(item).getByRole("button", { name: "Conservar la mía" }),
    ).toBeInTheDocument();
  });

  it("keeps the text of a refused comment to copy it (RF-21, RF-27)", async () => {
    await addRejected({
      changeId: "r1",
      change: {
        type: "comment.update",
        id: "c1",
        eventId: "e1",
        base: { body: "Antes" },
        body: "Llevo el postre",
      },
      reason: "Este comentario ya no existe.",
    });
    mount();
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Este comentario ya no existe.");
    expect(within(item).getByText("Llevo el postre")).toBeVisible();
  });

  it("offers Descargar for a refused image and discards its bytes (RF-40)", async () => {
    await db.savePendingImage({
      localId: "l1",
      eventId: "e1",
      full: new Blob(["full"], { type: "image/jpeg" }),
      thumb: new Blob(["thumb"], { type: "image/jpeg" }),
      width: 10,
      height: 10,
      bytes: 9,
      reservedId: null,
    });
    await addRejected({
      changeId: "r1",
      change: { type: "image.add", eventId: "e1", localId: "l1" },
      reason: "Este evento ya tiene 10 imágenes.",
    });
    URL.createObjectURL = vi.fn(() => "blob:imagen");
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(async () =>
      expect(await db.getPendingImage("l1")).toBeUndefined(),
    );
    click.mockRestore();
  });

  it("names the changes of an account to connect again, with Volver a conectar (RF-7)", async () => {
    const changeId = await addChange({
      type: "event.create",
      id: "e3",
      data: MINE,
    });
    setHeld([{ changeId, connectionId: "conn-1" }]);
    mount();
    expect(
      screen.getByText(/necesita volver a conectarse/),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento nuevo: Cena")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a conectar" }),
    ).toHaveAttribute("href", "/dashboard/connections/conn-1");
  });

  it("says the account must be connected when keeping mine is held", async () => {
    server.applyOfflineChange.mockResolvedValue({
      status: "held",
      connectionId: "conn-1",
    });
    await addConflict({ changeId: "k1", change: UPDATE, server: THEIRS });
    mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Conservar la mía" }),
    );
    expect(
      await screen.findByText(/necesita volver a conectarse/),
    ).toBeInTheDocument();
    expect(getQueueState().conflicts).toHaveLength(1);
  });
});

describe("versionRows", () => {
  it("shows only what differs between the two versions", () => {
    expect(versionRows(MINE, THEIRS, "Europe/Madrid")).toEqual([
      { label: "Lugar", mine: "Restaurante", theirs: "Casa de Luis" },
    ]);
  });
});

describe("conflictRows", () => {
  it("shows what the other person changed in what the user deleted (RF-52)", () => {
    expect(
      conflictRows(
        { type: "event.delete", id: "e1", base: BASE },
        THEIRS,
        "Europe/Madrid",
      ),
    ).toEqual([{ label: "Lugar", mine: "Borrado", theirs: "Casa de Luis" }]);
  });

  it("compares the user's version with theirs otherwise", () => {
    expect(conflictRows(UPDATE, THEIRS, "Europe/Madrid")).toEqual(
      versionRows(MINE, THEIRS, "Europe/Madrid"),
    );
  });
});
