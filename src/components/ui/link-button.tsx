import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import {
  BUTTON_BASE,
  BUTTON_VARIANTS,
  type ButtonVariant,
} from "./button-styles";

interface LinkButtonProps extends LinkProps {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

/** Navigation styled as a button; same size and focus ring as Button (RNF-7, RNF-9). */
export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
