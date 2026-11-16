// Shared look of the phone's floating navigation and its "Más" trigger
// (constitution, amendment 11; spec 030 RF-5): icon over a short name, the
// current one on the soft accent.
export const BAR_ITEM =
  "group press-quiet m-1 flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-center text-xs leading-tight font-medium text-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink";

export const BAR_ICON = "flex items-center justify-center transition-colors";

/** A tab of the desktop navigation: a pill, the current one in the gradient. */
export const TAB_ITEM =
  "press-quiet flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-muted hover:bg-stone hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent-gradient aria-[current=page]:text-on-accent";
