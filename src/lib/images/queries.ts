import type { SupabaseClient } from "@supabase/supabase-js";
import { authorLabel } from "@/lib/account/author-label";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type CalendarRole = Database["public"]["Enums"]["calendar_role"];

export interface EventImage {
  id: string;
  objectId: string;
  width: number;
  height: number;
  createdAt: string;
  /** "Cuenta borrada" or "un antiguo miembro" for a gone uploader (RF-19). */
  author: string;
  canDelete: boolean;
}

/**
 * Ready images of an event in upload order (spec 012 RF-9, RF-11). The
 * uploader, the owner and editors may delete (RF-15); RLS decides it again.
 */
export async function getEventImages(
  supabase: Client,
  eventId: string,
  userId: string,
  role: CalendarRole,
  members: readonly { userId: string; name: string }[],
): Promise<EventImage[]> {
  const { data, error } = await supabase
    .from("event_images")
    .select("id, object_id, width, height, created_at, uploaded_by")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  const manages = role === "owner" || role === "editor";
  return (data ?? []).map((row) => ({
    id: row.id,
    objectId: row.object_id,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    author: authorLabel(row.uploaded_by, members),
    canDelete: manages || row.uploaded_by === userId,
  }));
}
