import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

const VARIANTS = {
  // White text on brand: 5.2:1 contrast (RNF-9).
  primary: "bg-brand text-white hover:opacity-90",
  secondary: "border-2 border-brand bg-white text-brand hover:bg-brand-soft/30",
  danger: "border-2 border-red-700 bg-white text-red-800 hover:bg-red-50",
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
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
