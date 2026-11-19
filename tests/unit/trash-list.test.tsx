import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  groupTrash,
  type TrashCalendar,
  type TrashEntry,
} from "@/lib/calendar/trash";

// Spec 046, T4: the trash of each calendar (RF-3, RF-4, RF-6).
const h = vi.hoisted(() => ({ empty: vi.fn(), refresh: vi.fn() }));

vi.mock("@/app/dashboard/trash/actions", () => ({
  restoreFromTrash: vi.fn(),
  purgeFromTrash: vi.fn(),
  emptyTrash: h.empty,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show() {} }) }));

const { TrashList } = await import("@/components/trash/trash-list");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const CALENDARS: TrashCalendar[] = [
  { id: "c1", name: "Familia", color: "#A0C4FF", isOwner: true },
  { id: "c2", name: "Trabajo", color: "#FFADAD", isOwner: false },
  { id: "c3", name: "Sin nada", color: "#CAFFBF", isOwner: true },
];

function entry(id: string, calendarId: string, createdAt: string): TrashEntry {
  return {
    id,
    calendarId,
    kind: "event",
    title: `Evento ${id}`,
    startsAt: "2026-11-20T09:00:00Z",
    endsAt: "2026-11-20T10:00:00Z",
    allDay: false,
    occurrences: null,
    images: 0,
    comments: 0,
    deletedByName: "Ana",
    createdAt,
    expiresAt: "2026-12-17T08:00:00Z",
  };
}

const ENTRIES = [
  entry("a", "c2", "2026-11-18T08:00:00Z"),
  entry("b", "c1", "2026-11-10T08:00:00Z"),
  entry("c", "c1", "2026-11-18T09:00:00Z"),
  // A calendar where I am no longer an editor: not shown (RF-10).
  entry("d", "c9", "2026-11-18T09:00:00Z"),
];

function setup(entries: TrashEntry[] = ENTRIES) {
  render(
    <TrashList
      entries={entries}
      calendars={CALENDARS}
      timeZone="Europe/Madrid"
      readAt="2026-11-19T12:00:00Z"
    />,
  );
}

describe("groupTrash", () => {
  it("groups by calendar in their order, newest first, without empty ones", () => {
    const groups = groupTrash(ENTRIES, CALENDARS);
    expect(
      groups.map((g) => [g.calendar.id, g.entries.map((e) => e.id)]),
    ).toEqual([
      ["c1", ["c", "b"]],
      ["c2", ["a"]],
    ]);
  });
});

describe("TrashList", () => {
  it("one section per calendar with its entries (RF-3)", () => {
    setup();
    const familia = screen.getByRole("region", { name: "Familia" });
    expect(within(familia).getAllByRole("listitem")).toHaveLength(2);
    expect(familia).toHaveAttribute("id", "papelera-c1");
    expect(screen.getByRole("region", { name: "Trabajo" })).toBeInTheDocument();
    expect(screen.queryByText("Evento d")).not.toBeInTheDocument();
  });

  it("only the owner empties the trash, after confirming (RF-6)", async () => {
    h.empty.mockResolvedValue({ done: "deleted" });
    setup();
    expect(
      screen.queryByRole("button", { name: "Vaciar la papelera de Trabajo" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Vaciar la papelera de Familia" }),
    );
    expect(screen.getByText(/2 eventos de «Familia»/)).toBeInTheDocument();
    expect(h.empty).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Vaciar la papelera" }),
    );
    expect(h.empty).toHaveBeenCalledWith("c1");
    expect(h.refresh).toHaveBeenCalled();
  });

  it("says so when there is nothing", () => {
    setup([]);
    expect(screen.getByText("La papelera está vacía")).toBeInTheDocument();
  });
});
