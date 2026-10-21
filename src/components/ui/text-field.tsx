import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

/** Labelled input whose error is linked through aria-describedby (RNF-7). */
export function TextField({
  label,
  name,
  error,
  ...inputProps
}: TextFieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-lg border border-ink/30 bg-white px-3 py-2 text-base text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand aria-invalid:border-red-700"
        {...inputProps}
      />
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
