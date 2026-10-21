// Read access for the spec 003 pages. Everything goes through RLS and column
// privileges: the owner reads invites without the token hash (P3, RF-11).
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface InviteRecord {
  id: string;
  role: "editor" | "viewer";
  maxUses: number;
  useCount: number;
  expiresAt: string;
}

/**
 * Invites of a calendar that are not revoked, newest first. Expired and spent
 * ones are filtered where they are shown, with the server time. Only the
 * owner gets rows; for anyone else RLS returns none.
 */
export async function getInvites(
  supabase: Client,
  calendarId: string,
): Promise<InviteRecord[]> {
  const { data, error } = await supabase
    .from("calendar_invites")
    .select("id, role, max_uses, use_count, expires_at")
    .eq("calendar_id", calendarId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.role === "owner"
      ? []
      : [
          {
            id: row.id,
            role: row.role,
            maxUses: row.max_uses,
            useCount: row.use_count,
            expiresAt: row.expires_at,
          },
        ],
  );
}
