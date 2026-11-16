import type { ReactNode } from "react";
import { EventClipboardProvider } from "@/components/calendar/event-clipboard";
import { ToastProvider } from "@/components/ui/toast";
import type { AccentId } from "@/lib/theme/accents";
import type { ThemeId } from "@/lib/theme/theme";
import { AssistantFab } from "./assistant-fab";
import { BottomBar } from "./bottom-bar";
import { CalendarHeaderProvider } from "./calendar-header";
import { ThemeSync } from "./theme-sync";
import { CreateButton } from "./create-fab";
import { TopBar } from "./top-bar";
import { TopNav } from "./top-nav";

/**
 * Frame of every screen with a session (constitution, amendment 11; spec 030
 * RF-5, RF-6): on a phone, a thin header, a floating bar and the floating "+"
 * and Venito; from 769 px, a top bar with the tabs. The accent comes from the profile on the server, so the
 * first HTML already has it (spec 005 RF-9, RF-16, RF-18, plan D2, D3, D7).
 */
export function AppFrame({
  accent,
  theme,
  displayName,
  signOutAction,
  children,
}: {
  accent: AccentId;
  /** For the avatar of the phone header (spec 016 RF-6, plan D13). */
  displayName: string;
  /** The theme of the profile, to fix a device with an old cookie (spec 011 RF-4). */
  theme: ThemeId;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div
      data-app-frame=""
      data-accent={accent}
      className="group/frame flex min-h-full flex-1 flex-col"
    >
      {/* First stop of the keyboard: past the navigation (spec 023 RF-18). */}
      <a
        href="#contenido"
        className="sr-only rounded-control bg-ink px-4 py-2 font-semibold text-on-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Saltar al contenido
      </a>
      <ThemeSync theme={theme} />
      <ToastProvider>
        <EventClipboardProvider>
          <CalendarHeaderProvider>
            <TopNav displayName={displayName} signOutAction={signOutAction} />
            <TopBar displayName={displayName} />
            <div
              id="contenido"
              tabIndex={-1}
              // Room for the phone header above and for the floating bar
              // below, with the safe areas of iOS (spec 030 RF-5).
              className="flex flex-1 flex-col pt-[calc(3.25rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none tab:pt-0 tab:pb-0"
            >
              {children}
            </div>
            <CreateButton floating />
            <AssistantFab />
            <BottomBar signOutAction={signOutAction} />
          </CalendarHeaderProvider>
        </EventClipboardProvider>
      </ToastProvider>
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
