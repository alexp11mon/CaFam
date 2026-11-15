"use client";

import { useId, type RefObject } from "react";
import { useCalendarHeader } from "./calendar-header";

/**
 * What the calendar shows, on a phone: its views and its filters in a sheet
 * from the bottom, opened from the header (spec 025 RF-8; it takes the place
 * of the drawer of spec 016). A native modal <dialog>: focus trap and Escape
 * come with it. The calendar mounts its content in the slot.
 */
export function CalendarSheet({
  dialog,
  onClose,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  /** Gives the focus back to the button that opened it. */
  onClose: () => void;
}) {
  const titleId = useId();
  const { setDrawerSlot } = useCalendarHeader();
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      data-sheet=""
      aria-labelledby={titleId}
      onClose={onClose}
      // The backdrop is the dialog itself; choosing a view closes it too.
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
        else if ((event.target as Element).closest("a")) close();
      }}
      className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-card surface-float p-0 text-ink backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 pl-1">
          <h2 id={titleId} className="text-lg font-bold">
            Vista y calendarios
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-control px-4 font-semibold text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cerrar
          </button>
        </div>
        <div ref={setDrawerSlot} />
      </div>
    </dialog>
  );
}
