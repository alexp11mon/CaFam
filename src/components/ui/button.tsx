import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

// Actions are black pills; the accent never colors a button (spec 005, P9).
const VARIANTS = {
  primary: "bg-ink text-on-ink hover:bg-ink/85",
  secondary: "border border-control bg-paper text-ink hover:bg-stone",
  danger: "border border-danger bg-paper text-danger hover:bg-danger/10",
};

/** Action button; `primary` is the default. */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
