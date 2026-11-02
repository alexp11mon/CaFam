import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveCalendar } from "@/lib/hooks/use-live-calendar";
import { holdLive, takeRemoteRefresh } from "@/lib/calendar/live-hold";

// Spec 019, T3: refresh on someone else's change (RF-40, RF-41, RF-46, RF-48).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Status = "SUBSCRIBED" | "CHANNEL_ERROR" | "CLOSED" | "TIMED_OUT";
const fake = vi.hoisted(() => {
  const state = {
    topic: "",
    options: undefined as unknown,
    onMessage: null as null | ((message: { payload: unknown }) => void),
    onStatus: null as null | ((status: Status) => void),
    channels: 0,
    removed: 0,
    calls: [] as string[],
  };
  const client = {
    realtime: {
      setAuth: vi.fn(async () => {
        state.calls.push("setAuth");
      }),
    },
    channel: vi.fn((topic: string, options: unknown) => {
      state.topic = topic;
      state.options = options;
      state.channels++;
      const channel = {
        on: (
          _type: string,
          _filter: unknown,
          callback: (message: { payload: unknown }) => void,
        ) => {
          state.onMessage = callback;
          return channel;
        },
        subscribe: (callback: (status: Status) => void) => {
          state.calls.push("subscribe");
          state.onStatus = callback;
          return channel;
        },
      };
      return channel;
    }),
    removeChannel: vi.fn(async () => {
      state.removed++;
    }),
  };
  return { state, client };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => fake.client }));

function setVisible(visible: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: visible ? "visible" : "hidden",
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const onUpdate = vi.fn();
function Calendar() {
  useLiveCalendar("me", onUpdate);
  return null;
}

async function mount() {
  const view = render(<Calendar />);
  await act(async () => {});
  return view;
}

function send(actor: string | null) {
  act(() => fake.state.onMessage?.({ payload: { actor } }));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisible(true);
  router.refresh.mockClear();
  onUpdate.mockClear();
  Object.assign(fake.state, { channels: 0, removed: 0, calls: [] });
});

afterEach(() => {
  vi.useRealTimers();
  takeRemoteRefresh();
});

describe("useLiveCalendar", () => {
  it("listens to the user's private topic after passing the session", async () => {
    await mount();
    expect(fake.state.topic).toBe("user:me");
    expect(fake.state.options).toEqual({ config: { private: true } });
    expect(fake.state.calls).toEqual(["setAuth", "subscribe"]);
  });

  it("refreshes once for a burst of changes by others, and announces it", async () => {
    await mount();
    act(() => fake.state.onStatus?.("SUBSCRIBED"));
    send("you");
    send(null);
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(takeRemoteRefresh()).toBe(true);
  });

  it("ignores the user's own changes", async () => {
    await mount();
    send("me");
    act(() => vi.advanceTimersByTime(1000));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("waits for a hold to be released", async () => {
    await mount();
    const release = holdLive();
    send("you");
    act(() => vi.advanceTimersByTime(1000));
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => release());
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("stops listening while the tab is hidden and catches up when back", async () => {
    await mount();
    act(() => fake.state.onStatus?.("SUBSCRIBED"));
    await act(async () => setVisible(false));
    expect(fake.state.removed).toBe(1);
    await act(async () => setVisible(true));
    expect(fake.state.channels).toBe(2);
    act(() => fake.state.onStatus?.("SUBSCRIBED"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes after reconnecting from an error (RF-46)", async () => {
    await mount();
    act(() => fake.state.onStatus?.("SUBSCRIBED"));
    expect(router.refresh).not.toHaveBeenCalled();
    act(() => fake.state.onStatus?.("CHANNEL_ERROR"));
    act(() => fake.state.onStatus?.("SUBSCRIBED"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("leaves the channel on unmount", async () => {
    const view = await mount();
    view.unmount();
    expect(fake.state.removed).toBe(1);
  });
});
