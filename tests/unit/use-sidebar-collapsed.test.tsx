import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setSidebarCollapsed,
  setSidebarPicker,
  useSidebar,
} from "@/lib/hooks/use-sidebar-collapsed";
import { ViewToolbar } from "@/components/calendar/view-toolbar";

// Spec 019, T12: the calendar's side panel folds on this device (RF-17, RF-19, RF-21, RF-22).
function Probe() {
  const { collapsed, pickerOpen } = useSidebar();
  return <p>{`${collapsed} ${pickerOpen}`}</p>;
}

afterEach(() => {
  act(() => {
    setSidebarCollapsed(false);
    setSidebarPicker(false);
  });
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useSidebar", () => {
  it("remembers the folded panel in this device", () => {
    render(<Probe />);
    expect(screen.getByText("false false")).toBeVisible();

    act(() => setSidebarCollapsed(true));
    expect(screen.getByText("true false")).toBeVisible();
    expect(localStorage.getItem("cafam-sidebar")).toBe("collapsed");

    act(() => setSidebarCollapsed(false));
    expect(localStorage.getItem("cafam-sidebar")).toBeNull();
  });

  it("reads what was saved", () => {
    localStorage.setItem("cafam-sidebar", "collapsed");
    act(() => setSidebarCollapsed(null));
    render(<Probe />);
    expect(screen.getByText("true false")).toBeVisible();
  });

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Probe />);
    act(() => setSidebarCollapsed(true));
    expect(screen.getByText("true false")).toBeVisible();
  });
});

describe("ViewToolbar fold button", () => {
  it("folds and unfolds the panel, saying which (RF-17, RF-22)", async () => {
    render(<ViewToolbar view="week" date="2026-11-04" today="2026-11-02" />);
    const fold = screen.getByRole("button", { name: "Plegar el panel" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(fold).toHaveAttribute("aria-controls", "calendar-side-panel");
    // From 1024 px only, where the panel is a side column.
    expect(fold).toHaveClass("hidden", "lg:inline-flex");

    await userEvent.click(fold);
    const unfold = screen.getByRole("button", { name: "Desplegar el panel" });
    expect(unfold).toHaveAttribute("aria-expanded", "false");
  });

  it("offers the mini month by the title only while folded (RF-19)", async () => {
    render(<ViewToolbar view="week" date="2026-11-04" today="2026-11-02" />);
    expect(screen.queryByRole("button", { name: "Elegir fecha" })).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Plegar el panel" }),
    );
    const pick = screen.getByRole("button", { name: "Elegir fecha" });
    expect(pick).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(pick);
    expect(pick).toHaveAttribute("aria-expanded", "true");
  });
});
