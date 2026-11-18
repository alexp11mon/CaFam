import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingMark } from "@/components/offline/pending-mark";

// Spec 034 T8: the mark of what waits on the device (RF-28, RF-37).
describe("PendingMark", () => {
  it("says it to screen readers with the icon, never by color alone", () => {
    const { container } = render(<PendingMark pending />);
    expect(screen.getByText("Pendiente de enviar")).toHaveClass("sr-only");
    expect(container.querySelector("[data-icon=pending]")).not.toBeNull();
  });

  it("shows the words as a label in a detail, and nothing when sent", () => {
    const { rerender, container } = render(<PendingMark pending label />);
    expect(screen.getByText("Pendiente de enviar")).not.toHaveClass("sr-only");
    rerender(<PendingMark pending={false} label />);
    expect(container).toBeEmptyDOMElement();
  });
});
