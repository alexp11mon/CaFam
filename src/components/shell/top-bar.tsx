"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/lib/people/avatar";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";
import { useCalendarHeader } from "./calendar-header";
import { CalendarSheet } from "./calendar-sheet";
import { LogoMark } from "@/components/brand/logo";
import { CaretIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { ConnectionBadge } from "@/components/offline/connection-badge";
import { CrossfadeText } from "@/components/ui/crossfade-text";

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-control text-muted press-quiet hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The phone header (≤ 768 px): the brand, the title of the screen, the theme
 * and the account; navigation lives in the floating bar (constitution,
 * amendment 11; spec 030 RF-5). The calendar fills the title, which unfolds its months
 * (spec 016 RF-8, RF-20, RF-23); "Hoy", the views and the filters are down in
 * the calendar's bar, by the thumb (spec 026 RF-5).
 */
export function TopBar({ displayName }: { displayName: string }) {
  const current = activeSection(usePathname());
  const { state, pickerOpen, setPickerOpen } = useCalendarHeader();
  const section = NAV_ITEMS.find((item) => item.section === current)?.label;

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center gap-2 bg-stone pr-2 pl-4 pt-[env(safe-area-inset-top)] tab:hidden">
      <LogoMark className="size-7" />
      {state?.picker ? (
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
          className="-ml-1 flex min-h-11 min-w-0 items-center gap-1 rounded-control px-1.5 text-lg font-semibold tracking-tight text-ink press-quiet first-letter:uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {/* The month cross-fades as the agenda scrolls (spec 021 RF-52). */}
          <CrossfadeText text={state.title} />
          <CaretIcon open={pickerOpen} />
        </button>
      ) : (
        <p className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink">
          {state?.title ?? section ?? "CaFam"}
        </p>
      )}
      <span className="flex-1" />
      <ConnectionBadge />
      <ThemeToggle className={ICON_BUTTON} labelClassName="sr-only" />
      <Link
        href="/dashboard/settings"
        aria-label={`Ajustes de ${displayName}`}
        className={ICON_BUTTON}
      >
        {/* Only the user's own avatar here: the first tint, as nobody else is drawn. */}
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
        >
          {initials(displayName)}
        </span>
      </Link>
      <CalendarSheet />
    </header>
  );
}
