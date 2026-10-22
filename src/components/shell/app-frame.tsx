import type { ReactNode } from "react";
import type { AccentId } from "@/lib/theme/accents";
import { BottomBar } from "./bottom-bar";
import { SideRail } from "./side-rail";

/**
 * Frame of every screen with a session: the side rail from 1024 px, the
 * bottom bar below. The accent comes from the profile on the server, so the
 * first HTML already has it (spec 005 RF-9, RF-16, RF-18, plan D2, D3, D7).
 */
export function AppFrame({
  accent,
  signOutAction,
  children,
}: {
  accent: AccentId;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div data-accent={accent} className="flex min-h-full flex-1 flex-col">
      <SideRail signOutAction={signOutAction} />
      <div className="flex flex-1 flex-col pb-24 lg:pb-0 lg:pl-20">
        {children}
      </div>
      <BottomBar signOutAction={signOutAction} />
    </div>
  );
}

/** Shown while the profile loads: neutral, so red never flashes (RF-9). */
export function FrameSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p role="status" className="text-muted">
        Cargando…
      </p>
    </div>
  );
}
