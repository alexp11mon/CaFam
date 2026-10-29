import { Suspense, type ReactNode } from "react";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";
import { getAppearance, requireUser } from "@/lib/calendar/queries";
import { signOut } from "../(auth)/actions";

// Reads the session, so it streams behind <Suspense> (cacheComponents, plan D3).
async function AccentFrame({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireUser();
  const { accent, theme } = await getAppearance(supabase, userId);
  return (
    <AppFrame accent={accent} theme={theme} signOutAction={signOut}>
      {children}
    </AppFrame>
  );
}

export default function DashboardLayout({
  children,
  modal,
}: {
  children: ReactNode;
  /** Intercepted event routes shown over the page (spec 008 plan D1). */
  modal: ReactNode;
}) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <AccentFrame>
        {children}
        {modal}
      </AccentFrame>
    </Suspense>
  );
}
