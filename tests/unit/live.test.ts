import { afterEach, describe, expect, it, vi } from "vitest";
import { liveDecision } from "@/lib/calendar/live";
import {
  holdLive,
  isLiveHeld,
  onLiveRelease,
  takeRemoteRefresh,
  markRemoteRefresh,
} from "@/lib/calendar/live-hold";

// Spec 019, T3 and T4: what a change message does (plan live-client, D5, D6).
describe("liveDecision", () => {
  it("ignores the user's own changes", () => {
    expect(liveDecision({ actor: "me", me: "me", held: false })).toBe("ignore");
  });

  it("refreshes for someone else or the sync (no actor)", () => {
    expect(liveDecision({ actor: "you", me: "me", held: false })).toBe(
      "refresh",
    );
    expect(liveDecision({ actor: null, me: "me", held: false })).toBe(
      "refresh",
    );
  });

  it("waits while the user drags, creates or edits", () => {
    expect(liveDecision({ actor: "you", me: "me", held: true })).toBe("hold");
  });
});

describe("live-hold", () => {
  afterEach(() => {
    takeRemoteRefresh();
  });

  it("holds until every hold is released, then tells once", () => {
    const listener = vi.fn();
    const stop = onLiveRelease(listener);
    const first = holdLive();
    const second = holdLive();
    expect(isLiveHeld()).toBe(true);
    first();
    first(); // releasing twice counts once
    expect(isLiveHeld()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    second();
    expect(isLiveHeld()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("remembers a remote refresh for the next reader only", () => {
    expect(takeRemoteRefresh()).toBe(false);
    markRemoteRefresh();
    expect(takeRemoteRefresh()).toBe(true);
    expect(takeRemoteRefresh()).toBe(false);
  });
});
