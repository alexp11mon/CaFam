import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteJoinCard } from "@/components/sharing/invite-join-card";
import type { ConfirmState, FormAction } from "@/lib/forms/form-state";

const PREVIEW = {
  calendarName: "Familia",
  ownerName: "Marta",
  role: "editor" as const,
  alreadyMember: false,
};

function setup(
  preview: React.ComponentProps<typeof InviteJoinCard>["preview"],
  action: FormAction<ConfirmState> = vi.fn(async () => ({})),
) {
  render(<InviteJoinCard preview={preview} acceptAction={action} />);
  return action;
}

describe("InviteJoinCard (RF-5, RF-6, RF-8, RF-9)", () => {
  it("shows calendar, owner and role with a Unirme button (RF-5)", () => {
    setup(PREVIEW);

    expect(screen.getByText("Familia")).toBeInTheDocument();
    expect(screen.getByText("Marta")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unirme" })).toBeEnabled();
  });

  it("joins only when the button is pressed (RF-6)", async () => {
    const action = setup(PREVIEW);
    expect(action).not.toHaveBeenCalled();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Unirme" }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the action error and keeps the button (RF-8)", async () => {
    setup(
      PREVIEW,
      vi.fn(async () => ({ formError: "Esta invitación ya no es válida." })),
    );

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta invitación ya no es válida.",
    );
  });

  it("warns members and links to the calendar without a button (RF-9)", () => {
    setup({ ...PREVIEW, alreadyMember: true });

    expect(screen.getByText(/Ya eres miembro/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir al calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
    expect(
      screen.queryByRole("button", { name: "Unirme" }),
    ).not.toBeInTheDocument();
  });

  it("says the invite is not valid when there is no preview (RF-8)", () => {
    setup(null);

    expect(
      screen.getByText("Esta invitación ya no es válida."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unirme" }),
    ).not.toBeInTheDocument();
  });
});
