import { Suspense, type ReactNode } from "react";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";
import { getAccent, requireUser } from "@/lib/calendar/queries";

// Reads the session, so it streams behind <Suspense> (cacheComponents, plan D3).
async function AccentFrame({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireUser();
  const accent = await getAccent(supabase, userId);
  return <AppFrame accent={accent}>{children}</AppFrame>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <AccentFrame>{children}</AccentFrame>
    </Suspense>
  );
}
