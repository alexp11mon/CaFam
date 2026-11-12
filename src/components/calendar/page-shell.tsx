import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronIcon } from "@/components/shell/icons";
import { NAV_ITEMS } from "@/lib/shell/nav";

/** Common frame of the spec 002 form pages: back link, title and content. */
export function PageShell({
  title,
  backHref = "/dashboard/calendars",
  backLabel = "Volver a Mis calendarios",
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  // The phone header already shows a section's name (spec 023 RF-25, plan D13).
  const inTopBar = NAV_ITEMS.some((item) => item.label === title);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted underline decoration-control underline-offset-4 hover:text-ink"
        >
          <ChevronIcon direction="left" />
          {backLabel}
        </Link>
        <h1
          className={`text-2xl font-bold text-ink ${inTopBar ? "max-tab:sr-only" : ""}`}
        >
          {title}
        </h1>
      </header>
      {children}
    </main>
  );
}
