"use client";

import Link from "next/link";
import { useRef, type RefObject } from "react";
import { CloseIcon, ImageIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { useT } from "@/components/i18n/locale-provider";

export interface Attachment {
  id: string;
  url: string;
}

/**
 * "Adjuntar imagen" of the assistant (spec 022 RF-1, RF-2, RF-10, RF-58).
 * `image/*` without `capture`: the phone offers the camera and the gallery
 * (plan D9). The images live only in the chat's memory (RF-13).
 */
export function ImageAttach({
  disabled,
  onPick,
  picker,
}: {
  disabled: boolean;
  onPick: (files: File[]) => void;
  /** The file input, when something else must open it too (a suggestion). */
  picker?: RefObject<HTMLInputElement | null>;
}) {
  const t = useT();
  const own = useRef<HTMLInputElement>(null);
  const input = picker ?? own;
  return (
    <>
      <IconButton
        label={t("Adjuntar imagen")}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <ImageIcon />
      </IconButton>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Lets the same file be chosen again after removing it.
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
    </>
  );
}

/** Where the images go, said before the first one is sent (spec 022 RF-58). */
export function AttachNote() {
  const t = useT();
  return (
    <p className="text-xs text-muted">
      {t(
        "Si el cuadrante tiene muchas personas, recorta la foto a la fila de las fechas y la tuya. Las imágenes se envían a Groq para leerlas; CaFam no las guarda.",
      )}{" "}
      <Link
        href="/privacy"
        className="font-semibold text-ink underline decoration-control underline-offset-4"
      >
        {t("Privacidad")}
      </Link>
    </p>
  );
}

/** The images waiting to be sent, over the input, and why one was refused. */
export function AttachPreview({
  attachments,
  errors,
  onRemove,
}: {
  attachments: readonly Attachment[];
  errors: readonly string[];
  onRemove: (id: string) => void;
}) {
  const t = useT();
  if (attachments.length === 0 && errors.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 ? (
        <ul
          aria-label={t("Imágenes para enviar")}
          className="flex flex-wrap gap-2"
        >
          {attachments.map((attachment, index) => (
            <li key={attachment.id} className="relative">
              {/* A data URL kept in memory: next/image would not help here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={t("Imagen {value} para enviar", { value: index + 1 })}
                className="size-16 rounded-control border border-line object-cover"
              />
              <button
                type="button"
                aria-label={t("Quitar imagen {value}", { value: index + 1 })}
                onClick={() => onRemove(attachment.id)}
                className="absolute -top-2 -right-2 flex size-11 items-center justify-center rounded-full press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-full bg-ink text-on-ink [&_svg]:size-4"
                >
                  <CloseIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {errors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
