"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "copied" | "failed";

/**
 * Copies a link to the clipboard (RF-2). If the browser refuses (no permission
 * or no clipboard API), the text is shown selected so it can be copied by hand
 * (plan R6).
 */
export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "failed") field.current?.select();
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" onClick={copy}>
          Copiar enlace
        </Button>
      </div>
      {status === "failed" ? (
        <input
          ref={field}
          readOnly
          value={text}
          aria-label="Enlace"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink"
        />
      ) : null}
      <p role="status" className="text-sm text-ink">
        {status === "copied" ? "Enlace copiado." : null}
        {status === "failed"
          ? "No se ha podido copiar. Copia el enlace seleccionado."
          : null}
      </p>
    </div>
  );
}
