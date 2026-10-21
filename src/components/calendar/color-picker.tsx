import { useId } from "react";
import { CALENDAR_COLORS } from "@/lib/calendar/palette";

/** Radio group of the closed palette; native radios give arrow-key navigation (RF-2, RNF-7). */
export function ColorPicker({
  name,
  defaultValue,
  error,
  legend = "Color",
}: {
  name: string;
  defaultValue: string;
  error?: string;
  legend?: string;
}) {
  const errorId = `${useId()}-error`;
  const selected = defaultValue.toUpperCase();

  return (
    <fieldset
      role="radiogroup"
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="mb-1 text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {CALENDAR_COLORS.map((color) => (
          <label key={color.value} className="relative">
            <input
              type="radio"
              name={name}
              value={color.value}
              defaultChecked={color.value === selected}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              style={{ backgroundColor: color.value }}
              className="block size-11 rounded-full border-2 border-ink/30 peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand"
            />
            <span className="sr-only">{color.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
