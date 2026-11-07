/**
 * A button label that changes while its action runs ("Guardar" → "Guardando…")
 * without the button changing size: both texts share one cell, as wide as the
 * longer, and cross-fade (spec 021 RF-52, RF-53). The hidden one is
 * aria-hidden, so the button's name is the visible text.
 */
export function SwapLabel({
  busy,
  idle,
  busyText,
}: {
  busy: boolean;
  idle: string;
  busyText: string;
}) {
  return (
    <span className="swap">
      <span data-off={busy || undefined} aria-hidden={busy || undefined}>
        {idle}
      </span>
      <span data-off={!busy || undefined} aria-hidden={!busy || undefined}>
        {busyText}
      </span>
    </span>
  );
}
