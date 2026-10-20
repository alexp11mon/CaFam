import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, the service worker, the manifest
    // and static files with an extension.
    "/((?!_next/static|_next/image|sw\.js|manifest\.webmanifest|.*\.(?:ico|png|jpg|jpeg|gif|svg|webp|txt|xml|js|css|woff2?)$).*)",
  ],
};
