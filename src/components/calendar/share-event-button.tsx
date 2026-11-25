"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { eventIcs } from "@/lib/share/event-ics";
import { shareText, type ShareableEvent } from "@/lib/share/text";

/**
 * "Compartir" of an event, for every member (spec 047 RF-1 to RF-4): the
 * system sheet with the text and, if it takes files, the .ics; without Web
 * Share, a small menu to copy or download. Images and comments never go.
 */
export function ShareEventButton({
  event,
  timeZone,
  className = "",
}: {
  event: ShareableEvent;
  timeZone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const { show } = useToast();
  const text = shareText(event, timeZone);

  async function share() {
    if (!navigator.share) {
      setOpen((now) => !now);
      return;
    }
    const ics = eventIcs(event, new Date());
    const file = new File([ics.text], ics.filename, { type: "text/calendar" });
    const files = navigator.canShare?.({ files: [file] }) ? [file] : null;
    try {
      await navigator.share({
        title: event.title,
        text,
        ...(files ? { files } : {}),
      });
    } catch (error) {
      // Closing the sheet is not an error; anything else falls back to the menu.
      if ((error as DOMException)?.name !== "AbortError") setOpen(true);
    }
  }

  async function copy(value: string, done: string) {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(value);
      show(done);
    } catch {
      show("No se pudo copiar");
    }
  }

  function download() {
    setOpen(false);
    const ics = eventIcs(event, new Date());
    const url = URL.createObjectURL(
      new Blob([ics.text], { type: "text/calendar" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ics.filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={share}
        className="self-start"
      >
        Compartir
      </Button>
      {open ? (
        <div
          id={menuId}
          className="flex flex-col gap-2 rounded-control border border-line bg-paper p-3"
        >
          <Button
            variant="secondary"
            onClick={() => copy(text, "Texto copiado")}
          >
            Copiar texto
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              copy(
                `${location.origin}/dashboard/events/${event.id}`,
                "Enlace copiado",
              )
            }
          >
            Copiar enlace
          </Button>
          <Button variant="secondary" onClick={download}>
            Descargar .ics
          </Button>
          <p className="text-sm text-muted">
            El enlace solo funciona para quien ya comparte el calendario
          </p>
        </div>
      ) : null}
    </div>
  );
}
