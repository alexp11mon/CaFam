"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production builds only (plan flow step 6). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Without a service worker the app still works online.
      });
  }, []);

  return null;
}
