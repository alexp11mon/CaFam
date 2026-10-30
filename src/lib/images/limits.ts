// Limits of the event images (spec 012, plan "Límites"). The database applies
// the per event, per user and total ones again (reserve_event_images).
export const MAX_PER_EVENT = 10;
export const MAX_PER_USER = 300;
/** Before reducing it on the device (RF-21). */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Longer side of the stored image and of its thumbnail (RF-5, plan D3). */
export const FULL_SIDE = 2048;
export const THUMB_SIDE = 400;
export const FULL_QUALITY = 0.82;
export const THUMB_QUALITY = 0.75;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

/** RF-3. Some browsers give HEIC files no type: then the extension decides. */
export function isAcceptedType(type: string, name: string): boolean {
  if (type) return ACCEPTED_TYPES.includes(type);
  return ACCEPTED_EXTENSIONS.test(name);
}
