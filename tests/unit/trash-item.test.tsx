import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletedText,
  kindText,
  remainingText,
  type TrashEntry,
} from "@/lib/calendar/trash";

// Spec 046, T4: one entry of the trash (RF-3, RF-5, RF-6).
const h = vi.hoisted(() => ({
  restore: vi.fn(),
  purge: vi.fn(),
  refresh: vi.fn(),
  show: vi.fn(),
}));

vi.mock("@/app/dashboard/trash/actions", () => ({
  restoreFromTrash: h.restore,
  purgeFromTrash: h.purge,
  emptyTrash: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: h.show }),
}));

const { TrashItem } = await import("@/components/trash/trash-item");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  h.restore.mockReset();
  h.purge.mockReset();
  h.refresh.mockReset();
  h.show.mockReset();
});

const NOW = new Date("2026-11-19T12:00:00Z");

const ENTRY: TrashEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  calendarId: "c1",
  kind: "event",
  title: "Dentista",
  startsAt: "2026-11-20T09:00:00Z",
  endsAt: "2026-11-20T10:00:00Z",
  allDay: false,
  occurrences: null,
  images: 0,
  comments: 0,
  deletedByName: "Ana",
  createdAt: "2026-11-17T08:00:00Z",
  expiresAt: "2026-12-17T08:00:00Z",
};

function setup(entry: TrashEntry = ENTRY) {
  render(
    <ul>
      <TrashItem entry={entry} timeZone="Europe/Madrid" now={NOW} />
    </ul>,
  );
}

describe("trash texts", () => {
  it("says who deleted it, when, and how long is left (RF-3)", () => {
    expect(deletedText(ENTRY, NOW)).toBe("Borrado por Ana hace 2 días");
    expect(
      deletedText(
        { ...ENTRY, deletedByName: null, createdAt: "2026-11-19T10:00:00Z" },
        NOW,
      ),
    ).toBe("Borrado por una cuenta borrada hoy");
    expect(remainingText(ENTRY.expiresAt, NOW)).toBe("Quedan 28 días");
    expect(remainingText("2026-11-19T20:00:00Z", NOW)).toBe(
      "Queda menos de 1 día",
    );
  });

  it("names a series with its occurrences, and an occurrence (RF-2)", () => {
    expect(kindText({ ...ENTRY, kind: "series", occurrences: 24 })).toBe(
      "serie, 24 repeticiones",
    );
    expect(kindText({ ...ENTRY, kind: "series", occurrences: null })).toBe(
      "serie",
    );
    expect(kindText({ ...ENTRY, kind: "occurrence" })).toBe(
      "repetición de una serie",
    );
    expect(kindText(ENTRY)).toBeNull();
  });
});

describe("TrashItem", () => {
  it("shows the event and restores it (RF-5)", async () => {
    h.restore.mockResolvedValue({ ok: true });
    setup();
    expect(screen.getByText("Dentista")).toBeInTheDocument();
    expect(screen.getByText(/Borrado por Ana hace 2 días/)).toBeInTheDocument();
    expect(screen.getByText("Quedan 28 días")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Restaurar «Dentista»" }),
    );
    expect(h.restore).toHaveBeenCalledWith(ENTRY.id);
    expect(h.show).toHaveBeenCalledWith("«Dentista» restaurado");
    expect(h.refresh).toHaveBeenCalled();
  });

  it("explains why it cannot restore, as a series that is gone (RF-5)", async () => {
    h.restore.mockResolvedValue({
      ok: false,
      error: "La serie de esta repetición ya no existe; no se puede restaurar.",
    });
    setup({ ...ENTRY, kind: "occurrence" });
    await userEvent.click(
      screen.getByRole("button", { name: "Restaurar «Dentista»" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La serie de esta repetición ya no existe",
    );
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("deletes for good only after confirming (RF-6)", async () => {
    h.purge.mockResolvedValue({ done: "deleted" });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar para siempre «Dentista»" }),
    );
    expect(h.purge).not.toHaveBeenCalled();
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar para siempre" }),
    );
    expect(h.purge).toHaveBeenCalledWith(ENTRY.id);
    expect(h.show).toHaveBeenCalledWith("«Dentista» borrado para siempre");
  });
});
