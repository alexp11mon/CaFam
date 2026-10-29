"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSection, NAV_ITEMS, type Section } from "@/lib/shell/nav";
import { BAR_ICON, BAR_ITEM } from "./bar-styles";
import { PlusIcon, SECTION_ICONS } from "./icons";
import { MoreSheet } from "./more-sheet";

const BAR_SECTIONS: readonly Section[] = ["calendar", "calendars"];

/** Phone navigation: two destinations, "+ Evento" and the "Más" sheet (spec 005 RF-18, RF-22). */
export function BottomBar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 glass px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between gap-2">
        {NAV_ITEMS.filter((item) => BAR_SECTIONS.includes(item.section)).map(
          (item) => {
            const ItemIcon = SECTION_ICONS[item.section];
            return (
              <li key={item.section}>
                <Link
                  href={item.href}
                  aria-current={item.section === current ? "page" : undefined}
                  className={BAR_ITEM}
                >
                  <span className={BAR_ICON}>
                    <ItemIcon />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          },
        )}
        <li>
          <Link
            href="/dashboard/events/new"
            className="flex min-h-12 items-center gap-1.5 rounded-full bg-ink px-5 text-base font-semibold text-on-ink press hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span className="sr-only">+ Evento</span>
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <PlusIcon />
              Evento
            </span>
          </Link>
        </li>
        <li>
          <MoreSheet current={current} signOutAction={signOutAction} />
        </li>
      </ul>
    </nav>
  );
}
