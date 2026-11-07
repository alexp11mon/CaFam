"use client";

import { useSyncExternalStore } from "react";
import { setTheme } from "@/app/dashboard/settings/actions";
import { useToast } from "@/components/ui/toast";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import {
  applyTheme,
  centreOf,
  readThemeCookie,
  type RevealOrigin,
} from "@/lib/theme/apply-theme";
import {
  effectiveTheme,
  nextToggleTheme,
  parseTheme,
  type EffectiveTheme,
} from "@/lib/theme/theme";
import { MoonIcon, SunIcon } from "./icons";
import { IconSwap } from "@/components/ui/icon-swap";

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

  async function toggle(origin: RevealOrigin) {
    const previous = parseTheme(readThemeCookie());
    // The new theme grows from the button (spec 021 RF-36).
    applyTheme(next, origin);
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
    <button
      type="button"
      onClick={(event) => void toggle(centreOf(event.currentTarget))}
      className={className}
    >
      {/* The sun and the moon trade places (spec 021 RF-54). */}
      <IconSwap
        show={next === "dark" ? "a" : "b"}
        a={<MoonIcon />}
        b={<SunIcon />}
      />
      <span className={labelClassName}>{LABEL[next]}</span>
    </button>
  );
}
