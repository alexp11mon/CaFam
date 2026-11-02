"use client";

import { useId, useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";

type Result = { error?: string };

/**
 * Consent for other people's assistant to see when the user is free; off by
 * default (spec 015 RF-20, RF-21). Saved at once, undone if saving fails,
 * like the theme.
 */
export function AvailabilitySetting({
  current,
  save,
}: {
  current: boolean;
  save: (share: boolean) => Promise<Result>;
}) {
  const [checked, setChecked] = useState(current);
  const [error, setError] = useState<string>();
  const hintId = useId();

  async function toggle(next: boolean) {
    setChecked(next);
    setError(undefined);
    let result: Result;
    try {
      result = await save(next);
    } catch {
      result = { error: CALENDAR_MESSAGES.connection };
    }
    if (result.error) {
      setChecked(!next);
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-base font-medium text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => void toggle(event.target.checked)}
          aria-describedby={hintId}
          className="mt-0.5 size-5 shrink-0 accent-ink"
        />
        Permitir que el asistente de otros consulte mi disponibilidad
      </label>
      <p id={hintId} className="text-sm text-muted">
        Quienes comparten calendarios contigo podrán preguntar a su asistente
        cuándo estáis libres. Verá solo si estás libre u ocupado, nunca el
        título ni los detalles de tus eventos.
      </p>
      <FormAlert message={error} />
    </div>
  );
}
