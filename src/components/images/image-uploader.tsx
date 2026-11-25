"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { useToast } from "@/components/ui/toast";
import { useConnection } from "@/lib/hooks/use-connection";
import { addImagesOffline } from "@/lib/offline/image-actions";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { ImagePicker } from "./image-picker";
import { UploadList } from "./upload-list";
import { useImageUploads } from "./use-image-uploads";
import {
  dropShared,
  imagesOf,
  PENDING_IMAGES_KEY,
  readShared,
} from "@/lib/share/inbox";

/** Images another app shared, waiting in this tab for an event (spec 047 RF-7). */
function usePendingShare() {
  const [pending, setPending] = useState<{ id: string; files: File[] } | null>(
    null,
  );
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(PENDING_IMAGES_KEY);
    } catch {}
    if (!id) return;
    let live = true;
    void readShared(id).then((item) => {
      const files = item ? imagesOf(item) : [];
      if (live && files.length > 0) setPending({ id: id!, files });
    });
    return () => {
      live = false;
    };
  }, []);
  function take() {
    if (!pending) return [];
    try {
      sessionStorage.removeItem(PENDING_IMAGES_KEY);
    } catch {}
    void dropShared(pending.id);
    setPending(null);
    return pending.files;
  }
  return { files: pending?.files ?? null, take };
}

/**
 * Adding images to an existing event from its detail, for any member (spec
 * 012 RF-1, RF-2, RF-4, RF-8). Once stored, the detail and the views refresh.
 * Offline they wait on the device, within the limits (spec 035 RF-32 to RF-34).
 */
export function ImageUploader({
  eventId,
  saved = 0,
}: {
  eventId: string;
  /** The images the event shows now, for the limit of 10 offline. */
  saved?: number;
}) {
  const router = useRouter();
  const uploads = useImageUploads(router.refresh);
  const online = useConnection();
  const { show } = useToast();
  const [notice, setNotice] = useState<string | null>(null);
  const shared = usePendingShare();

  async function add(files: File[]) {
    if (!online) {
      const result = await addImagesOffline(eventId, files, saved);
      setNotice(result.notice);
      if (result.added > 0) show(OFFLINE_MESSAGES.imagesKept(result.added));
      return;
    }
    await uploads.add(files);
    await uploads.upload(eventId);
  }

  return (
    <section aria-label="Añadir imágenes" className="flex flex-col gap-2">
      {shared.files ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control bg-accent-soft p-3 text-accent-ink">
          <p className="flex-1 text-sm">
            {shared.files.length === 1
              ? "1 imagen compartida espera un evento"
              : `${shared.files.length} imágenes compartidas esperan un evento`}
          </p>
          <Button onClick={() => void add(shared.take())}>Añadir aquí</Button>
        </div>
      ) : null}
      <ImagePicker onPick={add} />
      {online ? (
        <UploadList
          items={uploads.items}
          notice={uploads.notice}
          onCancel={uploads.remove}
          onRetry={uploads.retry}
        />
      ) : (
        <FormAlert message={notice ?? undefined} />
      )}
    </section>
  );
}
