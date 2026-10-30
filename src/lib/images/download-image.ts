import { createClient } from "@/lib/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { IMAGES_BUCKET } from "./paths";

/**
 * Browser only. Downloads an image with the user's session, or null if RLS
 * refuses it (spec 012 plan D5; RF-25, RF-26). Not storage.download(): the
 * CDN caches that URL per token and kept serving an expelled member. A unique
 * query skips the cache, so the database checks every request.
 */
export async function downloadImage(path: string): Promise<Blob | null> {
  try {
    const { data } = await createClient().auth.getSession();
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/authenticated/${IMAGES_BUCKET}/${path}?v=${crypto.randomUUID()}`,
      {
        cache: "no-store",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
      },
    );
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}
