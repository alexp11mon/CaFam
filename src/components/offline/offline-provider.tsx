"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyOfflineChange,
  loadOfflineSnapshot,
} from "@/app/dashboard/offline-actions";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { useConnection } from "@/lib/hooks/use-connection";
import { useOfflineQueue } from "@/lib/hooks/use-offline";
import { startWatching, withTimeout } from "@/lib/offline/connection";
import * as db from "@/lib/offline/db";
import { flush } from "@/lib/offline/flush";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import { loadQueue } from "@/lib/offline/queue-store";
import { getSnapshot, setSnapshot } from "@/lib/offline/snapshot-store";
import { loadPage } from "@/lib/offline/navigate";
import { syncThumbs } from "@/lib/offline/thumbs";
import { downloadImage } from "@/lib/images/download-image";
import { objectPath } from "@/lib/images/paths";
import { ConnectionAnnouncer } from "./connection-announcer";
import { useLinkCapture } from "./offline-router";

/** The copy is read again after this long with the tab visible (RF-6). */
export const COPY_MAX_AGE_MS = 15 * 60_000;
/** While changes wait with the network up, sending is tried this often (RF-46). */
const RETRY_MS = 30_000;

function isStale(): boolean {
  const copy = getSnapshot();
  return !copy || Date.now() - Date.parse(copy.savedAt) > COPY_MAX_AGE_MS;
}

/** The offline page and its files are cached again for this deploy (plan D14). */
function refreshOfflineApp() {
  navigator.serviceWorker?.controller?.postMessage({ type: "refresh-offline" });
}

/**
 * Owner of the device's copy and queue (spec 034 plan offline-provider):
 * reads them on start, keeps the copy fresh while there is a connection and
 * sends what waits when the network is back (RF-4, RF-6, RF-38, RF-39,
 * RF-45, RF-64). One per app frame; nothing is drawn but the announcer.
 */
export function OfflineProvider({
  userId,
  offlineApp = false,
}: {
  userId: string;
  /** In the offline app, whose own router takes the links. */
  offlineApp?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const t = useT();
  const online = useConnection();
  const { queue } = useOfflineQueue();
  const [ready, setReady] = useState(false);
  const reading = useRef(false);

  useEffect(() => startWatching(), []);

  // Without the network a Next navigation could hang: a link loads the page,
  // which the service worker turns into the offline app (plan R10).
  useLinkCapture(!online && !offlineApp, loadPage);

  // The device's data, after dropping another account's (RF-64).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await db.claimFor(userId);
        const state = await db.loadState();
        await loadQueue();
        if (alive && state.snapshot?.userId === userId) {
          await setSnapshot(state.snapshot);
        }
        // What the service worker sent with the app closed; the conflicts
        // and refused changes it left are in the queue just read (spec 035 RF-43).
        const background = await db.readBackgroundSync();
        if (background) {
          await db.clearBackgroundSync();
          if (alive && background.applied > 0) {
            show(OFFLINE_MESSAGES.synced(background.applied, t));
          }
        }
      } catch {
        // No IndexedDB (private mode, tests): the app works as before.
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId, show, t]);

  const readCopy = useCallback(
    async (force = false) => {
      if (reading.current || (!force && !isStale())) return;
      reading.current = true;
      try {
        const result = await withTimeout(loadOfflineSnapshot());
        if ("snapshot" in result && result.snapshot.userId === userId) {
          await setSnapshot(result.snapshot, true);
          refreshOfflineApp();
          // The thumbnails of the range, in the background (spec 035 RF-29).
          void syncThumbs(result.snapshot.images, (objectId) =>
            downloadImage(objectPath(objectId, "thumb")),
          ).catch(() => {});
        }
      } catch {
        // Offline or failed: the copy there is kept.
      } finally {
        reading.current = false;
      }
    },
    [userId],
  );

  // On opening and every 15 min with the tab visible (RF-4, RF-6).
  useEffect(() => {
    if (!ready || !online) return;
    void readCopy();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void readCopy();
    }, 60_000);
    return () => clearInterval(timer);
  }, [ready, online, readCopy]);

  // What waits goes when the network is there (RF-38, RF-39, RF-46).
  const waiting = queue.length;
  useEffect(() => {
    if (!ready || !online || waiting === 0) return;
    // The queue empties while sending, which runs this effect again: the
    // refresh after a send must not depend on it.
    const send = () =>
      void flush(applyOfflineChange, show).then((result) => {
        if (result.applied === 0) return;
        // The server's state replaces the marks, and the copy is read again (RF-45).
        router.refresh();
        void readCopy(true);
      });
    send();
    const timer = setInterval(send, RETRY_MS);
    return () => clearInterval(timer);
  }, [ready, online, waiting, router, show, readCopy]);

  return <ConnectionAnnouncer />;
}
