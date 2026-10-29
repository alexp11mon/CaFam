import { describe, expect, it } from "vitest";
import {
  CAL_FILTER,
  CAL_NEXT,
  CAL_PREV,
  CAL_VIEW,
  periodType,
  VIEW_MOTION,
} from "@/lib/calendar/transition-types";

// Spec 011, T11: the transition types of the calendar (RF-17, RF-18; plan
// view-motion, "Contratos e interfaces").
describe("transition types", () => {
  it("name the CSS classes of globals.css", () => {
    expect([CAL_VIEW, CAL_NEXT, CAL_PREV, CAL_FILTER]).toEqual([
      "cal-view",
      "cal-next",
      "cal-prev",
      "cal-filter",
    ]);
  });

  it("periodType follows the sense of the change (RF-18)", () => {
    expect(periodType(1)).toBe("cal-next");
    expect(periodType(-1)).toBe("cal-prev");
    expect(periodType(0)).toBeUndefined();
  });

  it("each type enters and exits with its own class, others do not animate", () => {
    expect(VIEW_MOTION).toEqual({
      "cal-view": "cal-view",
      "cal-next": "cal-next",
      "cal-prev": "cal-prev",
      default: "none",
    });
  });
});
