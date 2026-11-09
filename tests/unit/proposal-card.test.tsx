import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatProposal } from "@/components/assistant/assistant-chat";
import type { ProposalRow } from "@/lib/assistant/schemas";

// Spec 022, T9: the proposal card (RF-15, RF-31, RF-32, RF-34, RF-35, RF-38,
// RF-41, RF-42, RF-45 to RF-48; plan R5).
const actions = vi.hoisted(() => ({
  checkProposal: vi.fn(),
  createProposedEvents: vi.fn(),
}));
vi.mock("@/app/dashboard/assistant/actions", () => actions);

const { ProposalCard } = await import("@/components/assistant/proposal-card");

const WORK = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const HOME = "0c2d9a1b-1111-4c1e-9a43-2b7d7a1f0c22";
const CALENDARS = [
  { id: WORK, name: "Trabajo" },
  { id: HOME, name: "Casa" },
];

function row(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    key: "r1",
    title: "Turno",
    startDate: "2026-11-16",
    start: "08:00",
    endDate: "2026-11-16",
    end: "15:00",
    allDay: false,
    calendarId: WORK,
    selected: true,
    duplicate: false,
    ...over,
  };
}

function proposal(rows: ProposalRow[], over: Partial<ChatProposal> = {}) {
  return { id: "p1", omitted: 0, rows, status: "pending", ...over } as const;
}

// What the card last handed to the chat (it owns no rows).
const seen: { latest?: ChatProposal } = {};
function Harness({ initial }: { initial: ChatProposal }) {
  const [value, setValue] = useState(initial);
  return (
    <ProposalCard
      proposal={value}
      calendars={CALENDARS}
      onChange={(next) => {
        seen.latest = next;
        setValue(next);
      }}
    />
  );
}

const rowGroup = (name: string) => screen.getByRole("group", { name });

beforeEach(() => {
  vi.clearAllMocks();
  actions.checkProposal.mockImplementation(async (rows: ProposalRow[]) => ({
    rows,
    errors: {},
  }));
});

describe("ProposalCard", () => {
  it("shows every row with its editable fields (RF-15, RF-31)", () => {
    render(
      <Harness
        initial={proposal([
          row(),
          row({
            key: "r2",
            title: "Libre",
            allDay: true,
            start: null,
            end: null,
          }),
        ])}
      />,
    );
    const first = rowGroup("Evento 1");
    expect(
      within(first).getByRole("checkbox", { name: "Crear este evento" }),
    ).toBeChecked();
    expect(within(first).getByLabelText("Título")).toHaveValue("Turno");
    expect(within(first).getByLabelText("Fecha de inicio")).toHaveValue(
      "2026-11-16",
    );
    expect(within(first).getByLabelText("Hora de inicio")).toHaveValue("08:00");
    expect(within(first).getByLabelText("Hora de fin")).toHaveValue("15:00");
    expect(
      within(first).getByRole("checkbox", { name: "Todo el día" }),
    ).not.toBeChecked();
    expect(within(first).getByLabelText("Calendario")).toHaveValue(WORK);
    const second = rowGroup("Evento 2");
    expect(
      within(second).queryByLabelText("Hora de inicio"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear 2 eventos" }),
    ).toBeEnabled();
  });

  it("edits a row and checks duplicates again (RF-31, RF-37, RF-39)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    actions.checkProposal.mockImplementation(async (rows: ProposalRow[]) => ({
      rows: rows.map((r) => ({ ...r, duplicate: true, selected: false })),
      errors: {},
    }));
    render(<Harness initial={proposal([row()])} />);
    const group = rowGroup("Evento 1");
    await user.selectOptions(within(group).getByLabelText("Calendario"), HOME);
    expect(seen.latest!.rows[0]!.calendarId).toBe(HOME);
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(actions.checkProposal).toHaveBeenCalledTimes(1);
    expect(
      await within(group).findByText("Ya existe un evento a esta hora"),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("checkbox", { name: "Crear este evento" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Crear 0 eventos" }),
    ).toBeDisabled();
    vi.useRealTimers();
  });

  it("marks a wrong row and blocks Crear while it is selected (RF-35, RF-42)", async () => {
    const user = userEvent.setup();
    render(<Harness initial={proposal([row({ end: "07:00" })])} />);
    const group = rowGroup("Evento 1");
    const message = within(group).getByText(
      "El fin tiene que ser posterior al inicio.",
    );
    expect(group).toHaveAttribute("aria-describedby", message.id);
    expect(
      screen.getByRole("button", { name: "Crear 1 evento" }),
    ).toBeDisabled();
    await user.click(
      within(group).getByRole("checkbox", { name: "Crear este evento" }),
    );
    expect(
      screen.getByRole("button", { name: "Crear 0 eventos" }),
    ).toBeDisabled();
  });

  it("creates a selected duplicate once, with progress and links (RF-38, RF-45, RF-47, RF-48, R5)", async () => {
    const user = userEvent.setup();
    let finish!: (value: unknown) => void;
    actions.createProposedEvents.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    render(
      <Harness
        initial={proposal([
          row({ duplicate: true, selected: false }),
          row({ key: "r2", title: "Tarde" }),
        ])}
      />,
    );
    await user.click(
      within(rowGroup("Evento 1")).getByRole("checkbox", {
        name: "Crear este evento",
      }),
    );
    const create = screen.getByRole("button", { name: "Crear 2 eventos" });
    await user.dblClick(create);
    expect(actions.createProposedEvents).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Creando 2 eventos…");
    expect(create).toBeDisabled();
    await act(async () =>
      finish({
        results: [
          { key: "r1", ok: true, id: "e1" },
          { key: "r2", ok: true, id: "e2" },
        ],
      }),
    );
    expect(screen.getByText("Creada")).toBeInTheDocument();
    expect(screen.getByText("Se han creado 2 eventos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Turno/ })).toHaveAttribute(
      "href",
      "/dashboard/events/e1",
    );
    expect(
      screen.queryByRole("button", { name: /^Crear/ }),
    ).not.toBeInTheDocument();
    expect(seen.latest!.status).toBe("created");
  });

  it("keeps the failed rows to retry (RF-46)", async () => {
    const user = userEvent.setup();
    actions.createProposedEvents.mockResolvedValueOnce({
      results: [
        { key: "r1", ok: true, id: "e1" },
        { key: "r2", ok: false, error: "No tienes permiso para hacer esto." },
      ],
    });
    render(
      <Harness
        initial={proposal([row(), row({ key: "r2", title: "Tarde" })])}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Crear 2 eventos" }));
    expect(
      await screen.findByText("Se ha creado 1 evento."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Evento 2" }),
    ).not.toBeInTheDocument();
    const left = rowGroup("Evento 1");
    expect(within(left).getByLabelText("Título")).toHaveValue("Tarde");
    expect(
      within(left).getByText("No tienes permiso para hacer esto."),
    ).toBeInTheDocument();
    expect(seen.latest!.status).toBe("pending");
    expect(seen.latest!.rows.map((r) => r.key)).toEqual(["r2"]);

    actions.createProposedEvents.mockResolvedValueOnce({
      results: [{ key: "r2", ok: true, id: "e2" }],
    });
    await user.click(screen.getByRole("button", { name: "Crear 1 evento" }));
    expect(actions.createProposedEvents.mock.calls[1]![0]).toHaveLength(1);
    expect(await screen.findByText("Creada")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows a replaced proposal without Crear (RF-34)", () => {
    render(<Harness initial={proposal([row()], { status: "superseded" })} />);
    expect(screen.getByText("Sustituida")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Crear/ }),
    ).not.toBeInTheDocument();
    expect(
      within(rowGroup("Evento 1")).getByLabelText("Título"),
    ).toBeDisabled();
  });
});
