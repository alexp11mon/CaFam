import Link, { type LinkProps } from "next/link";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

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
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium whitespace-nowrap text-muted press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink ${className}`}
      {...props}
    />
  );
}

/** A chip that goes somewhere: the secondary ways of a screen, in one row. */
export function ChipLink({
  className = "",
  ...props
}: LinkProps & { children: ReactNode; className?: string }) {
  return (
    <Link
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium whitespace-nowrap text-muted press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
      {...props}
    />
  );
}
