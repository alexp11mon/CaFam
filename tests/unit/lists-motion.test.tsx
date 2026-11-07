import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CitedEvents } from "@/components/assistant/cited-events";
import { StaggerList } from "@/components/ui/stagger-list";

// Spec 021, T6: lists stagger their rows and details settle a beat later
// (RF-16..RF-19, plan "lists" and "settle-details").
const source = (file: string) =>
  readFileSync(join(process.cwd(), "src/components", file), "utf8");

describe("StaggerList", () => {
  it("staggers while it enters and stops at 400 ms", () => {
    vi.useFakeTimers();
    try {
      render(
        <StaggerList aria-label="Lista">
          <li>Uno</li>
        </StaggerList>,
      );
      const list = screen.getByRole("list", { name: "Lista" });
      expect(list).toHaveClass("stagger");
      expect(list).toHaveAttribute("data-entering");
      act(() => vi.advanceTimersByTime(400));
      expect(list).not.toHaveAttribute("data-entering");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("staggered lists (RF-16)", () => {
  it.each([
    "dashboard/calendar-list.tsx",
    "sharing/member-list.tsx",
    "connections/connection-list.tsx",
    "comments/event-comments.tsx",
    "assistant/cited-events.tsx",
  ])("%s renders a StaggerList", (file) => {
    expect(source(file)).toMatch(/<StaggerList\b/);
  });

  it("the calendar picker staggers while it enters", () => {
    const code = source("connections/calendar-picker.tsx");
    expect(code).toMatch(/useEnterOnce\(\)/);
    expect(code).toMatch(/className="stagger /);
  });

  it.each([
    "calendar/event-menu.tsx",
    "ui/time-field.tsx",
    "shell/nav-drawer.tsx",
    "shell/more-sheet.tsx",
  ])("%s staggers each time it opens", (file) => {
    const code = source(file);
    expect(code).toMatch(/data-entering=""/);
    expect(code).toMatch(/\bstagger\b/);
  });

  it("no calendar view staggers (RF-16, out of scope)", () => {
    const views = readdirSync(join(process.cwd(), "src/components/calendar"))
      .filter(
        (f) => /-(view|grid|layer)\.tsx$/.test(f) || f === "event-block.tsx",
      )
      .map((f) => source(`calendar/${f}`));
    expect(views.length).toBeGreaterThan(4);
    for (const code of views) expect(code).not.toMatch(/\bstagger\b/);
  });
});

describe("settling details (RF-19)", () => {
  it.each([
    ["ui/toast.tsx", /press settle /],
    ["calendar/quick-create.tsx", /className="settle /],
    ["calendar/event-card.tsx", /className="settle /],
  ])("%s lands its secondary detail later", (file, pattern) => {
    expect(source(file)).toMatch(pattern);
  });

  it("the cited events settle under the answer", () => {
    render(
      <CitedEvents
        timeZone="Europe/Madrid"
        events={[
          {
            id: "e1",
            title: "Cena",
            startsAt: "2026-11-03T19:00:00.000Z",
            endsAt: "2026-11-03T20:00:00.000Z",
            allDay: false,
            color: "#FFADAD",
            calendarName: "Familia",
          },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Eventos citados" });
    expect(list).toHaveClass("settle", "stagger");
  });
});
