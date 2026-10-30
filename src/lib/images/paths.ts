// Storage layout of the event images (spec 012, plan "Bucket event-images").
export const IMAGES_BUCKET = "event-images";

export type ImageVariant = "full" | "thumb";

export function objectPath(objectId: string, variant: ImageVariant): string {
  return `${objectId}/${variant}.jpg`;
}
