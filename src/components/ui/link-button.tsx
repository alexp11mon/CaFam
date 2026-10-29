import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

interface LinkButtonProps extends LinkProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}

const VARIANTS = {
  primary: "bg-ink text-on-ink hover:bg-ink/85",
  secondary: "border border-control bg-paper text-ink hover:bg-stone",
};

/** Navigation styled as a button; same size and focus ring as Button (RNF-7, RNF-9). */
export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-base font-semibold press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
