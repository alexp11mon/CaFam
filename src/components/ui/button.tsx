import type { ButtonHTMLAttributes, Ref } from "react";
import {
  BUTTON_BASE,
  BUTTON_VARIANTS,
  type ButtonVariant,
} from "./button-styles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

/** Action button; `primary` (the accent) is the default. */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
