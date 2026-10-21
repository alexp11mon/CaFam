import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CalendarList,
  type CalendarListItem,
} from "@/components/dashboard/calendar-list";

const CALENDARS: CalendarListItem[] = [
  { id: "1", name: "Mi calendario", color: "#2563EB", role: "owner" },
  { id: "2", name: "Familia", color: "#16A34A", role: "editor" },
  { id: "3", name: "Fútbol", color: "#DC2626", role: "viewer" },
];

describe("CalendarList", () => {
  it("shows each calendar with its name, color and translated role (RF-13)", () => {
    render(<CalendarList calendars={CALENDARS} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const expected = [
      ["Mi calendario", "Propietario", "#2563EB"],
      ["Familia", "Editor", "#16A34A"],
      ["Fútbol", "Lector", "#DC2626"],
    ];
    expected.forEach(([name, role, color], index) => {
      const item = within(items[index]!);
      expect(item.getByText(name!)).toBeInTheDocument();
      expect(item.getByText(role!)).toBeInTheDocument();
      expect(item.getByTestId("calendar-color")).toHaveStyle({
        backgroundColor: color,
      });
    });
  });

  it("shows the empty state when there are no calendars", () => {
    render(<CalendarList calendars={[]} />);

    expect(
      screen.getByText("Todavía no tienes calendarios."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
