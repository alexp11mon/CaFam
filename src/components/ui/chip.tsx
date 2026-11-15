import type { ButtonHTMLAttributes, Ref } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A chip that is a choice says so; one that only acts leaves it out. */
  selected?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A pill to pick or to send something short (spec 025 RF-6): suggestions of
 * the assistant, filters. 44 px tall to touch; never a button's rectangle.
 */
export function Chip({
  selected,
  className = "",
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-control bg-paper px-4 text-sm font-semibold whitespace-nowrap text-ink press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-accent-edge aria-pressed:bg-accent aria-pressed:text-on-accent ${className}`}
      {...props}
    />
  );
}
