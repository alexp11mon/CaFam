import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CalendarHeaderProvider,
  usePublishCalendarHeader,
} from "@/components/shell/calendar-header";
import { TopBar } from "@/components/shell/top-bar";

// Spec 016, T5: the phone header (RF-6, RF-8..RF-12).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/settings" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/app/dashboard/settings/actions", () => ({
  setTheme: vi.fn(async () => ({})),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function Calendar({ onToday }: { onToday: () => void }) {
  usePublishCalendarHeader({
    title: "octubre",
    today: "2026-10-30",
    onToday,
    picker: "months",
  });
  return null;
}

function renderBar(children?: ReactNode) {
  render(
    <CalendarHeaderProvider>
      <TopBar displayName="Ana López" signOutAction={vi.fn(async () => {})} />
      {children}
    </CalendarHeaderProvider>,
  );
}

describe("TopBar", () => {
  it("names the section and links the avatar to the settings outside the calendar", () => {
    navigation.pathname = "/dashboard/settings";
    renderBar();

    expect(screen.getByRole("banner")).toHaveTextContent("Ajustes");
    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ajustes de Ana López" }),
    ).toHaveAttribute("href", "/dashboard/settings");
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Hoy/ })).toBeNull();
  });

  it("shows the calendar's month, unfolds its picker and goes to today", async () => {
    navigation.pathname = "/dashboard/calendar";
    const onToday = vi.fn();
    renderBar(<Calendar onToday={onToday} />);

    const title = await screen.findByRole("button", { name: "octubre" });
    expect(title).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(title);
    expect(title).toHaveAttribute("aria-expanded", "true");

    const today = screen.getByRole("button", { name: /^Hoy, viernes, 30/ });
    expect(today).toHaveTextContent("30");
    await userEvent.click(today);
    expect(onToday).toHaveBeenCalledOnce();
  });
});
