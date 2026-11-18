import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "@/components/shell/top-nav";

// Spec 039 (RF-1): the search from 769 px, in the top navigation.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/calendar",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/app/dashboard/settings/actions", () => ({
  setTheme: vi.fn(async () => ({})),
}));

describe("TopNav", () => {
  it("links to the search with its key", () => {
    render(<TopNav displayName="Ana" signOutAction={vi.fn(async () => {})} />);
    const link = screen.getByRole("link", { name: "Buscar" });
    expect(link).toHaveAttribute("href", "/dashboard/search");
    expect(link).toHaveAttribute("aria-keyshortcuts", "/");
  });
});
