import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { IMAGES_BUCKET } from "./paths";

export type UploadResult = "ok" | "network" | "rejected" | "aborted";

interface UploadOptions {
  path: string;
  blob: Blob;
  accessToken: string;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

// Browser only. XMLHttpRequest instead of supabase-js, whose fetch gives no
// upload progress (spec 012 plan D1; RF-6, RF-24). The storage policy only
// accepts an own reservation (plan D4).
export function uploadObject({
  path,
  blob,
  accessToken,
  onProgress,
  signal,
}: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve("aborted");
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${SUPABASE_URL}/storage/v1/object/${IMAGES_BUCKET}/${path}`,
    );
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => onProgress?.(event.loaded, event.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve("ok");
      // Already there: a retry after the first upload did finish.
      const duplicate =
        xhr.status === 409 || /"statusCode":\s*"409"/.test(xhr.responseText);
      resolve(duplicate ? "ok" : "rejected");
    };
    xhr.onerror = () => resolve("network");
    xhr.onabort = () => resolve("aborted");
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}
