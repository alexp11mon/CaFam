"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { deleteImage } from "@/app/dashboard/events/image-actions";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { imageAlt } from "@/lib/images/alt";
import { objectPath } from "@/lib/images/paths";
import type { EventImage } from "@/lib/images/queries";
import type { ConfirmState } from "@/lib/forms/form-state";
import { useImageBlob } from "./use-image-blob";

// A horizontal drag longer than this changes the image (RF-10).
const SWIPE = 50;

const LINK_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-control bg-paper px-5 py-2 text-base font-semibold text-ink press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function FullImage({ image, alt }: { image: EventImage; alt: string }) {
  const blob = useImageBlob(objectPath(image.objectId, "full"));
  if (blob.status === "denied") {
    return <p className="text-muted">Esta imagen ya no está disponible.</p>;
  }
  if (blob.status === "loading") {
    return <p className="text-muted">Cargando…</p>;
  }
  return (
    <Image
      src={blob.url}
      alt={alt}
      width={image.width}
      height={image.height}
      unoptimized
      className="max-h-full w-auto max-w-full object-contain"
    />
  );
}

function DownloadLink({
  image,
  fileName,
}: {
  image: EventImage;
  fileName: string;
}) {
  const blob = useImageBlob(objectPath(image.objectId, "full"));
  if (blob.status !== "ready") return null;
  return (
    <a href={blob.url} download={fileName} className={LINK_BUTTON}>
      Descargar
    </a>
  );
}

/**
 * Full-screen image with previous and next (buttons, arrow keys and swipe),
 * author, date, download and delete (spec 012 RF-10, RF-11, RF-13, RF-15).
 */
export function ImageViewer({
  images,
  start,
  title,
  timeZone,
  onClose,
}: {
  images: EventImage[];
  start: number;
  title: string;
  timeZone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(start);
  const swipeFrom = useRef<number | null>(null);
  const image = images[Math.min(index, images.length - 1)];

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  if (!image) return null;
  const position = images.indexOf(image);
  const alt = imageAlt(title, position, images.length);
  const go = (delta: number) =>
    setIndex((current) =>
      Math.max(0, Math.min(images.length - 1, current + delta)),
    );
  const when = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(image.createdAt));
  const remove = async (): Promise<ConfirmState> => {
    const result = await deleteImage(image.id);
    return result.error ? { formError: result.error } : { done: "deleted" };
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        // Escape: close through one path, whatever the browser does by default.
        event.preventDefault();
        dialog.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      className="m-0 flex h-dvh max-h-none w-dvw max-w-none flex-col gap-3 bg-stone p-4 text-ink backdrop:bg-scrim/80 not-open:hidden sm:p-6"
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted">
            <span className="tabular-nums">
              Imagen {position + 1} de {images.length}
            </span>
            {" · "}Subida por {image.author}
            {" · "}
            <span className="tabular-nums">{when}</span>
          </p>
        </div>
        <Button variant="secondary" onClick={() => dialog.current?.close()}>
          Cerrar
        </Button>
      </header>
      <div
        data-testid="viewer-stage"
        className="flex min-h-0 flex-1 touch-pan-y items-center justify-center"
        onPointerDown={(event) => {
          swipeFrom.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (swipeFrom.current === null) return;
          const delta = event.clientX - swipeFrom.current;
          swipeFrom.current = null;
          if (delta <= -SWIPE) go(1);
          if (delta >= SWIPE) go(-1);
        }}
      >
        <FullImage key={image.id} image={image} alt={alt} />
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="secondary"
          onClick={() => go(-1)}
          disabled={position === 0}
        >
          Anterior
        </Button>
        <Button
          variant="secondary"
          onClick={() => go(1)}
          disabled={position === images.length - 1}
        >
          Siguiente
        </Button>
        <DownloadLink
          key={`download-${image.id}`}
          image={image}
          fileName={`${title.replace(/[\\/:*?"<>|]/g, "-")}-${position + 1}.jpg`}
        />
        {image.canDelete ? (
          <ConfirmDialog
            key={`delete-${image.id}`}
            triggerLabel="Borrar imagen"
            title="¿Borrar esta imagen?"
            description="La imagen se borrará de forma definitiva para todos."
            confirmLabel="Sí, borrar"
            action={remove}
            onDone={() => {
              dialog.current?.close();
              router.refresh();
            }}
          />
        ) : null}
      </footer>
    </dialog>
  );
}
