// The look of every button and button-like link (constitution, amendment 10;
// spec 025 RF-6): 48 px tall, the control radius, never a pill. The primary
// one is the accent: one main action per screen.
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export const BUTTON_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 py-2 text-base font-semibold press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-accent-edge bg-accent text-on-accent hover:brightness-95",
  secondary: "border border-control bg-paper text-ink hover:bg-stone",
  quiet: "text-ink hover:bg-ink/10",
  danger: "border border-danger bg-paper text-danger hover:bg-danger/10",
};
