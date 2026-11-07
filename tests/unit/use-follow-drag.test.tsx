import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useFollowDrag } from "@/lib/hooks/use-follow-drag";

// Spec 021, T16: something that follows a finger along one axis (RF-23,
// RF-26, RF-27, plan follow-gesture, D11).
function Area({
  onRelease,
  offset,
}: {
  onRelease: (delta: number, velocity: number, el: HTMLElement) => void;
  offset?: (delta: number) => number;
}) {
  const area = useRef<HTMLDivElement>(null);
  const follow = useFollowDrag(area, { onRelease, offset });
  return (
    <div data-testid="area" ref={area} {...follow}>
      Vista
    </div>
  );
}

const frame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

function touch(
  type: "pointerDown" | "pointerMove" | "pointerUp",
  el: Element,
  x: number,
  y = 100,
  pointerType = "touch",
) {
  fireEvent[type](el, { pointerType, pointerId: 1, clientX: x, clientY: y });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFollowDrag", () => {
  it("moves the element under a sideways finger and tells the release", async () => {
    const onRelease = vi.fn();
    render(<Area onRelease={onRelease} />);
    const area = screen.getByTestId("area");

    touch("pointerDown", area, 300);
    touch("pointerMove", area, 280);
    touch("pointerMove", area, 220);
    await frame();
    expect(area.style.translate).toBe("-80px 0px");

    touch("pointerUp", area, 200);
    expect(onRelease).toHaveBeenCalledWith(-100, expect.any(Number), area);
  });

  it("leaves a vertical gesture to the page (RF-27)", async () => {
    const onRelease = vi.fn();
    render(<Area onRelease={onRelease} />);
    const area = screen.getByTestId("area");

    touch("pointerDown", area, 300, 100);
    touch("pointerMove", area, 296, 140);
    touch("pointerMove", area, 200, 150);
    await frame();
    expect(area.style.translate).toBe("");
    touch("pointerUp", area, 150, 150);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("ignores the mouse, which drags to create (spec 008)", async () => {
    const onRelease = vi.fn();
    render(<Area onRelease={onRelease} />);
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300, 100, "mouse");
    touch("pointerMove", area, 200, 100, "mouse");
    touch("pointerUp", area, 200, 100, "mouse");
    await frame();
    expect(area.style.translate).toBe("");
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("does nothing under an open window", () => {
    const onRelease = vi.fn();
    render(<Area onRelease={onRelease} />);
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300);
    touch("pointerUp", area, 100);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("works inside its own window, as the drawer does", () => {
    const onRelease = vi.fn();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    render(<Area onRelease={onRelease} />, { container: dialog });
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300);
    touch("pointerUp", area, 100);
    expect(onRelease).toHaveBeenCalledWith(-200, expect.any(Number), area);
  });

  it("works in a window over another one, as the image viewer does", () => {
    const onRelease = vi.fn();
    const under = document.createElement("dialog");
    under.setAttribute("open", "");
    const over = document.createElement("dialog");
    over.setAttribute("open", "");
    document.body.append(under, over);
    render(<Area onRelease={onRelease} />, { container: over });
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300);
    touch("pointerUp", area, 100);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("drops CSS transitions only while it follows", () => {
    render(<Area onRelease={vi.fn()} />);
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300);
    touch("pointerMove", area, 200);
    expect(area).toHaveAttribute("data-following");
    touch("pointerUp", area, 200);
    expect(area).not.toHaveAttribute("data-following");
  });

  it("maps the finger with `offset`, for the rubber band (RF-32)", async () => {
    render(<Area onRelease={vi.fn()} offset={(delta) => delta / 2} />);
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 100);
    touch("pointerMove", area, 200);
    await frame();
    expect(area.style.translate).toBe("50px 0px");
  });

  it("a second finger cancels it, back in place", async () => {
    const onRelease = vi.fn();
    render(<Area onRelease={onRelease} />);
    const area = screen.getByTestId("area");
    touch("pointerDown", area, 300);
    touch("pointerMove", area, 200);
    await frame();
    fireEvent.pointerDown(area, {
      pointerType: "touch",
      pointerId: 2,
      clientX: 50,
      clientY: 50,
    });
    await frame();
    expect(area.style.translate).toBe("");
    touch("pointerUp", area, 100);
    expect(onRelease).not.toHaveBeenCalled();
  });
});
