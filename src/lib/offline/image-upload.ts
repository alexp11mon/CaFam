import { IMAGE_MESSAGES } from "@/lib/images/error-messages";
import { setReservedId, type PendingImage } from "./db";

// Uploading an image added offline (spec 035 RF-39 to RF-41, plan D6, D7):
// reserve (or reuse the reservation), save its id before uploading, upload
// the two objects at once to the signed URLs, confirm. The service worker
// does the same with its own copy (T9).

export type PutResult = "ok" | "network" | "rejected";

export interface UploadDeps {
  /** POST /api/offline/image. */
  post(
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: unknown }>;
  put(
    url: string,
    blob: Blob,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<PutResult>;
  setReservedId(localId: string, id: string | null): Promise<void>;
}

export type UploadResult =
  | { status: "applied" }
  | { status: "rejected"; reason: string }
  | { status: "retry" }
  | { unauthenticated: true };

interface Reserved {
  id: string;
  /** A null URL: that object is already uploaded. */
  uploads: { full: { url: string | null }; thumb: { url: string | null } };
}

function reasonOf(body: unknown): string {
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? (body as { error: unknown }).error
      : null;
  return typeof error === "string" ? error : IMAGE_MESSAGES.upload;
}

/** Answers that are not a success: refused for good, or try again later. */
function failure(status: number, body: unknown): UploadResult {
  if (status === 401) return { unauthenticated: true };
  if (status === 404 || status === 429 || status === 400) {
    return { status: "rejected", reason: reasonOf(body) };
  }
  return { status: "retry" };
}

export async function uploadPendingImage(
  image: PendingImage,
  deps: UploadDeps,
  /** From 0 to 1, over the two objects. */
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  let reservedId = image.reservedId;
  try {
    // A second pass only after a reservation purged meanwhile (D7).
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reserve = await deps.post({
        op: "reserve",
        eventId: image.eventId,
        image: { bytes: image.bytes, width: image.width, height: image.height },
        ...(reservedId ? { reservedId } : {}),
      });
      if (reserve.status !== 200) return failure(reserve.status, reserve.body);
      const { id, uploads } = reserve.body as Reserved;
      if (id !== reservedId) {
        // Saved before uploading: a retry reuses it (RF-41).
        await deps.setReservedId(image.localId, id);
        reservedId = id;
      }

      const total = image.full.size + image.thumb.size;
      const loaded = { full: 0, thumb: 0 };
      const report = (variant: "full" | "thumb") => (done: number) => {
        loaded[variant] = done;
        onProgress?.(total ? (loaded.full + loaded.thumb) / total : 1);
      };
      const send = (variant: "full" | "thumb"): Promise<PutResult> => {
        const url = uploads[variant].url;
        if (url) return deps.put(url, image[variant], report(variant));
        report(variant)(image[variant].size);
        return Promise.resolve("ok");
      };
      const results = await Promise.all([send("full"), send("thumb")]);
      if (results.includes("network")) return { status: "retry" };
      if (results.includes("rejected")) {
        return { status: "rejected", reason: IMAGE_MESSAGES.upload };
      }

      const confirm = await deps.post({ op: "confirm", id });
      if (confirm.status === 200) return { status: "applied" };
      if (confirm.status === 404) {
        await deps.setReservedId(image.localId, null);
        reservedId = null;
        continue;
      }
      // 409: an object is missing; the next send uploads both again.
      return failure(
        confirm.status === 409 ? 503 : confirm.status,
        confirm.body,
      );
    }
  } catch {
    // Offline again or too slow: it stays for later (RF-39).
    return { status: "retry" };
  }
  return { status: "retry" };
}

/** Storage answers 409 (or 400 with it in the body) for an object already there. */
function alreadyThere(status: number, text: string): boolean {
  return status === 409 || /"statusCode":\s*"409"|already exists/i.test(text);
}

/** PUT to a signed upload URL, with progress where XMLHttpRequest exists. */
export function putSigned(
  url: string,
  blob: Blob,
  onProgress?: (loaded: number, total: number) => void,
): Promise<PutResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "image/jpeg");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => onProgress?.(event.loaded, event.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve("ok");
      // A retry after the first upload did finish.
      resolve(alreadyThere(xhr.status, xhr.responseText) ? "ok" : "rejected");
    };
    xhr.onerror = () => resolve("network");
    xhr.send(blob);
  });
}

/** The app's dependencies: its own route, XHR and the device's store. */
export const appUploadDeps: UploadDeps = {
  async post(body) {
    const response = await fetch("/api/offline/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  },
  put: putSigned,
  setReservedId,
};
