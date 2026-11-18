"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { activeSection, createHref } from "@/lib/shell/nav";
import { PlusIcon } from "./icons";

/**
 * "+" (constitution, amendment 11; spec 030 RF-5, RF-6, plan D3): it creates
 * what the screen is about, a note in Notas and an event anywhere else, on
 * the date the calendar shows. A floating round button on a phone, over the
 * navigation; a button with its name in the top bar from 769 px.
 */
export function CreateButton({ floating }: { floating: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const section = activeSection(pathname);
  const creates = section === "notes" ? "Nueva nota" : "Nuevo evento";
  // Spec 037 (D1): on the chat it covered "Enviar"; there one writes to
  // Venito, and the top bar keeps its own "+" from 769 px.
  if (floating && section === "assistant") return null;

  return (
    <Link
      href={createHref(pathname)}
      // The address changes with the period on screen: nothing to prefetch,
      // and the date is read when it is pressed.
      prefetch={false}
      aria-label={floating ? creates : undefined}
      aria-keyshortcuts={section === "calendar" ? "N C" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        router.push(createHref(pathname, window.location.search));
      }}
      className={
        floating
          ? "fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-accent-gradient text-on-accent press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tab:hidden"
          : "flex min-h-10 items-center gap-1.5 rounded-full bg-accent-gradient px-4 text-sm font-medium text-on-accent press hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      }
    >
      <PlusIcon />
      {floating ? null : <span className="max-lg:sr-only">{creates}</span>}
    </Link>
  );
}
