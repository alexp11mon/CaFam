"use client";

import Link from "next/link";
import { useId, type RefObject } from "react";
import { useFollowDrag } from "@/lib/hooks/use-follow-drag";
import { releaseDecision } from "@/lib/motion/release";
import { banded } from "@/lib/motion/rubber-band";
import { NAV_ITEMS, type Section } from "@/lib/shell/nav";
import { useCalendarHeader } from "./calendar-header";
import { SECTION_ICONS, SignOutIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const ROW =
  "press-quiet flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-stone";

/**
 * The phone drawer, a native modal <dialog> from the left: focus trap and
 * Escape come with it (spec 016 RF-12..RF-16, plan D4). The calendar mounts its
 * views and filters in the slot at the top (plan D3).
 */
export function NavDrawer({
  dialog,
  current,
  signOutAction,
  onClose,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  /** Gives the focus back to the menu button (RF-16). */
  onClose: () => void;
  current: Section | null;
  signOutAction: () => Promise<void>;
}) {
  const titleId = useId();
  const { setDrawerSlot } = useCalendarHeader();
  const close = () => dialog.current?.close();
  // It follows a finger to the left and bands to the right (spec 021 RF-30,
  // RF-32). Released past half its width, or flicked, it closes (spec 016
  // RF-15); otherwise CSS slides it back from where the finger left it.
  const follow = useFollowDrag(dialog, {
    offset: (delta) => banded(delta, -Infinity, 0),
    onRelease: (delta, velocity, el) => {
      const width = el.getBoundingClientRect().width;
      el.style.translate = "";
      if (
        releaseDecision({ delta, velocity, threshold: width / 2 }) === "forward"
      )
        close();
    },
  });

  return (
    <dialog
      ref={dialog}
      data-drawer=""
      aria-labelledby={titleId}
      onClose={onClose}
      // The backdrop is the dialog itself; a link inside closes it too (RF-14, RF-15).
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
        else if ((event.target as Element).closest("a")) close();
      }}
      {...follow}
      className="m-0 h-full touch-pan-y max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto rounded-r-3xl glass-float p-0 text-ink backdrop:bg-scrim/50"
    >
      <div className="flex min-h-full flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 pl-3">
          <h2 id={titleId} className="text-lg font-bold">
            CaFam
          </h2>
          {/* The backdrop and the swipe are no use to a screen reader (spec 023 RF-22). */}
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-full px-4 font-semibold text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cerrar
          </button>
        </div>
        <div ref={setDrawerSlot} className="empty:hidden" />
        {/* The destinations land one after another each time it opens (spec 021 RF-16). */}
        <ul
          data-entering=""
          className="stagger flex flex-col gap-1 border-t border-line pt-3"
        >
          {/* The calendar's own views are in the slot; elsewhere it is a way back. */}
          {NAV_ITEMS.filter(
            (item) => item.section !== "calendar" || current !== "calendar",
          ).map((item) => {
            const ItemIcon = SECTION_ICONS[item.section];
            return (
              <li key={item.section}>
                <Link
                  href={item.href}
                  aria-current={item.section === current ? "page" : undefined}
                  className={ROW}
                >
                  <ItemIcon />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <ThemeToggle className={ROW} />
          </li>
          <li>
            <form action={signOutAction}>
              <button type="submit" className={ROW}>
                <SignOutIcon />
                Cerrar sesión
              </button>
            </form>
          </li>
        </ul>
      </div>
    </dialog>
  );
}
