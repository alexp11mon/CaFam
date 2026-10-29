"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { ACCENTS, type AccentId } from "@/lib/theme/accents";

type Result = { error?: string };

function paintFrame(accent: AccentId) {
  const frame = document.querySelector<HTMLElement>("[data-app-frame]");
  if (frame) frame.dataset.accent = accent;
}

/**
 * The six accents as a radio group. A choice repaints the frame at once and is
 * saved in the background; if saving fails it is undone (spec 005 RF-6, RF-7, RF-12).
 */
export function AccentPicker({
  current,
  setAccent,
}: {
  current: AccentId;
  setAccent: (accent: AccentId) => Promise<Result>;
}) {
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string>();

  async function choose(accent: AccentId) {
    const previous = selected;
    setSelected(accent);
    setError(undefined);
    paintFrame(accent);
    let result: Result;
    try {
      result = await setAccent(accent);
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      setSelected(previous);
      paintFrame(previous);
      setError(result.error);
    }
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-lg font-bold text-ink">
        Color de acento
      </legend>
      <p className="text-muted">
        Marca el día de hoy, la hora actual y lo que tienes seleccionado.
      </p>
      <div
        role="radiogroup"
        aria-label="Color de acento"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {ACCENTS.map((accent) => (
          <label
            key={accent.id}
            className="press flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-base font-medium text-ink has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name="accent"
              value={accent.id}
              checked={selected === accent.id}
              onChange={() => void choose(accent.id)}
              className="sr-only"
            />
            {/* data-accent scopes the variables, so each swatch shows its own color. */}
            <span
              aria-hidden="true"
              data-accent={accent.id}
              className="size-7 shrink-0 rounded-full border-2 border-accent-edge bg-accent"
            />
            {accent.label}
          </label>
        ))}
      </div>
      <FormAlert message={error} />
    </fieldset>
  );
}
