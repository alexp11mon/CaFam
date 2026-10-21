import { useId, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  error?: string;
}

/** Labelled native select; same error linking as TextField (RNF-7). */
export function Select({
  label,
  name,
  error,
  children,
  ...props
}: SelectProps) {
  // useId, not the name: with cacheComponents Next keeps the previous page hidden in the DOM.
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 w-full rounded-lg border border-ink/30 bg-white px-3 py-2 text-base text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand aria-invalid:border-red-700"
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
