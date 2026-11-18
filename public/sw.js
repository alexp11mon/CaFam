// CaFam service worker (plan D7; RF-21, RF-23).
// Caches only the offline page, icons and hashed static assets. HTML pages
// and Supabase responses are never cached, so no user data stays on the
// device (plan R6). Since spec 034 the offline page runs the app from the
// copy in IndexedDB, which the app (not this worker) keeps (plan D3). Since
// spec 035 it also sends the queue with the app closed (Background Sync).

// Bump the version to drop old caches after a change (plan R5).
const CACHE_NAME = "cafam-v8";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
  // The offline page needs its CSS and JS chunks to render without network.
  const offlinePage = await cache.match(OFFLINE_URL);
  const html = offlinePage ? await offlinePage.text() : "";
  // Backslash excluded: the inlined RSC payload escapes quotes as \".
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
  await cache.addAll([...assets]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only this origin's GETs; Supabase and everything else go to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Network first; the cached offline page only when the network fails.
    event.respondWith(
      fetch(request).catch(async () => {
        // A panel page opens the offline app at that address (spec 034 RF-8).
        if (url.pathname.startsWith("/dashboard")) {
          const from = encodeURIComponent(url.pathname + url.search);
          const target = `${self.location.origin}${OFFLINE_URL}?from=${from}`;
          return Response.redirect(target, 302);
        }
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (url.pathname === OFFLINE_URL) {
    // The redirect above carries ?from=: the cached page, whatever the query.
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    // Hashed file names never change content: cache first.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

// After a deploy, the open app asks for the offline page of this version and
// its files (spec 034 RF-6, plan D14).
self.addEventListener("message", (event) => {
  if (event.data?.type === "refresh-offline") {
    event.waitUntil(precache().catch(() => {}));
  }
});

// ---------------------------------------------------------------------------
// Sending with the app closed (spec 035 RF-42 to RF-46, plan D4). The same
// loop as src/lib/offline/flush.ts, written again because this file is not
// bundled: a change there goes here too. tests/unit/offline-flush-cases.ts
// runs the same cases through both.

const DB_NAME = "cafam-offline";
const DB_VERSION = 2;
const STORES = [
  "meta",
  "snapshot",
  "outbox",
  "conflicts",
  "rejected",
  "thumbs",
  "images",
  "pending-images",
];
const SYNC_TAG = "cafam-offline";
const FLUSH_LOCK = "cafam-offline-flush";
const UPLOAD_FAILED = "No se ha podido subir la imagen.";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** One transaction; `work` returns a reader of its result, read on complete. */
function transact(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const read = work(tx);
    tx.oncomplete = () => resolve(read ? read() : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const getKey = (db, store, key) =>
  transact(db, [store], "readonly", (tx) => {
    const request = tx.objectStore(store).get(key);
    return () => request.result;
  });
const putKey = (db, store, key, value) =>
  transact(db, [store], "readwrite", (tx) => {
    tx.objectStore(store).put(value, key);
  });
const deleteKey = (db, store, key) =>
  transact(db, [store], "readwrite", (tx) => {
    tx.objectStore(store).delete(key);
  });

// As entityOf, noteOf, eventOf and dependentsOf in lib/offline/outbox.ts.
function entityOf(change) {
  if (change.type.startsWith("event.")) return `event:${change.id}`;
  if (change.type.startsWith("note.")) return `note:${change.id}`;
  if (change.type === "item.move") return `order:${change.noteId}`;
  if (change.type.startsWith("series.")) {
    return `series:${change.scope}:${change.id}`;
  }
  if (change.type === "comment.add") return `comment:${change.clientId}`;
  if (change.type.startsWith("comment.")) return `comment:${change.id}`;
  if (change.type === "image.add") return `image:${change.localId}`;
  if (change.type === "image.delete") return `image:${change.id}`;
  return `item:${change.id}`;
}

function noteOf(change) {
  if (change.type.startsWith("note.")) return change.id;
  if (change.type.startsWith("item.")) return change.noteId;
  return null;
}

const eventOf = (change) => ("eventId" in change ? change.eventId : null);

function dependentsOf(queue, failed) {
  const key = entityOf(failed.change);
  const note = failed.change.type === "note.create" ? failed.change.id : null;
  const event = failed.change.type === "event.create" ? failed.change.id : null;
  const at = queue.findIndex((entry) => entry.changeId === failed.changeId);
  return queue
    .slice(at + 1)
    .filter(
      (entry) =>
        entityOf(entry.change) === key ||
        (note !== null && noteOf(entry.change) === note) ||
        (event !== null && eventOf(entry.change) === event),
    );
}

async function postJson(path, body) {
  const response = await fetch(`${self.location.origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json };
}

/** /api/offline/apply answers 401 without a session (RF-44). */
async function applyChange(change) {
  const { status, body } = await postJson("/api/offline/apply", { change });
  if (status === 401) return { unauthenticated: true };
  if (status !== 200 || !body || !body.status) return { status: "retry" };
  return body;
}

async function putSigned(url, blob) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "image/jpeg", "x-upsert": "false" },
    body: blob,
  });
  if (response.ok) return "ok";
  const text = await response.text().catch(() => "");
  // An earlier upload did finish (as alreadyThere in image-upload.ts).
  const there =
    response.status === 409 ||
    /"statusCode":\s*"409"|already exists/i.test(text);
  return there ? "ok" : "rejected";
}

function imageFailure(status, body) {
  if (status === 401) return { unauthenticated: true };
  if (status === 400 || status === 404 || status === 429) {
    const reason =
      body && typeof body.error === "string" ? body.error : UPLOAD_FAILED;
    return { status: "rejected", reason };
  }
  return { status: "retry" };
}

/** As uploadPendingImage in lib/offline/image-upload.ts (D6, D7). */
async function uploadImage(db, image) {
  let reservedId = image.reservedId;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reserve = await postJson("/api/offline/image", {
      op: "reserve",
      eventId: image.eventId,
      image: { bytes: image.bytes, width: image.width, height: image.height },
      ...(reservedId ? { reservedId } : {}),
    });
    if (reserve.status !== 200) {
      return imageFailure(reserve.status, reserve.body);
    }
    const { id, uploads } = reserve.body;
    if (id !== reservedId) {
      // Saved before uploading: a retry reuses it (RF-41).
      reservedId = id;
      await putKey(db, "pending-images", image.localId, {
        ...image,
        reservedId,
      });
    }
    const results = await Promise.all(
      ["full", "thumb"].map((variant) =>
        uploads[variant].url
          ? putSigned(uploads[variant].url, image[variant])
          : "ok",
      ),
    );
    if (results.includes("rejected")) {
      return { status: "rejected", reason: UPLOAD_FAILED };
    }
    const confirm = await postJson("/api/offline/image", { op: "confirm", id });
    if (confirm.status === 200) return { status: "applied" };
    if (confirm.status === 404) {
      // Purged meanwhile: reserve once more (D7).
      reservedId = null;
      await putKey(db, "pending-images", image.localId, {
        ...image,
        reservedId,
      });
      continue;
    }
    return imageFailure(
      confirm.status === 409 ? 503 : confirm.status,
      confirm.body,
    );
  }
  return { status: "retry" };
}

async function sendImage(db, change) {
  const image = await getKey(db, "pending-images", change.localId);
  // Removed meanwhile: nothing left to send.
  if (!image) return { status: "applied" };
  const result = await uploadImage(db, image);
  if (result.status === "applied") {
    await deleteKey(db, "pending-images", image.localId);
  }
  return result;
}

/** The queue, in order; resolves to whether something is left to retry. */
async function sendQueue() {
  const db = await openDb();
  let applied = 0;
  let stopped = null;
  /** Changes left for an account to be connected again (RF-7, D8). */
  const held = new Set();
  for (;;) {
    const queue = (await getKey(db, "outbox", "queue")) || [];
    const entry = queue.find((queued) => !held.has(queued.changeId));
    if (!entry) break;
    let result;
    try {
      result =
        entry.change.type === "image.add"
          ? await sendImage(db, entry.change)
          : await applyChange(entry.change);
    } catch {
      // Offline again: the browser tries later.
      result = { status: "retry" };
    }
    if (result.unauthenticated) {
      stopped = "unauthenticated";
      break;
    }
    if (result.status === "retry") {
      stopped = "retry";
      break;
    }
    if (result.status === "held") {
      for (const kept of [entry, ...dependentsOf(queue, entry)]) {
        held.add(kept.changeId);
      }
      continue;
    }
    let gone = [entry];
    if (result.status === "applied") applied += 1;
    if (result.status === "conflict") {
      await putKey(db, "conflicts", entry.changeId, {
        changeId: entry.changeId,
        change: entry.change,
        server: result.server,
      });
    }
    if (result.status === "rejected") {
      // What depends on a refused change cannot go either.
      gone = [entry, ...dependentsOf(queue, entry)];
      for (const failed of gone) {
        await putKey(db, "rejected", failed.changeId, {
          changeId: failed.changeId,
          change: failed.change,
          reason: result.reason,
        });
      }
    }
    const ids = new Set(gone.map((g) => g.changeId));
    // Read again: the app may have queued something meanwhile.
    const now = (await getKey(db, "outbox", "queue")) || [];
    await putKey(
      db,
      "outbox",
      "queue",
      now.filter((queued) => !ids.has(queued.changeId)),
    );
  }
  if (applied > 0) {
    // The app says "N cambios sincronizados" when it opens (RF-43).
    const last = await getKey(db, "meta", "lastBackgroundSync");
    await putKey(db, "meta", "lastBackgroundSync", {
      applied: applied + ((last && last.applied) || 0),
      at: new Date().toISOString(),
    });
  }
  return stopped === "retry";
}

async function backgroundSync() {
  const locks = self.navigator && self.navigator.locks;
  // The same lock as the app: never two senders on a device (RF-45).
  const retry = await (locks
    ? locks.request(FLUSH_LOCK, sendQueue)
    : sendQueue());
  // A rejected promise makes the browser try again later.
  if (retry) throw new Error("retry");
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(backgroundSync());
});

// Spec 040: Web Push. The payload is decrypted by the browser (RFC 8291) and
// only says what to show and what to open (RF-11).
const DEFAULT_URL = "/dashboard/calendar";

/** Only paths of this app: a notice never opens another site. */
function appUrl(url) {
  try {
    const target = new URL(url || DEFAULT_URL, self.location.origin);
    if (target.origin === self.location.origin) return target.href;
  } catch {}
  return new URL(DEFAULT_URL, self.location.origin).href;
}

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {}
  const title = (payload && payload.title) || "CaFam";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: (payload && payload.body) || "",
      tag: (payload && payload.tag) || undefined,
      renotify: Boolean(payload && payload.tag),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: (payload && payload.url) || DEFAULT_URL },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = appUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (w) => new URL(w.url).origin === self.location.origin,
      );
      if (open) {
        await open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
