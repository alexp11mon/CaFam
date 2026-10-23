import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimeGrid } from "@/components/calendar/time-grid";

// Spec 008, T18: the hour grid takes the height of the screen (RF-47, plan D11).
describe("TimeGrid height", () => {
  it("scrolls inside the screen height, never shorter than 28 rem", () => {
    render(
      <TimeGrid
        days={["2026-10-21"]}
        events={[]}
        timeZone="Europe/Madrid"
        today="2026-10-21"
        linkDays={false}
      />,
    );

    const scroller = screen.getByTestId("time-grid").parentElement!;
    expect(scroller.className).toContain("overflow-y-auto");
    expect(scroller.className).toContain(
      "max-h-[max(28rem,calc(100dvh-17rem))]",
    );
    expect(scroller.className).not.toContain("max-h-[28rem]");
  });
});
