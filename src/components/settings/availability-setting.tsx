"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Switch } from "@/components/ui/switch";
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
      <Switch
        label="Permitir que el asistente de otros consulte mi disponibilidad"
        description="Quienes comparten calendarios contigo podrán preguntar a su asistente cuándo estáis libres. Verá solo si estás libre u ocupado, nunca el título ni los detalles de tus eventos."
        checked={checked}
        onCheckedChange={(next) => void toggle(next)}
      />
      <FormAlert message={error} />
    </div>
  );
}
