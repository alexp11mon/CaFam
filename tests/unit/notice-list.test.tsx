import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoticeList } from "@/components/account/notice-list";
import type { AccountNotice } from "@/lib/account/queries";
import type { ConfirmState } from "@/lib/forms/form-state";

// Spec 006, T21: the account notices in "Mis calendarios" (RF-23, RF-28, RF-29).
const NOTICES: AccountNotice[] = [
  {
    id: "n1",
    kind: "orphaned",
    personName: "Ana",
    calendarName: "Familia",
    createdAt: "2026-11-01T10:00:00Z",
  },
  {
    id: "n2",
    kind: "kept_copy",
    personName: "",
    calendarName: "Viajes",
    createdAt: "2026-11-02T10:00:00Z",
  },
  {
    id: "n3",
    kind: "deleted_calendar",
    personName: "",
    calendarName: "Cole",
    createdAt: "2026-11-03T10:00:00Z",
  },
];

describe("NoticeList (RF-23)", () => {
  it("names the person and the calendar of each notice", () => {
    render(<NoticeList notices={NOTICES} dismissAction={vi.fn()} />);

    expect(
      screen.getByText(/Ana ha eliminado su cuenta.*«Familia»/),
    ).toBeInTheDocument();
    expect(screen.getByText(/copia de «Viajes»/)).toBeInTheDocument();
    expect(screen.getByText(/«Cole» se ha eliminado/)).toBeInTheDocument();
  });

  it("closes a notice", async () => {
    const dismissAction = vi.fn<(noticeId: string) => Promise<ConfirmState>>(
      async () => ({}),
    );
    render(<NoticeList notices={NOTICES} dismissAction={dismissAction} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar aviso sobre «Familia»" }),
    );

    expect(dismissAction).toHaveBeenCalled();
    expect(dismissAction.mock.calls[0][0]).toBe("n1");
  });

  it("renders nothing without notices", () => {
    const { container } = render(
      <NoticeList notices={[]} dismissAction={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

// Spec 007, T10: sync notices (RF-31, RF-34).
describe("NoticeList: sync notices", () => {
  const SYNC: AccountNotice[] = [
    {
      id: "s1",
      kind: "sync_revoked",
      personName: "",
      calendarName: "ana@gmail.com",
      createdAt: "2026-11-04T10:00:00Z",
    },
    {
      id: "s2",
      kind: "sync_failing",
      personName: "",
      calendarName: "Trabajo",
      createdAt: "2026-11-05T10:00:00Z",
    },
  ];

  it("names the account or the calendar and offers to reconnect", () => {
    render(<NoticeList notices={SYNC} dismissAction={vi.fn()} />);

    expect(
      screen.getByText(/Google ha retirado el permiso.*ana@gmail\.com/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/«Trabajo» ha fallado 3 veces seguidas/),
    ).toBeInTheDocument();
    const reconnect = screen.getByRole("link", { name: "Volver a conectar" });
    expect(reconnect).toHaveAttribute(
      "href",
      "/dashboard/connections/new?provider=google",
    );
    expect(
      screen.getByRole("link", { name: "Ver cuentas conectadas" }),
    ).toHaveAttribute("href", "/dashboard/connections");
  });

  it("can be dismissed", async () => {
    const dismissAction = vi.fn<(noticeId: string) => Promise<ConfirmState>>(
      async () => ({}),
    );
    render(<NoticeList notices={SYNC} dismissAction={dismissAction} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar aviso sobre «Trabajo»" }),
    );

    expect(dismissAction.mock.calls[0][0]).toBe("s2");
  });
});
