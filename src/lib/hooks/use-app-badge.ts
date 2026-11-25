"use client";

import { useEffect } from "react";

export type TodayBadge = { enabled: boolean; count: number };

/** Every 5 minutes while open: past midnight the count of the new day shows. */
const EVERY_MS = 5 * 60 * 1000;

/**
 * The number of today's events on the installed icon, with the app open
 * (spec 047 RF-12, plan D3). Without the Badging API it does nothing.
 */
export function useAppBadge(load: () => Promise<TodayBadge>) {
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    let live = true;
    const run = () =>
      load().then(
        ({ enabled, count }) => {
          if (!live) return;
          const done =
            enabled && count > 0
              ? navigator.setAppBadge(count)
              : navigator.clearAppBadge();
          done.catch(() => {});
        },
        () => {},
      );
    void run();
    const timer = setInterval(run, EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);
}
