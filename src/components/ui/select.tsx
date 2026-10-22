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
        className="min-h-11 w-full rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20 aria-invalid:border-danger"
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
