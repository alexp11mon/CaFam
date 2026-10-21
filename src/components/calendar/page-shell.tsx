import Link from "next/link";
import type { ReactNode } from "react";

/** Common frame of the spec 002 form pages: back link, title and content. */
export function PageShell({
  title,
  backHref = "/dashboard",
  backLabel = "Volver al panel",
  children,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2 border-b border-ink/10 pb-4">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline"
        >
          ← {backLabel}
        </Link>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
      </header>
      {children}
    </main>
  );
}
