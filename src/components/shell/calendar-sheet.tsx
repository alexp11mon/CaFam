"use client";

import { useId } from "react";
import { useCalendarHeader } from "./calendar-header";
import { useT } from "@/components/i18n/locale-provider";

/**
 * Which calendars the phone shows: the filters in a sheet from the bottom,
 * opened from the calendar's own bar (spec 026 RF-4; it takes the place of
 * the drawer of spec 016). A native modal <dialog>: focus trap and Escape
 * come with it. The calendar mounts its filters in the slot.
 */
export function CalendarSheet() {
  const t = useT();
  const titleId = useId();
  const { setDrawerSlot, sheet: dialog, sheetClosed } = useCalendarHeader();
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      data-sheet=""
      aria-labelledby={titleId}
      onClose={sheetClosed}
      // The backdrop is the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-card surface-float p-0 text-ink backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 pl-1">
          <h2 id={titleId} className="text-lg font-semibold">
            {t("Calendarios")}
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-control px-4 font-semibold text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {t("Cerrar")}
          </button>
        </div>
        <div ref={setDrawerSlot} />
      </div>
    </dialog>
  );
}
