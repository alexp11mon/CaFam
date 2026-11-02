"use client";

import { useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { DURATIONS, durationLabel } from "@/lib/calendar/view-options";

type Result = { error?: string };

async function attempt(save: () => Promise<Result>): Promise<Result> {
  try {
    return await save();
  } catch {
    return { error: CALENDAR_MESSAGES.connection };
  }
}

/**
 * Weekends and the default duration of a new event (spec 019 RF-23, RF-30).
 * Saved at once and undone if saving fails, like the theme.
 */
export function ViewOptionsSetting({
  showWeekends,
  duration,
  saveWeekends,
  saveDuration,
}: {
  showWeekends: boolean;
  duration: number;
  saveWeekends: (show: boolean) => Promise<Result>;
  saveDuration: (minutes: number) => Promise<Result>;
}) {
  const [weekends, setWeekends] = useState(showWeekends);
  const [minutes, setMinutes] = useState(duration);
  const [error, setError] = useState<string>();

  async function toggle(next: boolean) {
    setWeekends(next);
    setError(undefined);
    const result = await attempt(() => saveWeekends(next));
    if (result.error) {
      setWeekends(!next);
      setError(result.error);
    }
  }

  async function choose(next: number) {
    const previous = minutes;
    setMinutes(next);
    setError(undefined);
    const result = await attempt(() => saveDuration(next));
    if (result.error) {
      setMinutes(previous);
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium text-ink">
        <input
          type="checkbox"
          checked={weekends}
          onChange={(event) => void toggle(event.target.checked)}
          className="size-5 shrink-0 accent-ink"
        />
        Mostrar fines de semana
      </label>
      <div className="sm:max-w-60">
        <Select
          label="Duración de un evento nuevo"
          name="defaultDuration"
          value={minutes}
          onChange={(event) => void choose(Number(event.target.value))}
        >
          {DURATIONS.map((value) => (
            <option key={value} value={value}>
              {durationLabel(value)}
            </option>
          ))}
        </Select>
      </div>
      <FormAlert message={error} />
    </div>
  );
}
