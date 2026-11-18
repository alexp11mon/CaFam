import { act, render, screen, waitFor } from "@testing-library/react";
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
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { SignOutGuard } from "@/components/offline/sign-out-guard";
import { resetConnection, startWatching } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import { addChange, clearQueue } from "@/lib/offline/queue-store";
import { SNAPSHOT_FORMAT, type Snapshot } from "@/lib/offline/snapshot";
import { getSnapshot, setSnapshot } from "@/lib/offline/snapshot-store";
import { memoryIndexedDb } from "./memory-indexeddb";

// Spec 034 T10: signing out or deleting the account leaves nothing of the
// user on the device (RF-60 to RF-62, RF-65, plan D12).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

const COPY = {
  format: SNAPSHOT_FORMAT,
  userId: "u1",
  savedAt: "2026-11-17T08:00:00Z",
  today: "2026-11-17",
  range: { from: "2026-10-17", to: "2027-02-17" },
  profile: { timeZone: "UTC" },
  calendars: [],
  events: [],
  notes: [],
} as unknown as Snapshot;

beforeEach(async () => {
  vi.stubGlobal("indexedDB", memoryIndexedDb());
  db.forgetConnection();
  await clearQueue();
  await db.claimFor("u1");
  await setSnapshot(COPY, true);
});
afterEach(() => {
  resetConnection();
  vi.unstubAllGlobals();
});

const stored = async () => {
  const state = await db.loadState();
  return { snapshot: state.snapshot, queue: state.queue };
};

function mount(action = vi.fn(async () => {})) {
  render(
    <SignOutGuard action={action} className="row">
      Cerrar sesión
    </SignOutGuard>,
  );
  return action;
}

describe("SignOutGuard", () => {
  it("signs out at once with nothing waiting and empties the device (RF-60)", async () => {
    const action = mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(getSnapshot()).toBeNull();
    expect(await stored()).toEqual({ snapshot: null, queue: [] });
  });

  it("warns with the number of changes waiting and can be cancelled (RF-61)", async () => {
    await addChange({ type: "note.delete", id: "n1", base: {} as never });
    await addChange({ type: "note.delete", id: "n2", base: {} as never });
    const action = mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );
    expect(
      screen.getByText(
        "Tienes 2 cambios sin enviar. Si cierras sesión, se perderán.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(action).not.toHaveBeenCalled();
    expect((await stored()).queue).toHaveLength(2);
  });

  it("deletes the waiting changes too when confirmed (RF-62)", async () => {
    await addChange({ type: "note.delete", id: "n1", base: {} as never });
    const action = mount();
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión igualmente" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(await stored()).toEqual({ snapshot: null, queue: [] });
  });

  it("is disabled without a connection, with its reason (D12)", async () => {
    startWatching();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    const action = mount();
    const button = screen.getByRole("button", { name: /Cerrar sesión/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Necesita conexión");
    expect(action).not.toHaveBeenCalled();
    expect((await stored()).snapshot).not.toBeNull();
  });
});

describe("DeleteAccountDialog", () => {
  it("empties the device before deleting the account (RF-65)", async () => {
    const action = vi.fn(async () => ({}));
    render(<DeleteAccountDialog action={action} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar mi cuenta" }),
    );
    await userEvent.type(screen.getByLabelText("Tu email"), "a@cafam.test");
    await userEvent.type(screen.getByLabelText("Tu contraseña"), "secreto12");
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar definitivamente" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(await stored()).toEqual({ snapshot: null, queue: [] });
  });
});
