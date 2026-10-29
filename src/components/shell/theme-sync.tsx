"use client";

import { useEffect } from "react";
import { paintTheme, readThemeCookie } from "@/lib/theme/apply-theme";
import type { ThemeId } from "@/lib/theme/theme";

/**
 * A device with an old cookie takes the theme of the profile, without
 * animation (spec 011 RF-4; plan theme-boot, flow step 6).
 */
export function ThemeSync({ theme }: { theme: ThemeId }) {
  useEffect(() => {
    if (readThemeCookie() !== theme) paintTheme(theme);
  }, [theme]);
  return null;
}
