// Reads for the account screens (spec 006). Everything goes through the user's
// session: Auth for the addresses, RLS for the rows.
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Current address and the one waiting for confirmation, if any (RF-10). */
export async function getAccountEmails(
  supabase: Client,
): Promise<{ email: string; pendingEmail: string | null }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return {
    email: data.user?.email ?? "",
    pendingEmail: data.user?.new_email ?? null,
  };
}
