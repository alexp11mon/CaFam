import { Suspense } from "react";
import { HomeRedirect } from "./home-redirect";

// Every way in (/, the installed app, after signing in) comes here, and the
// account decides: the calendar or "Ahora" (spec 054 RF-25, plan D5). It
// reads the session, so it streams (cacheComponents).
export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={null}>
      <HomeRedirect searchParams={searchParams} />
    </Suspense>
  );
}
