"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";
import { SECTION_ICONS, SignOutIcon } from "./icons";

const ITEM =
  "group relative flex size-12 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-paper aria-[current=page]:text-ink";

// The label is the accessible name; it shows as a tooltip on hover and focus (plan D8).
const TOOLTIP =
  "pointer-events-none absolute top-1/2 left-full z-40 ml-3 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-sm font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

/** Desktop navigation: the brand, the destinations and signing out (spec 005 RF-16, RF-20). */
export function SideRail({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center gap-6 border-r border-line bg-stone py-5 lg:flex"
    >
      <Link
        href="/dashboard/calendar"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-ink text-base font-extrabold tracking-tight text-stone"
        >
          CF
        </span>
        <span className="sr-only">CalenderFam</span>
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const ItemIcon = SECTION_ICONS[item.section];
          return (
            <li key={item.section}>
              <Link
                href={item.href}
                aria-current={item.section === current ? "page" : undefined}
                className={ITEM}
              >
                <ItemIcon />
                <span className={TOOLTIP}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <form action={signOutAction}>
        <button type="submit" className={ITEM}>
          <SignOutIcon />
          <span className={TOOLTIP}>Cerrar sesión</span>
        </button>
      </form>
    </nav>
  );
}
