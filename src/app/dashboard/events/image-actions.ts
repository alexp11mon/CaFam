"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionUser } from "@/lib/calendar/queries";
import {
  IMAGE_MESSAGES,
  fitNotice,
  getImageErrorMessage,
} from "@/lib/images/error-messages";
import { FULL_SIDE, MAX_PER_EVENT } from "@/lib/images/limits";
import { purgeDeps, purgeObjects } from "@/lib/images/purge";
import {
  RECURRENCE_MESSAGES,
  recurrenceErrorMessage,
} from "@/lib/recurrence/error-messages";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { findOccurrence } from "@/lib/recurrence/read-series";
import { cronSecret } from "@/lib/recurrence/server-secret";

// Spec 012, plan "Server Actions": the bytes go straight from the browser to
// Storage (plan D1); these only reserve, confirm and delete rows.

const GONE_IMAGE = "Esta imagen ya no existe.";

const idSchema = z.uuid();
const imagesSchema = z
  .array(
    z.object({
      bytes: z.int().min(1),
      width: z.int().min(1).max(FULL_SIDE),
      height: z.int().min(1).max(FULL_SIDE),
    }),
  )
  .min(1)
  .max(MAX_PER_EVENT);

export type ImageSpec = z.infer<typeof imagesSchema>[number];

type Reserved = { ids: string[]; notice?: string } | { error: string };

function refresh() {
  // The detail and the image marks of the views (RF-12).
  revalidatePath("/dashboard", "layout");
}

/**
 * The row of an occurrence, created unchanged the first time: a series never
 * holds images, each occurrence keeps its own (spec 013 RF-24, plan D7). Any
 * member may, so it goes through materialize_occurrence with the cron secret
 * once ical.js confirms the occurrence (SQL cannot expand rules, plan D8).
 */
export async function materializeOccurrence(
  occurrenceId: string,
): Promise<{ eventId: string } | { error: string }> {
  const parsed = parseEventId(occurrenceId);
  if (parsed?.kind !== "occurrence") return { error: RECURRENCE_MESSAGES.gone };
  const { supabase } = await requireActionUser();
  // RLS: only a member reads the series.
  const { data: series, error: readError } = await supabase
    .from("events")
    .select(
      "id, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates",
    )
    .eq("id", parsed.seriesId)
    .maybeSingle();
  if (readError) return { error: IMAGE_MESSAGES.upload };
  if (!series || !findOccurrence(series, parsed.originalStart)) {
    return { error: RECURRENCE_MESSAGES.gone };
  }
  const { data, error } = await supabase.rpc("materialize_occurrence", {
    p_secret: cronSecret(),
    p_series_id: parsed.seriesId,
    p_original_start: parsed.originalStart,
  });
  if (error) {
    return { error: recurrenceErrorMessage(error) ?? IMAGE_MESSAGES.upload };
  }
  return { eventId: data };
}

/** Reserves room for the chosen images; fewer ids than asked means the event is nearly full (RF-20). */
export async function reserveImages(
  eventId: string,
  images: ImageSpec[],
): Promise<Reserved> {
  const event = parseEventId(eventId);
  const specs = imagesSchema.safeParse(images);
  if (!event || !specs.success) {
    return { error: IMAGE_MESSAGES.upload };
  }
  let rowId: string;
  if (event.kind === "occurrence") {
    const row = await materializeOccurrence(eventId);
    if ("error" in row) return row;
    rowId = row.eventId;
  } else {
    rowId = event.id;
  }
  const { supabase } = await requireActionUser();
  const { data, error } = await supabase.rpc("reserve_event_images", {
    p_event_id: rowId,
    p_images: specs.data,
  });
  if (error) return { error: getImageErrorMessage(error) };
  const ids = data ?? [];
  const notice = fitNotice(specs.data.length, ids.length);
  return notice ? { ids, notice } : { ids };
}

/** Once both objects are in Storage. */
export async function confirmImage(id: string): Promise<{ error?: string }> {
  if (!idSchema.safeParse(id).success) return { error: IMAGE_MESSAGES.upload };
  const { supabase } = await requireActionUser();
  const { error } = await supabase.rpc("confirm_event_image", { p_id: id });
  if (error) return { error: getImageErrorMessage(error) };
  refresh();
  return {};
}

async function removeImage(id: string): Promise<{ error?: string }> {
  if (!idSchema.safeParse(id).success) return { error: GONE_IMAGE };
  const { supabase } = await requireActionUser();
  const { data, error } = await supabase
    .from("event_images")
    .delete()
    .eq("id", id)
    .select("object_id");
  if (error) return { error: getImageErrorMessage(error) };
  if (!data || data.length === 0) {
    // RLS hides the row or refuses the delete without an error (RF-15).
    const { data: visible } = await supabase
      .from("event_images")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    return { error: visible ? IMAGE_MESSAGES.forbidden : GONE_IMAGE };
  }
  // The trigger queued the objects; if this fails the hourly purge does it (plan D7).
  try {
    const { supabase: anon, secret } = purgeDeps();
    await purgeObjects(
      anon,
      secret,
      data.map((row) => row.object_id),
    );
  } catch {}
  return {};
}

/** Uploader, owner or editor, after confirming (RF-15). */
export async function deleteImage(id: string): Promise<{ error?: string }> {
  const result = await removeImage(id);
  if (!result.error) refresh();
  return result;
}

/** Drops an own reservation whose upload was cancelled (RF-6). */
export async function cancelImage(id: string): Promise<{ error?: string }> {
  return removeImage(id);
}
