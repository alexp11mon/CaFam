import type { ReactNode } from "react";
import type { AccentId } from "@/lib/theme/accents";

/**
 * Frame of every screen with a session. The accent comes from the profile on
 * the server, so the first HTML already has it (spec 005 RF-9, plan D2, D3).
 */
export function AppFrame({
  accent,
  children,
}: {
  accent: AccentId;
  children: ReactNode;
}) {
  return (
    <div data-accent={accent} className="flex min-h-full flex-1 flex-col">
      {children}
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
