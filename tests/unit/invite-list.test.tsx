import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InviteList, type InviteItem } from "@/components/sharing/invite-list";
import type { ConfirmState } from "@/lib/forms/form-state";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const NOW = "2026-10-22T12:00:00.000Z";
const DAY = 86_400_000;

function invite(overrides: Partial<InviteItem> & { id: string }): InviteItem {
  return {
    role: "viewer",
    maxUses: 5,
    useCount: 0,
    expiresAt: new Date(Date.parse(NOW) + 7 * DAY).toISOString(),
    ...overrides,
  };
}

function setup(invites: InviteItem[]) {
  const revoke = vi.fn<(id: string) => Promise<ConfirmState>>(async () => ({}));
  render(<InviteList invites={invites} now={NOW} revokeAction={revoke} />);
  return { revoke };
}

describe("InviteList (RF-11, RF-12)", () => {
  it("shows role, remaining uses and expiry of each invite (RF-11)", () => {
    setup([
      invite({ id: "a", role: "editor", maxUses: 5, useCount: 2 }),
      invite({
        id: "b",
        role: "viewer",
        maxUses: 1,
        expiresAt: new Date(Date.parse(NOW) + 2 * DAY - 1000).toISOString(),
      }),
    ]);

    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Editor");
    expect(first).toHaveTextContent("Usos restantes: 3 de 5");
    expect(first).toHaveTextContent("Caduca en 7 días");
    expect(second).toHaveTextContent("Lector");
    expect(second).toHaveTextContent("Usos restantes: 1 de 1");
    expect(second).toHaveTextContent("Caduca en 2 días");
  });

  it("shows only valid invites: not expired and with uses left", () => {
    setup([
      invite({ id: "ok" }),
      invite({
        id: "expired",
        expiresAt: new Date(Date.parse(NOW) - 1).toISOString(),
      }),
      invite({ id: "spent", maxUses: 2, useCount: 2 }),
    ]);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("says so when there are no valid invites", () => {
    setup([invite({ id: "spent", maxUses: 1, useCount: 1 })]);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.getByText("No hay invitaciones vigentes."),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before revoking (RF-12)", async () => {
    const { revoke } = setup([invite({ id: "inv-1", role: "editor" })]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Revocar/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Quienes ya se unieron");
    expect(revoke).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "Sí, revocar" }),
    );

    expect(revoke).toHaveBeenCalledTimes(1);
    // useActionState also passes the previous state and the form data.
    expect(revoke.mock.calls[0]?.[0]).toBe("inv-1");
  });
});
