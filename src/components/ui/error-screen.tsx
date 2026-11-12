import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/**
 * The screen of a missing page or a failure: the brand, what happened and a
 * way out, as `/offline` (spec 023 RF-16, RF-17, plan D11).
 */
export function ErrorScreen({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Logo />
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="text-muted">{text}</p>
        <div className="flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </main>
  );
}
