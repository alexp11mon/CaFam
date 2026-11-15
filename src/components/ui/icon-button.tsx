import type { ButtonHTMLAttributes, Ref } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The accessible name: an icon alone says nothing to a screen reader. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

/** A round 44 px button with only an icon (spec 025 RF-6, RNF-2). */
export function IconButton({
  label,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-ink press-quiet hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
