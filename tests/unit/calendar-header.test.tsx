import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CalendarHeaderProvider,
  useCalendarHeader,
  usePublishCalendarHeader,
} from "@/components/shell/calendar-header";

// Spec 016 RF-8, RF-10, RF-59 (plan header-context).
function Reader() {
  const { state } = useCalendarHeader();
  return (
    <div>
      <p>{state ? state.title : "sin calendario"}</p>
      {state?.onToday ? (
        <button type="button" onClick={state.onToday}>
          Hoy
        </button>
      ) : null}
      <p>{state?.picker ?? "sin selector"}</p>
    </div>
  );
}

function Publisher({ title, onToday }: { title: string; onToday: () => void }) {
  usePublishCalendarHeader({
    title,
    today: "2026-10-30",
    onToday,
    picker: "months",
  });
  return null;
}

describe("CalendarHeaderProvider", () => {
  it("shows what the calendar publishes, with the latest Hoy action", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <CalendarHeaderProvider>
        <Reader />
        <Publisher title="octubre" onToday={first} />
      </CalendarHeaderProvider>,
    );

    expect(await screen.findByText("octubre")).toBeInTheDocument();
    expect(screen.getByText("months")).toBeInTheDocument();

    rerender(
      <CalendarHeaderProvider>
        <Reader />
        <Publisher title="noviembre" onToday={second} />
      </CalendarHeaderProvider>,
    );
    expect(await screen.findByText("noviembre")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("goes back to nothing when the calendar leaves", async () => {
    const { rerender } = render(
      <CalendarHeaderProvider>
        <Reader />
        <Publisher title="octubre" onToday={() => {}} />
      </CalendarHeaderProvider>,
    );
    await screen.findByText("octubre");

    rerender(
      <CalendarHeaderProvider>
        <Reader />
      </CalendarHeaderProvider>,
    );

    expect(await screen.findByText("sin calendario")).toBeInTheDocument();
  });

  it("opens and closes the picker", async () => {
    function Toggle() {
      const { pickerOpen, setPickerOpen } = useCalendarHeader();
      return (
        <button type="button" onClick={() => setPickerOpen(!pickerOpen)}>
          {pickerOpen ? "abierto" : "cerrado"}
        </button>
      );
    }
    render(
      <CalendarHeaderProvider>
        <Toggle />
      </CalendarHeaderProvider>,
    );

    await act(() => userEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("button")).toHaveTextContent("abierto");
  });
});
