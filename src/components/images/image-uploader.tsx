"use client";

import { useRouter } from "next/navigation";
import { ImagePicker } from "./image-picker";
import { UploadList } from "./upload-list";
import { useImageUploads } from "./use-image-uploads";

/**
 * Adding images to an existing event from its detail, for any member (spec
 * 012 RF-1, RF-2, RF-4, RF-8). Once stored, the detail and the views refresh.
 */
export function ImageUploader({ eventId }: { eventId: string }) {
  const router = useRouter();
  const uploads = useImageUploads(router.refresh);

  return (
    <section aria-label="Añadir imágenes" className="flex flex-col gap-2">
      <ImagePicker
        onPick={async (files) => {
          await uploads.add(files);
          await uploads.upload(eventId);
        }}
      />
      <UploadList
        items={uploads.items}
        notice={uploads.notice}
        onCancel={uploads.remove}
        onRetry={uploads.retry}
      />
    </section>
  );
}
