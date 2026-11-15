"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  activeSection,
  BAR_LABELS,
  BAR_SECTIONS,
  createHref,
  NAV_ITEMS,
  type NavItem,
} from "@/lib/shell/nav";
import { BAR_ICON, BAR_ITEM } from "./bar-styles";
import { PlusIcon, SECTION_ICONS } from "./icons";
import { MoreSheet } from "./more-sheet";

const item = (section: string) =>
  NAV_ITEMS.find((entry) => entry.section === section) as NavItem;
const BAR_ITEMS = BAR_SECTIONS.map(item);

/**
 * The navigation up to 1023 px, where the thumb is (constitution, amendment
 * 10; spec 025 RF-8, plan D7): Calendario and Notas, "+" in the middle,
 * Calendarios and "Más". "+" creates what the screen is about, which frees
 * the bottom right corner for the assistant.
 */
export function BottomBar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeSection(pathname);
  const creates = current === "notes" ? "Nueva nota" : "Nuevo evento";

  const destination = (entry: NavItem) => {
    const ItemIcon = SECTION_ICONS[entry.section];
    return (
      <li key={entry.section} className="flex-1">
        <Link
          href={entry.href}
          aria-current={entry.section === current ? "page" : undefined}
          className={BAR_ITEM}
        >
          <span className={BAR_ICON}>
            <ItemIcon />
          </span>
          {BAR_LABELS[entry.section] ?? entry.label}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 surface-float px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-center">
        {BAR_ITEMS.slice(0, 2).map(destination)}
        <li className="flex flex-1 justify-center">
          <Link
            href={createHref(pathname)}
            // The address changes with the period on screen: nothing to
            // prefetch, and the date is read when it is pressed.
            prefetch={false}
            aria-label={creates}
            aria-keyshortcuts={current === "calendar" ? "N C" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              router.push(createHref(pathname, window.location.search));
            }}
            className="flex size-14 items-center justify-center rounded-full border border-accent-edge bg-accent text-on-accent shadow-soft press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <PlusIcon />
          </Link>
        </li>
        {BAR_ITEMS.slice(2).map(destination)}
        <li className="flex-1">
          <MoreSheet current={current} signOutAction={signOutAction} />
        </li>
      </ul>
    </nav>
  );
}
