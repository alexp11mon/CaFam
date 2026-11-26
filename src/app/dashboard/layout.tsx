import { Suspense, type ReactNode } from "react";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";
import { getAppearance, requireUser } from "@/lib/calendar/queries";
import { signOut } from "../(auth)/actions";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { EN } from "@/i18n/en";

// Reads the session, so it streams behind <Suspense> (cacheComponents, plan D3).
async function AccentFrame({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireUser();
  const { accent, theme, displayName, locale } = await getAppearance(
    supabase,
    userId,
  );
  // The English catalog travels only to English accounts (spec 053 plan D9).
  return (
    <LocaleProvider locale={locale} messages={locale === "en" ? EN : null}>
      <AppFrame
        accent={accent}
        theme={theme}
        displayName={displayName}
        userId={userId}
        signOutAction={signOut}
      >
        {children}
      </AppFrame>
    </LocaleProvider>
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
