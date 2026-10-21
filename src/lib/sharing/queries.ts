// Read access for the spec 003 pages. Everything goes through RLS and column
// privileges: the owner reads invites without the token hash (P3, RF-11).
import { isInviteToken } from "@/lib/auth/next-path";
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

export interface AccessCodeRecord {
  publicCode: string;
  role: "editor" | "viewer";
  enabled: boolean;
}

/** ID, role and state of the calendar code, never the PIN hash (RF-16). Owner only. */
export async function getAccessCode(
  supabase: Client,
  calendarId: string,
): Promise<AccessCodeRecord | null> {
  const { data, error } = await supabase
    .from("calendar_access_codes")
    .select("public_code, role, enabled")
    .eq("calendar_id", calendarId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role === "owner") return null;
  return {
    publicCode: data.public_code,
    role: data.role,
    enabled: data.enabled,
  };
}

export interface MemberRecord {
  calendarId: string;
  userId: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

/** Name and role of every member of the given calendars, never emails (RF-24). */
export async function getMembers(
  supabase: Client,
  calendarIds: string[],
): Promise<MemberRecord[]> {
  if (calendarIds.length === 0) return [];
  const { data, error } = await supabase.rpc("calendar_members_with_names", {
    p_calendar_ids: calendarIds,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    calendarId: row.calendar_id,
    userId: row.user_id,
    name: row.display_name,
    role: row.role,
  }));
}

export interface InvitePreview {
  calendarName: string;
  ownerName: string;
  role: "editor" | "viewer";
  alreadyMember: boolean;
}

/** What an invite grants, without joining (RF-5). Null for any invalid invite (RF-8). */
export async function getInvitePreview(
  supabase: Client,
  token: string,
): Promise<InvitePreview | null> {
  if (!isInviteToken(token)) return null;
  const { data, error } = await supabase.rpc("get_invite_preview", {
    p_token: token,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row || row.role === "owner") return null;
  return {
    calendarName: row.calendar_name,
    ownerName: row.owner_name,
    role: row.role,
    alreadyMember: row.already_member,
  };
}
