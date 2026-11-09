import { IMAGE_MESSAGES } from "@/lib/images/error-messages";
import { MAX_SOURCE_BYTES, isAcceptedType } from "@/lib/images/limits";

// What may be attached to a question of the assistant (spec 022, plan
// "attachments"). Pure: it looks at name, type and size, never at pixels.

/** RF-4: images per message. */
export const MAX_ATTACHMENTS = 3;

export const ATTACH_MESSAGES = {
  tooMany: `Puedes adjuntar ${MAX_ATTACHMENTS} imágenes como mucho`,
} as const;

/** RF-5, RF-7, RF-8: refused files say which one and why. */
export function checkAttachments(
  alreadyAttached: number,
  files: readonly File[],
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];
  let tooMany = false;
  for (const file of files) {
    if (!isAcceptedType(file.type, file.name)) {
      errors.push(`${file.name}: ${IMAGE_MESSAGES.type}`);
    } else if (file.size > MAX_SOURCE_BYTES) {
      errors.push(`${file.name}: ${IMAGE_MESSAGES.tooBig}`);
    } else if (alreadyAttached + accepted.length >= MAX_ATTACHMENTS) {
      tooMany = true;
    } else {
      accepted.push(file);
    }
  }
  if (tooMany) errors.push(ATTACH_MESSAGES.tooMany);
  return { accepted, errors };
}
