import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrphanNotice } from "@/components/account/orphan-notice";
import { MemberList } from "@/components/sharing/member-list";

// Spec 006, T22: the members page of a calendar without owner says so, with the
// deadline, and nobody can change roles or expel (RF-22, RF-24).
describe("OrphanNotice (RF-22, RF-24)", () => {
  it("says the calendar has no owner and until when the members can decide", () => {
    render(
      <OrphanNotice
        deadline="2026-11-16T10:00:00.000Z"
        timeZone="Europe/Madrid"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Este calendario no tiene propietario. Sus miembros pueden decidir hasta el 16 de noviembre si lo conservan.",
    );
  });
});

describe("MemberList without owner (RF-22)", () => {
  it("shows no role or expel controls to anyone", () => {
    render(
      <MemberList
        members={[
          { userId: "u1", name: "Bea", role: "editor" },
          { userId: "u2", name: "Cy", role: "viewer" },
        ]}
        currentUserId="u1"
        changeRoleAction={vi.fn()}
        expelAction={vi.fn()}
        leaveAction={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Guardar rol/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Expulsar/ }),
    ).not.toBeInTheDocument();
  });
});
