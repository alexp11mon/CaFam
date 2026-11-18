import { z } from "zod";
import { commentRowFor } from "@/lib/comments/queries";
import {
  getImageErrorMessage,
  IMAGE_MESSAGES,
} from "@/lib/images/error-messages";
import { FULL_SIDE } from "@/lib/images/limits";
import {
  IMAGES_BUCKET,
  objectPath,
  type ImageVariant,
} from "@/lib/images/paths";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { materializeWith, type Supabase } from "./events/event-writes";

// An image added offline, uploaded later by the app or the service worker
// (spec 035 RF-39 to RF-41, plan D5 to D7): reserve with the limits of
// always, signed upload URLs made with the user's session, then confirm.
// Not a "use server" file: the route answers with HTTP statuses.

const eventId = z.string().refine((value) => parseEventId(value) !== null);

export const imageOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("reserve"),
    eventId,
    image: z.object({
      bytes: z.int().min(1),
      width: z.int().min(1).max(FULL_SIDE),
      height: z.int().min(1).max(FULL_SIDE),
    }),
    reservedId: z.uuid().optional(),
  }),
  z.object({ op: z.literal("confirm"), id: z.uuid() }),
]);

export type ImageOp = z.infer<typeof imageOpSchema>;

export interface SignedUpload {
  path: string;
  /** Null when the object is already there: a retry after a cut (D7). */
  token: string | null;
  /** The full URL, so the service worker needs no configuration. */
  url: string | null;
}

export type ImageAnswer =
  | {
      status: 200;
      body: { id: string; uploads: Record<ImageVariant, SignedUpload> };
    }
  | { status: 200; body: Record<string, never> }
  | { status: 404 | 409 | 429; body: { error: string } };

const VARIANTS: ImageVariant[] = ["full", "thumb"];

function codeOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

async function signed(
  supabase: Supabase,
  objectId: string,
): Promise<Record<ImageVariant, SignedUpload>> {
  const bucket = supabase.storage.from(IMAGES_BUCKET);
  const [full, thumb] = await Promise.all(
    VARIANTS.map(async (variant) => {
      const path = objectPath(objectId, variant);
      const { data, error } = await bucket.createSignedUploadUrl(path);
      // Storage signs nothing for an object it already has.
      if (error && /already exists/i.test(error.message)) {
        return { path, token: null, url: null };
      }
      if (error) throw error;
      return { path: data.path, token: data.token, url: data.signedUrl };
    }),
  );
  return { full: full!, thumb: thumb! };
}

/** The row that holds the images of an id: an occurrence gets one first. */
async function rowFor(supabase: Supabase, id: string): Promise<string | null> {
  const row = await commentRowFor(supabase, id);
  if (row === null) return null;
  if (row) return row.id;
  const created = await materializeWith(supabase, id);
  return "error" in created ? null : created.eventId;
}

const GONE = { status: 404, body: { error: IMAGE_MESSAGES.gone } } as const;

/** One operation; a network or Supabase failure throws (the route: 503). */
export async function offlineImage(
  supabase: Supabase,
  op: ImageOp,
): Promise<ImageAnswer> {
  if (op.op === "confirm") {
    const { error } = await supabase.rpc("confirm_event_image", {
      p_id: op.id,
    });
    if (!error) return { status: 200, body: {} };
    // Purged after an hour: the client reserves again (D7).
    if (codeOf(error) === "CF404") return GONE;
    // An object is missing: the client uploads again.
    if (codeOf(error) === "P0002") {
      return { status: 409, body: { error: IMAGE_MESSAGES.upload } };
    }
    throw error;
  }

  // A reservation still pending: new URLs for it, never a second one (D7).
  if (op.reservedId) {
    const { data, error } = await supabase
      .from("event_images")
      .select("object_id")
      .eq("id", op.reservedId)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        status: 200,
        body: {
          id: op.reservedId,
          uploads: await signed(supabase, data.object_id),
        },
      };
    }
  }

  const row = await rowFor(supabase, op.eventId);
  if (!row) return GONE;
  const { data: ids, error } = await supabase.rpc("reserve_event_images", {
    p_event_id: row,
    p_images: [op.image],
  });
  if (error) {
    const code = codeOf(error);
    if (code === "CF429") {
      return { status: 429, body: { error: getImageErrorMessage(error) } };
    }
    if (code === "CF404" || code === "23503") return GONE;
    throw error;
  }
  const id = ids?.[0];
  if (!id) return { status: 429, body: { error: IMAGE_MESSAGES.eventFull } };
  const { data: reserved, error: readError } = await supabase
    .from("event_images")
    .select("object_id")
    .eq("id", id)
    .single();
  if (readError) throw readError;
  return {
    status: 200,
    body: { id, uploads: await signed(supabase, reserved.object_id) },
  };
}
