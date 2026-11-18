"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@/lib/hooks/use-connection";
import { downloadImage } from "@/lib/images/download-image";
import { getPendingImage, getThumb } from "@/lib/offline/db";
import { cachedImage, rememberImage } from "@/lib/offline/image-cache";

export type ImageBlob =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "denied" };

/** Which copy on the device stands for the image without a connection (spec 035). */
export type DeviceImage =
  | { id: string; kind: "thumb" | "full" }
  /** An image added offline, still waiting (RF-35). */
  | { id: string; kind: "pending" };

async function fromDevice(local: DeviceImage | undefined) {
  if (!local) return null;
  try {
    if (local.kind === "thumb") return (await getThumb(local.id)) ?? null;
    if (local.kind === "full") return await cachedImage(local.id);
    return (await getPendingImage(local.id))?.thumb ?? null;
  } catch {
    // No IndexedDB (a private window): as if the device had nothing.
    return null;
  }
}

/**
 * An image of the bucket as a blob: URL, freed when the component goes away
 * (spec 012 plan D5, R7, R8). Never cached by the service worker (RF-27).
 * Without a connection it comes from the device: the saved thumbnail, the
 * full image if it was opened before, or the one waiting (spec 035 RF-30, RF-31).
 */
export function useImageBlob(path: string, local?: DeviceImage): ImageBlob {
  const online = useConnection();
  const [image, setImage] = useState<ImageBlob & { key?: string }>({
    status: "loading",
  });
  const id = local?.id;
  const kind = local?.kind;
  const key = `${path}|${online}`;

  useEffect(() => {
    let url: string | undefined;
    let active = true;
    const device = id && kind ? ({ id, kind } as DeviceImage) : undefined;
    const load = async () => {
      if (!online || kind === "pending") return fromDevice(device);
      const blob = await downloadImage(path);
      if (!blob) return fromDevice(device);
      // Kept for the viewer without a connection (D10).
      if (kind === "full" && id) void rememberImage(id, blob).catch(() => {});
      return blob;
    };
    void load().then((blob) => {
      if (!active) return;
      if (!blob) return setImage({ status: "denied", key });
      url = URL.createObjectURL(blob);
      setImage({ status: "ready", url, key });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, id, kind, online, key]);

  // A new path shows "loading" until its own download arrives.
  return image.key === key ? image : { status: "loading" };
}
