import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

interface LinkButtonProps extends LinkProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

const VARIANTS = {
  primary: "bg-brand text-white hover:opacity-90",
  secondary: "border-2 border-brand bg-white text-brand hover:bg-brand-soft/30",
};

/** Navigation styled as a button; same size and focus ring as Button (RNF-7, RNF-9). */
export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
