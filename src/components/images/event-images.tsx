"use client";

import Image from "next/image";
import { useState } from "react";
import { imageAlt } from "@/lib/images/alt";
import { fitWithin } from "@/lib/images/fit";
import { THUMB_SIDE } from "@/lib/images/limits";
import { objectPath } from "@/lib/images/paths";
import type { EventImage } from "@/lib/images/queries";
import { ImageViewer } from "./image-viewer";
import { useImageBlob } from "./use-image-blob";

function Thumb({
  image,
  alt,
  onOpen,
}: {
  image: EventImage;
  alt: string;
  onOpen: () => void;
}) {
  const blob = useImageBlob(objectPath(image.objectId, "thumb"));
  const size = fitWithin(image.width, image.height, THUMB_SIDE);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver ${alt}`}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-stone press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {blob.status === "ready" ? (
          // blob: URLs cannot go through the image optimizer (plan D10).
          <Image
            src={blob.url}
            alt={alt}
            width={size.width}
            height={size.height}
            unoptimized
            className="size-full object-cover"
          />
        ) : blob.status === "denied" ? (
          <span className="px-2 text-center text-xs text-muted">
            No disponible
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Thumbnails of the event in upload order; nothing without images (spec 012 RF-9, RF-14). */
export function EventImages({
  images,
  title,
  timeZone,
}: {
  images: EventImage[];
  title: string;
  timeZone: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;

  return (
    <section aria-label="Imágenes" className="flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((image, index) => (
          <Thumb
            key={image.id}
            image={image}
            alt={imageAlt(title, index, images.length)}
            onOpen={() => setOpen(index)}
          />
        ))}
      </ul>
      {open !== null ? (
        <ImageViewer
          images={images}
          start={open}
          title={title}
          timeZone={timeZone}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}
