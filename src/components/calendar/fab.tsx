import Link from "next/link";
import { PlusIcon } from "@/components/shell/icons";

/** The floating "+" of the phone calendar, in ink as CaFam's primary buttons (spec 016 RF-17, RF-18). */
export function Fab({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Nuevo evento"
      aria-keyshortcuts="N"
      className="fixed right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-ink text-on-ink shadow-float press hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tab:hidden"
    >
      <PlusIcon />
    </Link>
  );
}
