import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isLiveHeld } from "@/lib/calendar/live-hold";
import { useHoldLive } from "@/lib/hooks/use-hold-live";

// Spec 019, T4: a drag, the quick window or an edit form hold the refresh (RF-43).
function Holder({ active }: { active: boolean }) {
  useHoldLive(active);
  return null;
}

describe("useHoldLive", () => {
  it("holds while active and releases when it ends or unmounts", () => {
    const view = render(<Holder active={false} />);
    expect(isLiveHeld()).toBe(false);
    view.rerender(<Holder active />);
    expect(isLiveHeld()).toBe(true);
    view.rerender(<Holder active={false} />);
    expect(isLiveHeld()).toBe(false);
    view.rerender(<Holder active />);
    view.unmount();
    expect(isLiveHeld()).toBe(false);
  });
});
