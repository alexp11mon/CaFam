import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionAnnouncer } from "@/components/offline/connection-announcer";
import {
  ConnectionTimeout,
  isOnline,
  probe,
  resetConnection,
  startWatching,
  withTimeout,
} from "@/lib/offline/connection";

// Spec 034 T6: when the app is offline (RF-18, plan D11) and how it says so
// (RF-10).
const fetchMock = vi.fn();
let stop: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  stop = startWatching();
});
afterEach(() => {
  stop();
  resetConnection();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the connection state (RF-18)", () => {
  it("goes offline on the browser's offline event, and checks before going back", async () => {
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(isOnline()).toBe(false);
    await act(async () => void window.dispatchEvent(new Event("online")));
    expect(fetchMock).toHaveBeenCalledWith("/manifest.webmanifest", {
      cache: "no-store",
    });
    expect(isOnline()).toBe(true);
  });

  it("an action that fails by the network puts it offline", async () => {
    await expect(
      withTimeout(Promise.reject(new TypeError("Failed to fetch"))),
    ).rejects.toThrow(TypeError);
    expect(isOnline()).toBe(false);
  });

  it("an action with no answer in 10 s puts it offline", async () => {
    const pending = withTimeout(new Promise(() => {}));
    const failed = expect(pending).rejects.toBeInstanceOf(ConnectionTimeout);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(isOnline()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    expect(isOnline()).toBe(false);
  });

  it("an error of the server itself is not a lost connection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("CF404"))),
    ).rejects.toThrow();
    expect(isOnline()).toBe(true);
  });

  it("while offline it checks every 30 s, and an answer brings it back", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(() => probe());
    expect(isOnline()).toBe(false);
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(isOnline()).toBe(true);
    fetchMock.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the announcement (RF-10)", () => {
  it("says nothing at first, then each change", async () => {
    render(<ConnectionAnnouncer />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");

    act(() => void window.dispatchEvent(new Event("offline")));
    expect(region).toHaveTextContent("Sin conexión");
    await act(async () => void window.dispatchEvent(new Event("online")));
    expect(region).toHaveTextContent("Conexión recuperada");
  });
});
