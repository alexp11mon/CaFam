"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials, PERSON_TINTS } from "@/lib/people/avatar";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";
import { useCalendarHeader } from "./calendar-header";
import { CalendarSheet } from "./calendar-sheet";
import { CaretIcon } from "./icons";
import { CrossfadeText } from "@/components/ui/crossfade-text";

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-ink press-quiet hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The phone header (≤ 768 px): the title of the screen and its own actions,
 * never navigation, which lives in the bottom bar (constitution, amendment
 * 10; spec 025 RF-8). The calendar fills the title, which unfolds its months
 * (spec 016 RF-8, RF-20, RF-23); "Hoy", the views and the filters are down in
 * the calendar's bar, by the thumb (spec 026 RF-5).
 */
export function TopBar({ displayName }: { displayName: string }) {
  const current = activeSection(usePathname());
  const { state, pickerOpen, setPickerOpen } = useCalendarHeader();
  const section = NAV_ITEMS.find((item) => item.section === current)?.label;

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1 border-b border-line bg-paper pr-2 pl-4 pt-[env(safe-area-inset-top)] tab:hidden">
      {state?.picker ? (
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
          className="-ml-2 flex min-h-11 min-w-0 items-center gap-1 rounded-control px-2 text-xl font-bold text-ink press-quiet first-letter:uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {/* The month cross-fades as the agenda scrolls (spec 021 RF-52). */}
          <CrossfadeText text={state.title} />
          <CaretIcon open={pickerOpen} />
        </button>
      ) : (
        <p className="min-w-0 truncate text-xl font-bold text-ink">
          {state?.title ?? section ?? "CaFam"}
        </p>
      )}
      <span className="flex-1" />
      <Link
        href="/dashboard/settings"
        aria-label={`Ajustes de ${displayName}`}
        className={ICON_BUTTON}
      >
        {/* Only the user's own avatar here: the first tint, as nobody else is drawn. */}
        <span
          aria-hidden="true"
          style={{ backgroundColor: PERSON_TINTS[0] }}
          className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-pastel-ink"
        >
          {initials(displayName)}
        </span>
      </Link>
      <CalendarSheet />
    </header>
  );
}
