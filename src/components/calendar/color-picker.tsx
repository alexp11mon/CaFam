import { useId } from "react";
import { CALENDAR_COLORS } from "@/lib/calendar/palette";

/** Radio group of the closed palette; native radios give arrow-key navigation (RF-2, RNF-7). */
export function ColorPicker({
  name,
  defaultValue,
  error,
  legend = "Color",
  emptyLabel,
}: {
  name: string;
  defaultValue: string;
  error?: string;
  legend?: string;
  /** Adds a first choice with an empty value, e.g. "use the calendar color". */
  emptyLabel?: string;
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
        {emptyLabel ? (
          <label className="relative">
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={selected === ""}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full border-2 border-dashed border-control bg-paper text-xs font-semibold text-ink peer-checked:border-solid peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
            >
              Auto
            </span>
            <span className="sr-only">{emptyLabel}</span>
          </label>
        ) : null}
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
              className="block size-11 rounded-full border-2 border-control peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
            />
            <span className="sr-only">{color.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
