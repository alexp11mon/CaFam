import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckEmail, RESEND_TEXTS } from "@/components/auth/check-email";
import { maskEmail, readPending } from "@/lib/auth/pending";

// Spec 049, T2: the screen after signing up (RF-1) and of a dead link (RF-2).
describe("CheckEmail", () => {
  it("says where the link went, resends it and lets the email change", async () => {
    const action = vi.fn(async () => ({ status: "sent" as const }));
    render(<CheckEmail email="a***@gmail.com" action={action} />);
    expect(
      screen.getByText(
        "Te hemos enviado un enlace a a***@gmail.com. Ábrelo para entrar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Cambiar de email" }),
    ).toHaveAttribute("href", "/signup");
    await userEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      RESEND_TEXTS.sent,
    );
  });

  it("asks for the address when the link failed on another device", () => {
    render(<CheckEmail email={null} expired action={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(RESEND_TEXTS.expired);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});

describe("pending sign-up", () => {
  it("masks the address", () => {
    expect(maskEmail("ana@gmail.com")).toBe("a***@gmail.com");
    expect(maskEmail("x")).toBe("***");
  });

  it("only keeps an invite as the next step", () => {
    expect(
      readPending(JSON.stringify({ email: "a@b.es", next: "https://evil" })),
    ).toEqual({ email: "a@b.es", next: "/dashboard" });
    expect(readPending("{bad")).toBeNull();
    expect(readPending(undefined)).toBeNull();
  });
});
