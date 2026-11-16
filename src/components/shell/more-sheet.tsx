"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { NAV_ITEMS, SHEET_SECTIONS, type Section } from "@/lib/shell/nav";
import { BAR_ICON, BAR_ITEM, TAB_ITEM } from "./bar-styles";
import { MoreIcon, SECTION_ICONS, SignOutIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const ROW =
  "press-quiet flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-base font-medium text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-stone";

/**
 * The rest of the destinations up to 1023 px, in a native <dialog> sheet
 * from the bottom: focus trap and Escape come with it (spec 005 RF-18, plan
 * D9; spec 025 RF-8).
 */
export function MoreSheet({
  current,
  signOutAction,
  variant = "bar",
}: {
  current: Section | null;
  signOutAction: () => Promise<void>;
  /** In the phone's floating bar, or as a tab of the desktop navigation. */
  variant?: "bar" | "tab";
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = () => sheet.current?.close();

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-current={
          current && SHEET_SECTIONS.includes(current) ? "page" : undefined
        }
        onClick={() => sheet.current?.showModal()}
        className={variant === "tab" ? TAB_ITEM : BAR_ITEM}
      >
        <span className={BAR_ICON}>
          <MoreIcon />
        </span>
        <span className={variant === "tab" ? "max-lg:sr-only" : undefined}>
          Más
        </span>
      </button>
      <dialog
        ref={sheet}
        aria-labelledby={titleId}
        data-sheet=""
        onClose={() => trigger.current?.focus()}
        className="mx-0 mt-auto mb-0 w-full max-w-full rounded-t-card surface-float p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink backdrop:bg-scrim/50 tab:m-auto tab:max-w-sm tab:rounded-card"
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-3">
          <h2 id={titleId} className="text-lg font-semibold">
            Más
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-control px-4 font-semibold text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cerrar
          </button>
        </div>
        {/* The destinations land one after another each time it opens (spec 021 RF-16). */}
        <ul data-entering="" className="stagger flex flex-col gap-1">
          {NAV_ITEMS.filter((item) =>
            SHEET_SECTIONS.includes(item.section),
          ).map((item) => {
            const ItemIcon = SECTION_ICONS[item.section];
            return (
              <li key={item.section}>
                <Link
                  href={item.href}
                  onClick={close}
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
      </dialog>
    </>
  );
}
