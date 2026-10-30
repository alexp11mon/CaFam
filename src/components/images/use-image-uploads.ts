"use client";

import { useCallback, useRef, useState } from "react";
import {
  cancelImage,
  confirmImage,
  reserveImages,
} from "@/app/dashboard/events/image-actions";
import { IMAGE_MESSAGES, fitNotice } from "@/lib/images/error-messages";
import { MAX_PER_EVENT } from "@/lib/images/limits";
import { objectPath } from "@/lib/images/paths";
import { prepareImage, type PreparedImage } from "@/lib/images/prepare-image";
import { uploadObject } from "@/lib/images/upload-object";
import { createClient } from "@/lib/supabase/client";

export interface UploadItem {
  key: string;
  name: string;
  status: "preparing" | "ready" | "uploading" | "failed";
  /** 0 to 100. */
  progress: number;
  error?: string;
  /** A network or server failure; a file that cannot be prepared cannot be retried. */
  retryable?: boolean;
}

type Prepared = Exclude<PreparedImage, { error: string }>;

interface Entry {
  prepared?: Prepared;
  /** Reservation id, which is also the object id (plan "Modelo de datos"). */
  id?: string;
  controller?: AbortController;
  failed?: boolean;
}

const PARALLEL = 2;

/**
 * Queue of images for one event (spec 012 plan "Flujo", RF-2, RF-6, RF-20,
 * RF-24): `add` prepares the files on the device, `upload` reserves room and
 * sends them two at a time. `onUploaded` runs once per batch that stored
 * something.
 */
export function useImageUploads(onUploaded: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string>();
  const entries = useRef(new Map<string, Entry>());
  const stored = useRef(false);

  const patch = useCallback((key: string, change: Partial<UploadItem>) => {
    setItems((list) =>
      list.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }, []);

  const drop = useCallback((key: string) => {
    entries.current.delete(key);
    setItems((list) => list.filter((item) => item.key !== key));
  }, []);

  const finish = useCallback(() => {
    // Reserved and neither stored nor failed: still queued or uploading.
    const busy = [...entries.current.values()].some(
      (entry) => entry.id && !entry.failed,
    );
    if (busy || !stored.current) return;
    stored.current = false;
    onUploaded();
  }, [onUploaded]);

  const send = useCallback(
    async (key: string) => {
      const entry = entries.current.get(key);
      if (!entry?.prepared || !entry.id) return;
      const controller = new AbortController();
      entry.controller = controller;
      entry.failed = false;
      patch(key, {
        status: "uploading",
        progress: 0,
        error: undefined,
        retryable: undefined,
      });
      const fail = (error: string) => {
        entry.failed = true;
        patch(key, { status: "failed", error, retryable: true });
      };

      // Asked right before uploading: the session refreshes itself (plan R4).
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token ?? "";
      const { full, thumb } = entry.prepared;
      const total = full.size + thumb.size;
      let sent = 0;
      for (const [variant, blob] of [
        ["thumb", thumb],
        ["full", full],
      ] as const) {
        const result = await uploadObject({
          path: objectPath(entry.id, variant),
          blob,
          accessToken,
          signal: controller.signal,
          onProgress: (loaded) =>
            patch(key, {
              progress: Math.min(
                100,
                Math.round((100 * (sent + loaded)) / total),
              ),
            }),
        });
        if (result === "aborted") return;
        if (result !== "ok") return fail(IMAGE_MESSAGES.upload);
        sent += blob.size;
      }
      if (controller.signal.aborted) return;
      const confirmed = await confirmImage(entry.id);
      if (confirmed.error) return fail(confirmed.error);
      stored.current = true;
      drop(key);
    },
    [drop, patch],
  );

  /** Prepares the chosen files one at a time, to spare the phone's memory (plan R3). */
  const add = useCallback(
    async (files: File[]) => {
      setNotice(undefined);
      const added = files.map((file) => ({
        file,
        item: {
          key: crypto.randomUUID(),
          name: file.name,
          status: "preparing" as const,
          progress: 0,
        },
      }));
      setItems((list) => [...list, ...added.map(({ item }) => item)]);
      for (const { file, item } of added) {
        const result = await prepareImage(file);
        if ("error" in result) {
          patch(item.key, { status: "failed", error: result.error });
        } else {
          entries.current.set(item.key, { prepared: result });
          patch(item.key, { status: "ready" });
        }
      }
    },
    [patch],
  );

  /** Reserves and uploads every prepared image of the queue. */
  const upload = useCallback(
    async (eventId: string) => {
      const ready = [...entries.current]
        .filter(([, entry]) => entry.prepared && !entry.id)
        .map(([key]) => key);
      if (ready.length === 0) return;

      const wanted = ready.slice(0, MAX_PER_EVENT);
      const result = await reserveImages(
        eventId,
        wanted.map((key) => {
          const { full, thumb, width, height } =
            entries.current.get(key)!.prepared!;
          return { bytes: full.size + thumb.size, width, height };
        }),
      );
      if ("error" in result) {
        setNotice(result.error);
        ready.forEach(drop);
        return;
      }
      setNotice(fitNotice(ready.length, result.ids.length));
      ready.forEach((key, index) => {
        const id = result.ids[index];
        if (id) entries.current.get(key)!.id = id;
        else drop(key);
      });

      const queue = ready.slice(0, result.ids.length);
      const worker = async () => {
        for (let key = queue.shift(); key; key = queue.shift()) {
          await send(key);
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      finish();
    },
    [drop, finish, send],
  );

  const retry = useCallback(
    async (key: string) => {
      await send(key);
      finish();
    },
    [finish, send],
  );

  /** Stops an upload and frees its reservation, or removes a failed file (RF-6). */
  const remove = useCallback(
    (key: string) => {
      const entry = entries.current.get(key);
      entry?.controller?.abort();
      if (entry?.id) void cancelImage(entry.id);
      drop(key);
      finish();
    },
    [drop, finish],
  );

  return { items, notice, add, upload, retry, remove };
}
