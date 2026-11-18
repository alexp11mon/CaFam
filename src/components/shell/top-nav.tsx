"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { initials } from "@/lib/people/avatar";
import {
  activeSection,
  BAR_SECTIONS,
  NAV_ITEMS,
  type NavItem,
} from "@/lib/shell/nav";
import { TAB_ITEM } from "./bar-styles";
import { CreateButton } from "./create-fab";
import { NavLink } from "./nav-link";
import { SearchIcon, SECTION_ICONS } from "./icons";
import { MoreSheet } from "./more-sheet";
import { ThemeToggle } from "./theme-toggle";
import { ConnectionBadge } from "@/components/offline/connection-badge";

const TABS = BAR_SECTIONS.map(
  (section) => NAV_ITEMS.find((entry) => entry.section === section) as NavItem,
);

const ICON =
  "flex size-10 items-center justify-center rounded-control text-muted press-quiet hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * The navigation from 769 px (constitution, amendment 11; spec 030 RF-6,
 * plan D4): the brand, the destinations as pill tabs in the middle and, on
 * the right, the main action, the theme and the account. No side bar.
 */
export function TopNav({
  displayName,
  signOutAction,
}: {
  displayName: string;
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());

  return (
    <header className="sticky top-0 z-30 bg-stone max-tab:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <Link
          href="/dashboard/calendar"
          className="flex shrink-0 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <LogoMark className="size-8" />
          <span className="text-base font-semibold tracking-tight text-ink">
            CaFam
          </span>
        </Link>
        <nav aria-label="Principal" className="mx-auto">
          <ul className="flex gap-1 rounded-full surface p-1">
            {TABS.map((entry) => {
              const ItemIcon = SECTION_ICONS[entry.section];
              return (
                <li key={entry.section}>
                  <NavLink
                    item={entry}
                    aria-label={entry.label}
                    aria-current={
                      entry.section === current ? "page" : undefined
                    }
                    className={TAB_ITEM}
                  >
                    <ItemIcon />
                    <span className="max-lg:hidden">{entry.label}</span>
                  </NavLink>
                </li>
              );
            })}
            <li>
              <MoreSheet
                current={current}
                signOutAction={signOutAction}
                variant="tab"
              />
            </li>
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          {/* Spec 039 RF-1. */}
          <Link
            href="/dashboard/search"
            aria-label="Buscar"
            aria-keyshortcuts="/"
            className={ICON}
          >
            <SearchIcon />
          </Link>
          <CreateButton floating={false} />
          <ConnectionBadge />
          <ThemeToggle className={ICON} labelClassName="sr-only" />
          <Link
            href="/dashboard/settings"
            aria-label={`Ajustes de ${displayName}`}
            className="ml-1 flex size-10 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
            >
              {initials(displayName)}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
