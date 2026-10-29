import { useId, type InputHTMLAttributes } from "react";

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
  // useId, not the name: with cacheComponents Next keeps the previous page hidden in the DOM, so a fixed id would repeat.
  const id = useId();
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
        className="w-full rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20 aria-invalid:border-danger"
        {...inputProps}
      />
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
