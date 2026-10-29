"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { NAV_ITEMS, type Section } from "@/lib/shell/nav";
import { BAR_ICON, BAR_ITEM } from "./bar-styles";
import { MoreIcon, SECTION_ICONS, SignOutIcon } from "./icons";

const SHEET_SECTIONS: readonly Section[] = [
  "connections",
  "join",
  "import",
  "settings",
];

const ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-stone";

/**
 * The rest of the destinations on a phone, in a native <dialog> sheet: focus
 * trap and Escape come with it (spec 005 RF-18, plan D9).
 */
export function MoreSheet({
  current,
  signOutAction,
}: {
  current: Section | null;
  signOutAction: () => Promise<void>;
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
        className={BAR_ITEM}
      >
        <span className={BAR_ICON}>
          <MoreIcon />
        </span>
        Más
      </button>
      <dialog
        ref={sheet}
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        className="mx-0 mt-auto mb-0 w-full max-w-full rounded-t-3xl bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-float backdrop:bg-scrim/50"
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-3">
          <h2 id={titleId} className="text-lg font-bold">
            Más
          </h2>
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-full px-4 font-semibold text-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cerrar
          </button>
        </div>
        <ul className="flex flex-col gap-1">
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
