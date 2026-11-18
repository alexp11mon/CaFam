"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { useToast } from "@/components/ui/toast";
import { useConnection } from "@/lib/hooks/use-connection";
import { addImagesOffline } from "@/lib/offline/image-actions";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { ImagePicker } from "./image-picker";
import { UploadList } from "./upload-list";
import { useImageUploads } from "./use-image-uploads";

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

  return (
    <section aria-label="Añadir imágenes" className="flex flex-col gap-2">
      <ImagePicker
        onPick={async (files) => {
          if (!online) {
            const result = await addImagesOffline(eventId, files, saved);
            setNotice(result.notice);
            if (result.added > 0)
              show(OFFLINE_MESSAGES.imagesKept(result.added));
            return;
          }
          await uploads.add(files);
          await uploads.upload(eventId);
        }}
      />
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
