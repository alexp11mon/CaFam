import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import {
  CalendarLink,
  CalendarNavContext,
} from "@/components/calendar/calendar-nav";

// Spec 024, T4 (RF-2, RF-7, plan D6).
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    transitionTypes,
    ...props
  }: ComponentProps<"a"> & {
    prefetch?: boolean;
    transitionTypes?: string[];
  }) => (
    <a
      {...props}
      data-prefetch={String(prefetch)}
      data-transition-types={transitionTypes?.join(" ")}
    />
  ),
}));

describe("CalendarLink", () => {
  it("moves in the browser inside the calendar, keeping its address", () => {
    const go = vi.fn();
    render(
      <CalendarNavContext value={go}>
        <CalendarLink view="day" date="2026-11-20" types={["cal-view"]}>
          20
        </CalendarLink>
      </CalendarNavContext>,
    );
    const link = screen.getByRole("link", { name: "20" });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/calendar?view=day&date=2026-11-20",
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(go).toHaveBeenCalledWith("day", "2026-11-20", ["cal-view"]);
  });

  it("leaves a click with Ctrl, ⌘ or Shift to the browser", () => {
    const go = vi.fn();
    render(
      <CalendarNavContext value={go}>
        <CalendarLink view="month" date="2026-12-01">
          dic
        </CalendarLink>
      </CalendarNavContext>,
    );
    const link = screen.getByRole("link", { name: "dic" });
    // jsdom would try to navigate: stop it after the handler has decided.
    link.addEventListener("click", (event) => event.preventDefault());

    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { shiftKey: true });

    expect(go).not.toHaveBeenCalled();
  });

  it("runs the caller's onClick first and respects its preventDefault", () => {
    const go = vi.fn();
    const onClick = vi.fn();
    render(
      <CalendarNavContext value={go}>
        <CalendarLink view="week" date="2026-11-16" onClick={onClick}>
          Semana
        </CalendarLink>
      </CalendarNavContext>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Semana" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledOnce();
  });

  it("is a plain link that never prefetches outside the calendar", () => {
    render(
      <CalendarLink view="day" date="2026-11-20" types={["cal-view"]}>
        20
      </CalendarLink>,
    );
    const link = screen.getByRole("link", { name: "20" });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/calendar?view=day&date=2026-11-20",
    );
    expect(link).toHaveAttribute("data-prefetch", "false");
    expect(link).toHaveAttribute("data-transition-types", "cal-view");
  });
});
