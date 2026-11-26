"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";

/**
 * "Añadir imágenes" (spec 012 RF-1, RF-2). `image/*` without `capture`: on
 * the phone it offers both the camera and the gallery (plan D9).
 */
export function ImagePicker({
  onPick,
  disabled = false,
}: {
  onPick: (files: File[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="self-start"
      >
        {t("Añadir imágenes")}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Lets the same file be chosen again after a failure.
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
    </>
  );
}
