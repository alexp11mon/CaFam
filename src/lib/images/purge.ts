import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
import { IMAGES_BUCKET, objectPath } from "./paths";

const BATCH = 100;

/** Server only: the publishable key without a session plus the cron secret (plan D7, P4). */
export function purgeDeps() {
  return {
    supabase: createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    }),
    secret: process.env.CRON_SECRET ?? "",
  };
}

/**
 * Removes queued objects from Storage (spec 012, plan D7). The secret claims
 * them, which lets the publishable key remove them for 5 minutes; only what
 * Storage removed is confirmed, the rest is retried in the next run. Without
 * `objectIds` it goes through the whole queue in batches. Returns how many
 * images were removed.
 */
export async function purgeObjects(
  supabase: SupabaseClient<Database>,
  secret: string,
  objectIds?: string[],
): Promise<number> {
  let removed = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await supabase.rpc("images_claim_purge", {
      p_secret: secret,
      p_limit: BATCH,
      ...(objectIds ? { p_object_ids: objectIds } : {}),
    });
    if (error) throw new Error(error.message);
    const claimed = data ?? [];
    if (claimed.length === 0) break;

    const { error: removeError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .remove(
        claimed.flatMap((id) => [
          objectPath(id, "full"),
          objectPath(id, "thumb"),
        ]),
      );
    if (removeError) break;

    const { error: doneError } = await supabase.rpc("images_done_purge", {
      p_secret: secret,
      p_object_ids: claimed,
    });
    if (doneError) throw new Error(doneError.message);
    removed += claimed.length;
    if (objectIds || claimed.length < BATCH) break;
  }
  return removed;
}
