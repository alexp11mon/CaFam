"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { activeSection, NAV_ITEMS } from "@/lib/shell/nav";
import { SECTION_ICONS, SignOutIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

// A row from 1280 px (icon and name); below it, only the icon with its name
// as a tooltip (constitution, amendment 10; spec 025 RF-8).
const ITEM =
  "group relative flex h-12 w-12 items-center justify-center gap-3 rounded-control text-muted press-quiet hover:bg-stone hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[current=page]:bg-accent/15 aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink xl:w-full xl:justify-start xl:px-3";

// The label is the accessible name. Below 1280 px it shows as a tooltip on
// hover and focus (spec 005 plan D8), growing out of its icon (spec 021 RF-7).
const LABEL =
  "max-xl:pointer-events-none max-xl:absolute max-xl:top-1/2 max-xl:left-full max-xl:z-40 max-xl:ml-3 max-xl:origin-left max-xl:-translate-y-1/2 max-xl:scale-(--pop-scale) max-xl:rounded-control max-xl:bg-ink max-xl:px-2.5 max-xl:py-1 max-xl:text-sm max-xl:font-medium max-xl:whitespace-nowrap max-xl:text-on-ink max-xl:opacity-0 max-xl:shadow-float max-xl:transition-[opacity,scale] max-xl:duration-(--motion-pop-out) max-xl:ease-(--ease-out) max-xl:group-hover:scale-100 max-xl:group-hover:opacity-100 max-xl:group-hover:duration-(--motion-pop-in) max-xl:group-focus-visible:scale-100 max-xl:group-focus-visible:opacity-100 max-xl:group-focus-visible:duration-(--motion-pop-in) xl:truncate xl:text-base";

/** Desktop navigation (from 1024 px): the brand, the destinations, the theme and signing out. */
export function SideRail({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const current = activeSection(usePathname());

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center gap-6 border-r border-line bg-paper px-4 py-5 lg:flex xl:w-60 xl:items-stretch"
    >
      <Link
        href="/dashboard/calendar"
        className="flex items-center gap-3 self-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink xl:self-start xl:px-1"
      >
        <LogoMark className="size-11" />
        <span className="text-xl font-extrabold tracking-tight text-ink max-xl:sr-only">
          CaFam
        </span>
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-1 xl:items-stretch">
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
                <span className={LABEL}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <ThemeToggle className={ITEM} labelClassName={LABEL} />
      <form action={signOutAction}>
        <button type="submit" className={ITEM}>
          <SignOutIcon />
          <span className={LABEL}>Cerrar sesión</span>
        </button>
      </form>
    </nav>
  );
}
