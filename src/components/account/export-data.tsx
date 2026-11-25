"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { exportFileName } from "@/lib/export/account-files";
import {
  asksAboutImages,
  exportEntries,
  imagePaths,
  type AccountExport,
} from "@/lib/export/account-export";
import { zipStore } from "@/lib/export/zip-store";
import { downloadImage } from "@/lib/images/download-image";
import { objectPath } from "@/lib/images/paths";

// Spec 049, T5: "Descargar mis datos" builds the .zip in the browser, with
// progress and "Cancelar" (RF-12, RF-15; plan D1).

export const EXPORT_TEXTS = {
  failed: "No se han podido preparar tus datos. Inténtalo de nuevo.",
  done: "Listo: revisa tus descargas.",
  cancelled: "Descarga cancelada.",
} as const;

type Phase =
  | { kind: "idle"; note?: string }
  | { kind: "busy"; text: string }
  | { kind: "ask"; data: AccountExport }
  | { kind: "error" };

export interface ExportDeps {
  load: () => Promise<AccountExport | null>;
  loadIcs: (calendarId: string) => Promise<string | null>;
  image?: (path: string) => Promise<Blob | null>;
  save?: (blob: Blob, name: string) => void;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportData({
  load,
  loadIcs,
  image = downloadImage,
  save = saveBlob,
}: ExportDeps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const run = useRef(0);

  async function build(data: AccountExport, withImages: boolean, id: number) {
    const live = () => run.current === id;
    const ics = new Map<string, string>();
    let step = 0;
    for (const calendar of data.calendars) {
      setPhase({
        kind: "busy",
        text: `Calendarios: ${++step} de ${data.calendars.length}`,
      });
      const text = await loadIcs(calendar.id);
      if (!live()) return;
      if (text !== null) ics.set(calendar.id, text);
    }
    const files: { path: string; data: Uint8Array }[] = [];
    if (withImages) {
      const paths = imagePaths(data.images);
      for (const [index, item] of data.images.entries()) {
        setPhase({
          kind: "busy",
          text: `Imágenes: ${index + 1} de ${data.images.length}`,
        });
        const blob = await image(objectPath(item.objectId, "full"));
        if (!live()) return;
        if (blob) {
          files.push({
            path: paths[index]!,
            data: new Uint8Array(await blob.arrayBuffer()),
          });
        }
      }
    }
    const now = new Date();
    save(
      zipStore(exportEntries(data, ics, files, withImages, now), now),
      exportFileName(now),
    );
    setPhase({ kind: "idle", note: EXPORT_TEXTS.done });
  }

  async function start() {
    const id = ++run.current;
    setPhase({ kind: "busy", text: "Leyendo tus datos…" });
    const data = await load();
    if (run.current !== id) return;
    if (!data) return setPhase({ kind: "error" });
    if (asksAboutImages(data)) return setPhase({ kind: "ask", data });
    await build(data, data.images.length > 0, id).catch(() =>
      setPhase({ kind: "error" }),
    );
  }

  function choose(data: AccountExport, withImages: boolean) {
    const id = ++run.current;
    build(data, withImages, id).catch(() => setPhase({ kind: "error" }));
  }

  function cancel() {
    run.current++;
    setPhase({ kind: "idle", note: EXPORT_TEXTS.cancelled });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Un archivo .zip con tu perfil, tus calendarios (.ics), tus comentarios,
        tus notas y las imágenes que subiste. Se prepara en este dispositivo.
      </p>
      {phase.kind === "error" ? (
        <FormAlert message={EXPORT_TEXTS.failed} />
      ) : null}
      {phase.kind === "busy" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-ink tabular-nums">
            {phase.text}
          </p>
          <Button variant="secondary" onClick={cancel}>
            Cancelar
          </Button>
        </div>
      ) : phase.kind === "ask" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink">
            Has subido {phase.data.images.length} imágenes: el archivo puede
            pasar de 500 MB. ¿Las incluyo?
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => choose(phase.data, true)}>
              Incluir imágenes
            </Button>
            <Button
              variant="secondary"
              onClick={() => choose(phase.data, false)}
            >
              Sin imágenes
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {phase.kind === "idle" && phase.note ? (
            <p role="status" className="text-sm text-ink">
              {phase.note}
            </p>
          ) : null}
          <div>
            <Button variant="secondary" onClick={start}>
              Descargar mis datos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
