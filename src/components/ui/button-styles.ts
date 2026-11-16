// The look of every button and button-like link (constitution, amendment 11;
// spec 030 RF-9): the control radius, medium weight, 44 px to touch. The
// primary one carries the gradient of the accent with its glow: one main
// action per screen.
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-4 py-2 text-sm font-medium press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-gradient text-on-accent hover:brightness-95",
  secondary: "border border-line bg-paper text-ink hover:bg-stone",
  quiet: "text-accent-ink hover:bg-accent-soft",
  danger: "border border-danger/40 bg-paper text-danger hover:bg-danger/10",
};
