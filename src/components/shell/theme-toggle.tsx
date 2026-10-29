"use client";

import { useSyncExternalStore } from "react";
import { setTheme } from "@/app/dashboard/settings/actions";
import { useToast } from "@/components/ui/toast";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { applyTheme, readThemeCookie } from "@/lib/theme/apply-theme";
import {
  effectiveTheme,
  nextToggleTheme,
  parseTheme,
  type EffectiveTheme,
} from "@/lib/theme/theme";
import { MoonIcon, SunIcon } from "./icons";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// What is on screen: the attribute, or the system without one. Watching both
// keeps the label right after a change in Ajustes or in the OS.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const media = window.matchMedia?.(DARK_QUERY);
  media?.addEventListener?.("change", onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener?.("change", onChange);
  };
}

function onScreen(): EffectiveTheme {
  return effectiveTheme(
    parseTheme(document.documentElement.dataset.theme),
    window.matchMedia?.(DARK_QUERY).matches ?? false,
  );
}

const LABEL: Record<EffectiveTheme, string> = {
  light: "Cambiar a tema claro",
  dark: "Cambiar a tema oscuro",
};

/**
 * Flips light and dark from the frame and saves it like Ajustes; "Como el
 * sistema" is only picked there (spec 011 RF-6, plan D14). The label is the
 * accessible name: visible in the sheet, a tooltip in the rail.
 */
export function ThemeToggle({
  className,
  labelClassName,
}: {
  className: string;
  labelClassName?: string;
}) {
  const current = useSyncExternalStore(
    subscribe,
    onScreen,
    (): EffectiveTheme => "light",
  );
  const next = nextToggleTheme(current);
  const toast = useToast();

  async function toggle() {
    const previous = parseTheme(readThemeCookie());
    applyTheme(next);
    let result: { error?: string };
    try {
      result = await setTheme(next);
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      applyTheme(previous);
      toast.show(result.error);
    }
  }

  return (
    <button type="button" onClick={() => void toggle()} className={className}>
      {next === "dark" ? <MoonIcon /> : <SunIcon />}
      <span className={labelClassName}>{LABEL[next]}</span>
    </button>
  );
}
