import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

// Spec 023, T11: the pages of Next were in English, without the brand or a
// way out (RF-16, RF-17).
describe("not-found", () => {
  it("says it in Spanish and leads back to the calendar", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esta página",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir al calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
  });
});

describe("error", () => {
  it("offers to retry and a way out", async () => {
    const retry = vi.fn();
    render(<ErrorPage retry={retry} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Algo ha fallado" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Ir al calendario" }),
    ).toHaveAttribute("href", "/dashboard/calendar");
  });
});
