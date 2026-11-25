import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_TEXTS, GoogleButton } from "@/components/auth/google-button";

// Spec 050, T2: "Continuar con Google" (RF-1, RF-9), hidden until the
// provider is set up (spec "Riesgos").
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  search.value = "";
});

describe("GoogleButton", () => {
  it("is hidden without NEXT_PUBLIC_GOOGLE_LOGIN=1", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_LOGIN", "");
    const { container } = render(<GoogleButton action={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sends the next of the URL with the form", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_LOGIN", "1");
    search.value = "next=%2Finvite%2Fabc";
    render(<GoogleButton action={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Continuar con Google" });
    const form = button.closest("form")!;
    expect(new FormData(form).get("next")).toBe("/invite/abc");
  });

  it.each([
    ["cancelled", GOOGLE_TEXTS.cancelled],
    ["error", GOOGLE_TEXTS.error],
  ])("explains google=%s", (reason, text) => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_LOGIN", "1");
    search.value = `google=${reason}`;
    render(<GoogleButton action={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(text);
  });
});
