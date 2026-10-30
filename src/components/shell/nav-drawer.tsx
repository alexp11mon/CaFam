"use client";

import Link from "next/link";
import { useId, useRef, type PointerEvent, type RefObject } from "react";
import { swipeDirection } from "@/lib/calendar/swipe";
import { NAV_ITEMS, type Section } from "@/lib/shell/nav";
import { useCalendarHeader } from "./calendar-header";
import { SECTION_ICONS, SignOutIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-stone";

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
  const start = useRef<{ x: number; y: number } | null>(null);
  const close = () => dialog.current?.close();

  function onPointerUp(event: PointerEvent) {
    const from = start.current;
    start.current = null;
    if (!from || event.pointerType !== "touch") return;
    // Sliding it back to the left closes it (RF-15).
    if (
      swipeDirection(event.clientX - from.x, event.clientY - from.y) === "next"
    )
      close();
  }

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
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={onPointerUp}
      className="m-0 h-full max-h-none w-[min(20rem,85vw)] max-w-none overflow-y-auto rounded-r-3xl glass-float p-0 text-ink backdrop:bg-scrim/50"
    >
      <div className="flex min-h-full flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 id={titleId} className="px-3 text-lg font-bold">
          CaFam
        </h2>
        <div ref={setDrawerSlot} className="empty:hidden" />
        <ul className="flex flex-col gap-1 border-t border-line pt-3">
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
