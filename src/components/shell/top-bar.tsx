"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { initials, PERSON_TINTS } from "@/lib/people/avatar";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";
import { formatDateKeyFull } from "@/lib/calendar/format";
import { useCalendarHeader } from "./calendar-header";
import { CaretIcon, MenuIcon, TodayIcon } from "./icons";
import { NavDrawer } from "./nav-drawer";

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-ink press hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The phone header (≤ 768 px), as Google Calendar: menu, title, "Hoy" and the
 * avatar. The calendar fills the title and "Hoy" (spec 016 RF-6..RF-12, RF-20,
 * RF-23; plan top-bar).
 */
export function TopBar({
  displayName,
  signOutAction,
}: {
  displayName: string;
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());
  const { state, pickerOpen, setPickerOpen } = useCalendarHeader();
  const drawer = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const section = NAV_ITEMS.find((item) => item.section === current)?.label;

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-1 glass px-2 pt-[env(safe-area-inset-top)] tab:hidden">
      <button
        ref={menu}
        type="button"
        aria-label="Menú"
        aria-haspopup="dialog"
        onClick={() => drawer.current?.showModal()}
        className={ICON_BUTTON}
      >
        <MenuIcon />
      </button>
      {state?.picker ? (
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex min-h-11 min-w-0 items-center gap-1 rounded-full px-2 text-xl text-ink press first-letter:uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="truncate">{state.title}</span>
          <CaretIcon open={pickerOpen} />
        </button>
      ) : (
        <p className="min-w-0 truncate px-2 text-xl text-ink">
          {state?.title ?? section ?? "CaFam"}
        </p>
      )}
      <span className="flex-1" />
      {state?.onToday ? (
        <button
          type="button"
          aria-label={`Hoy, ${formatDateKeyFull(state.today)}`}
          aria-keyshortcuts="T"
          onClick={state.onToday}
          className={ICON_BUTTON}
        >
          <TodayIcon day={Number(state.today.slice(8))} />
        </button>
      ) : null}
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
      <NavDrawer
        dialog={drawer}
        current={current}
        signOutAction={signOutAction}
        onClose={() => menu.current?.focus()}
      />
    </header>
  );
}
