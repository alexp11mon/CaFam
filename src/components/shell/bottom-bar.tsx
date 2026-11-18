"use client";

import { usePathname } from "next/navigation";
import {
  activeSection,
  BAR_LABELS,
  BAR_SECTIONS,
  NAV_ITEMS,
  type NavItem,
} from "@/lib/shell/nav";
import { BAR_ICON, BAR_ITEM } from "./bar-styles";
import { NavLink } from "./nav-link";
import { SECTION_ICONS } from "./icons";
import { MoreSheet } from "./more-sheet";

const BAR_ITEMS = BAR_SECTIONS.map(
  (section) => NAV_ITEMS.find((entry) => entry.section === section) as NavItem,
);

/**
 * The navigation of the phone (≤ 768 px): a floating pill over the content
 * with Calendario, Notas, Calendarios and "Más" (constitution, amendment 11;
 * spec 030 RF-5). "+" and Venito float above it, on the right.
 */
export function BottomBar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-card surface-float tab:hidden"
    >
      <ul className="flex">
        {BAR_ITEMS.map((entry) => {
          const ItemIcon = SECTION_ICONS[entry.section];
          return (
            <li key={entry.section} className="flex flex-1">
              <NavLink
                item={entry}
                aria-current={entry.section === current ? "page" : undefined}
                className={BAR_ITEM}
              >
                <span className={BAR_ICON}>
                  <ItemIcon />
                </span>
                {BAR_LABELS[entry.section] ?? entry.label}
              </NavLink>
            </li>
          );
        })}
        <li className="flex flex-1">
          <MoreSheet current={current} signOutAction={signOutAction} />
        </li>
      </ul>
    </nav>
  );
}
