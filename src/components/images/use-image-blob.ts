"use client";

import { useEffect, useState } from "react";
import { downloadImage } from "@/lib/images/download-image";

export type ImageBlob =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "denied" };

/**
 * An image of the bucket as a blob: URL, freed when the component goes away
 * (spec 012 plan D5, R7, R8). Never cached by the service worker (RF-27).
 */
export function useImageBlob(path: string): ImageBlob {
  const [image, setImage] = useState<ImageBlob & { path?: string }>({
    status: "loading",
  });

  useEffect(() => {
    let url: string | undefined;
    let active = true;
    void downloadImage(path).then((blob) => {
      if (!active) return;
      if (!blob) return setImage({ status: "denied", path });
      url = URL.createObjectURL(blob);
      setImage({ status: "ready", url, path });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  // A new path shows "loading" until its own download arrives.
  return image.path === path ? image : { status: "loading" };
}
