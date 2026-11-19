import type { createClient } from "@/lib/supabase/server";
import type { TrashEntry } from "./trash";

type Client = Awaited<ReturnType<typeof createClient>>;

const KINDS = new Set(["event", "occurrence", "series"]);

/** The trash I can see (spec 046 RF-4: RLS of `trash_list`), and when it was read. */
export async function readTrash(
  supabase: Client,
): Promise<{ entries: TrashEntry[]; readAt: string }> {
  const { data, error } = await supabase.rpc("trash_list");
  if (error) throw error;
  const entries = (data ?? []).map((row): TrashEntry => ({
    id: row.id,
    calendarId: row.calendar_id,
    kind: KINDS.has(row.kind) ? (row.kind as TrashEntry["kind"]) : "event",
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    occurrences: row.occurrences ?? null,
    images: row.images ?? 0,
    comments: row.comments ?? 0,
    deletedByName: row.deleted_by_name ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
  return { entries, readAt: new Date().toISOString() };
}
