"use client";

import { loadTodayBadge } from "@/app/dashboard/badge-actions";
import { useAppBadge } from "@/lib/hooks/use-app-badge";

/** Today's events on the installed icon, while the app is open (spec 047 RF-12). */
export function AppBadge() {
  useAppBadge(loadTodayBadge);
  return null;
}
