"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { applyTheme, centreOf } from "@/lib/theme/apply-theme";
import { SelectionRing } from "./selection-ring";
import { THEME_OPTIONS, type ThemeId } from "@/lib/theme/theme";

type Result = { error?: string };

/**
 * The three themes as a radio group, like the accents: a choice is applied at
 * once and saved in the background; if saving fails it is undone (spec 011
 * RF-1, RF-3, RF-4; plan theme-picker).
 */
export function ThemePicker({
  current,
  setTheme,
}: {
  current: ThemeId;
  setTheme: (theme: ThemeId) => Promise<Result>;
}) {
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string>();

  async function choose(theme: ThemeId, from: Element) {
    const previous = selected;
    setSelected(theme);
    setError(undefined);
    // The new theme grows from the chosen card (spec 021 RF-36).
    applyTheme(theme, centreOf(from));
    let result: Result;
    try {
      result = await setTheme(theme);
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      setSelected(previous);
      applyTheme(previous);
      setError(result.error);
    }
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-lg font-bold text-ink">Tema</legend>
      <p className="text-muted">
        &ldquo;Como el sistema&rdquo; cambia solo cuando cambia tu dispositivo.
      </p>
      <div
        role="radiogroup"
        aria-label="Tema"
        className="relative grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.id}
            className="press flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-base font-medium text-ink has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name="theme"
              value={option.id}
              checked={selected === option.id}
              onChange={(event) =>
                void choose(
                  option.id,
                  event.currentTarget.closest("label") ?? event.currentTarget,
                )
              }
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
        <SelectionRing selected={selected} />
      </div>
      <FormAlert message={error} />
    </fieldset>
  );
}
