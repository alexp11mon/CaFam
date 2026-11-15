// Shared look of the bottom bar items and the "Más" trigger (spec 025 RF-8):
// icon over a short name, the current one in the accent's ink.
export const BAR_ITEM =
  "group press-quiet flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-control px-1 text-center text-xs leading-tight font-semibold text-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink aria-[current=page]:text-accent-ink";

export const BAR_ICON =
  "flex h-8 w-14 items-center justify-center rounded-full transition-colors group-aria-[current=page]:bg-accent/15";
