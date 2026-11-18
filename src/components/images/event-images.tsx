"use client";

import Image from "next/image";
import { useState } from "react";
import { PendingMark } from "@/components/offline/pending-mark";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { imageAlt } from "@/lib/images/alt";
import { fitWithin } from "@/lib/images/fit";
import { THUMB_SIDE } from "@/lib/images/limits";
import { objectPath } from "@/lib/images/paths";
import type { EventImage } from "@/lib/images/queries";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { removePendingImage } from "@/lib/offline/image-actions";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { ImageViewer } from "./image-viewer";
import { useImageBlob, type DeviceImage } from "./use-image-blob";

const TILE =
  "flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-stone";

function Picture({
  path,
  local,
  alt,
  width,
  height,
}: {
  path: string;
  local: DeviceImage;
  alt: string;
  width: number;
  height: number;
}) {
  const blob = useImageBlob(path, local);
  const size = fitWithin(width, height, THUMB_SIDE);
  if (blob.status === "ready") {
    // blob: URLs cannot go through the image optimizer (plan D10).
    return (
      <Image
        src={blob.url}
        alt={alt}
        width={size.width}
        height={size.height}
        unoptimized
        className="size-full object-cover"
      />
    );
  }
  return blob.status === "denied" ? (
    <span className="px-2 text-center text-xs text-muted">No disponible</span>
  ) : null;
}

function Thumb({
  image,
  alt,
  onOpen,
}: {
  image: EventImage;
  alt: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver ${alt}`}
        className={`${TILE} press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
      >
        <Picture
          path={objectPath(image.objectId, "thumb")}
          local={{ id: image.id, kind: "thumb" }}
          alt={alt}
          width={image.width}
          height={image.height}
        />
      </button>
    </li>
  );
}

/** An image added offline, with its mark and "Quitar" (spec 035 RF-35). */
function PendingThumb({
  eventId,
  localId,
  alt,
}: {
  eventId: string;
  localId: string;
  alt: string;
}) {
  const { show } = useToast();
  return (
    <li className="flex flex-col gap-1">
      <div className={TILE}>
        <Picture
          path=""
          local={{ id: localId, kind: "pending" }}
          alt={alt}
          width={THUMB_SIDE}
          height={THUMB_SIDE}
        />
      </div>
      <PendingMark pending label />
      <Button
        variant="quiet"
        aria-label={`${OFFLINE_MESSAGES.remove} ${alt}`}
        onClick={async () => {
          await removePendingImage(eventId, localId);
          show(OFFLINE_MESSAGES.imageRemoved);
        }}
      >
        {OFFLINE_MESSAGES.remove}
      </Button>
    </li>
  );
}

/**
 * Thumbnails of the event in upload order; nothing without images (spec 012
 * RF-9, RF-14). Offline also the ones waiting, and not the ones deleted
 * (spec 035 RF-30, RF-35, RF-37).
 */
export function EventImages({
  images: saved,
  title,
  timeZone,
  eventId,
}: {
  images: EventImage[];
  title: string;
  timeZone: string;
  /** For the queued changes of this event. */
  eventId?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const { queue } = useOfflineQueue();
  const deleted = new Set(
    queue.flatMap(({ change }) =>
      change.type === "image.delete" ? [change.id] : [],
    ),
  );
  const images = saved.filter((image) => !deleted.has(image.id));
  const pending = queue.flatMap(({ change }) =>
    change.type === "image.add" && change.eventId === eventId
      ? [change.localId]
      : [],
  );
  const total = images.length + pending.length;
  if (total === 0) return null;

  return (
    <section aria-label="Imágenes" className="flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((image, index) => (
          <Thumb
            key={image.id}
            image={image}
            alt={imageAlt(title, index, total)}
            onOpen={() => setOpen(index)}
          />
        ))}
        {eventId
          ? pending.map((localId, index) => (
              <PendingThumb
                key={localId}
                eventId={eventId}
                localId={localId}
                alt={imageAlt(title, images.length + index, total)}
              />
            ))
          : null}
      </ul>
      {open !== null ? (
        <ImageViewer
          images={images}
          start={open}
          title={title}
          timeZone={timeZone}
          eventId={eventId}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}
