"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PlusIcon } from "@/components/shell/icons";

/** The floating "+" of the phone calendar, in ink as CaFam's primary buttons (spec 016 RF-17, RF-18). */
export function Fab({ href }: { href: string }) {
  // Tells the frame there is a "+", so the assistant button and the toasts go
  // above it (spec 015 RF-39, plan D18). An effect and not CSS :has(), because
  // Activity keeps a hidden calendar in the DOM and runs this cleanup.
  useEffect(() => {
    const frame = document.querySelector("[data-app-frame]");
    frame?.setAttribute("data-has-fab", "");
    return () => frame?.removeAttribute("data-has-fab");
  }, []);
  return (
    <Link
      href={href}
      aria-label="Nuevo evento"
      aria-keyshortcuts="N C"
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-ink text-on-ink shadow-float press hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tab:hidden"
    >
      <PlusIcon />
    </Link>
  );
}
