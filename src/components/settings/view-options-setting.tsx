"use client";

import { useRef, useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { DURATIONS, durationLabel } from "@/lib/calendar/view-options";
import { pulse } from "@/lib/motion/play";

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
  // The text that goes with the pulse: never the only sign (spec 021 RF-51).
  const [saved, setSaved] = useState(false);
  const select = useRef<HTMLSelectElement>(null);

  async function toggle(next: boolean): Promise<boolean> {
    setWeekends(next);
    setError(undefined);
    setSaved(false);
    const result = await attempt(() => saveWeekends(next));
    if (result.error) {
      setWeekends(!next);
      setError(result.error);
      return false;
    }
    setSaved(true);
    return true;
  }

  async function choose(next: number) {
    const previous = minutes;
    setMinutes(next);
    setError(undefined);
    setSaved(false);
    const result = await attempt(() => saveDuration(next));
    if (result.error) {
      setMinutes(previous);
      setError(result.error);
      return;
    }
    setSaved(true);
    if (select.current) pulse(select.current);
  }

  return (
    <div className="flex flex-col gap-4">
      <Switch
        label="Mostrar fines de semana"
        checked={weekends}
        onCheckedChange={toggle}
      />
      <div className="sm:max-w-60">
        <Select
          ref={select}
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
      {saved ? (
        <p role="status" className="text-sm text-ink">
          Guardado.
        </p>
      ) : null}
    </div>
  );
}
