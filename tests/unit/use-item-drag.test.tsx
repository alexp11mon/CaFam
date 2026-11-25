import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useItemDrag } from "@/components/notes/use-item-drag";

// Spec 048 RF-3: an item dragged by its handle, with the mouse at once and
// with a finger after holding it 300 ms.
const IDS = ["a", "b", "c"];

function List({ onDrop }: { onDrop: (id: string, to: number) => void }) {
  const list = useRef<HTMLUListElement>(null);
  const drag = useItemDrag(list, onDrop);
  return (
    <ul ref={list}>
      {IDS.map((id) => (
        <li
          key={id}
          data-item-id={id}
          data-over={drag.over === id || undefined}
        >
          <button
            type="button"
            aria-label={`Mover ${id}`}
            {...drag.handle(id)}
          />
        </li>
      ))}
      <li data-testid="dragging">{drag.dragging ?? "-"}</li>
    </ul>
  );
}

function layout() {
  document.querySelectorAll<HTMLElement>("[data-item-id]").forEach((row, i) => {
    row.getBoundingClientRect = () =>
      ({ top: i * 50, bottom: i * 50 + 50, height: 50 }) as DOMRect;
  });
}

const point = (
  type: "pointerDown" | "pointerMove" | "pointerUp",
  el: Element,
  y: number,
  pointerType = "mouse",
) =>
  fireEvent[type](el, {
    pointerType,
    pointerId: 1,
    button: 0,
    clientX: 10,
    clientY: y,
  });

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useItemDrag", () => {
  it("drops with the mouse at the index under the pointer", () => {
    const onDrop = vi.fn();
    render(<List onDrop={onDrop} />);
    layout();
    const handle = screen.getByRole("button", { name: "Mover a" });
    point("pointerDown", handle, 25);
    point("pointerMove", handle, 130);
    expect(screen.getByTestId("dragging").textContent).toBe("a");
    point("pointerUp", handle, 130);
    expect(onDrop).toHaveBeenCalledWith("a", 2);
    expect(screen.getByTestId("dragging").textContent).toBe("-");
  });

  it("starts with a finger only after holding 300 ms", () => {
    vi.useFakeTimers();
    const onDrop = vi.fn();
    render(<List onDrop={onDrop} />);
    layout();
    const handle = screen.getByRole("button", { name: "Mover c" });
    point("pointerDown", handle, 125, "touch");
    act(() => void vi.advanceTimersByTime(300));
    point("pointerMove", handle, 10, "touch");
    point("pointerUp", handle, 10, "touch");
    expect(onDrop).toHaveBeenCalledWith("c", 0);
  });

  it("leaves a quick finger to the page", () => {
    vi.useFakeTimers();
    const onDrop = vi.fn();
    render(<List onDrop={onDrop} />);
    layout();
    const handle = screen.getByRole("button", { name: "Mover a" });
    point("pointerDown", handle, 25, "touch");
    point("pointerMove", handle, 60, "touch");
    act(() => void vi.advanceTimersByTime(300));
    point("pointerUp", handle, 130, "touch");
    expect(onDrop).not.toHaveBeenCalled();
  });
});
