// RNF-2 of spec 035 (T12): what the device keeps with 300 thumbnails and 50
// comments in each of 200 events, and with the 20 images that may wait to be
// sent. Written straight into the app's IndexedDB (version 2, the same
// stores) on its origin, and measured with navigator.storage.estimate().
//
//   npx next start -p 3100 &
//   NODE_PATH=<global playwright> node scripts/perf/offline-measure-035.mjs
//
// The images are photo-like on purpose (gradients, shapes and grain), encoded
// as prepareImage does: 400 px at 0.75 and 2048 px at 0.82. Grain makes JPEG
// larger than most real photos, so the result is an upper bound.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL ?? "msedge",
});
const page = await browser.newPage();
await page.goto(`${BASE}/login`);

const result = await page.evaluate(async () => {
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
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("cafam-offline", 2);
    open.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!open.result.objectStoreNames.contains(name)) {
          open.result.createObjectStore(name);
        }
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const put = (store, key, value) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  const used = async () => (await navigator.storage.estimate()).usage ?? 0;

  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  async function photo(width, height, quality) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, `hsl(${random() * 360} 60% 70%)`);
    sky.addColorStop(1, `hsl(${random() * 360} 50% 35%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `hsla(${random() * 360} 55% ${30 + random() * 50}% / 0.6)`;
      ctx.beginPath();
      ctx.ellipse(
        random() * width,
        random() * height,
        (random() * width) / 6,
        (random() * height) / 6,
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const image = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = (random() - 0.5) * 24;
      image.data[i] += grain;
      image.data[i + 1] += grain;
      image.data[i + 2] += grain;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  const before = await used();

  // The copy: 200 events of the range with 50 comments each, and 300
  // ready images whose thumbnails are kept.
  const events = Array.from({ length: 200 }, (_, n) => ({
    id: crypto.randomUUID(),
    calendarId: "c1",
    title: `Evento ${n} con un título de longitud normal`,
    description: "Una descripción de un par de frases. ".repeat(4),
    location: "Calle Mayor 12, Madrid",
    startsAt: new Date(Date.UTC(2026, 10, 1 + (n % 90), 9)).toISOString(),
    endsAt: new Date(Date.UTC(2026, 10, 1 + (n % 90), 10)).toISOString(),
    allDay: false,
    color: null,
    categoryId: null,
  }));
  const comments = events.flatMap((event) =>
    Array.from({ length: 50 }, (_, n) => ({
      id: crypto.randomUUID(),
      eventId: event.id,
      authorId: crypto.randomUUID(),
      authorName: "Nombre Apellido",
      body: `Comentario ${n}: `.padEnd(200, "texto de ejemplo "),
      createdAt: new Date().toISOString(),
      editedAt: null,
    })),
  );
  const images = Array.from({ length: 300 }, (_, n) => ({
    id: crypto.randomUUID(),
    eventId: events[n % 200].id,
    objectId: crypto.randomUUID(),
    uploadedBy: null,
    createdAt: new Date().toISOString(),
    width: 2048,
    height: 1536,
  }));
  await put("snapshot", "one", {
    format: 2,
    savedAt: new Date().toISOString(),
    events,
    comments,
    images,
    series: [],
    exceptions: [],
    notes: [],
  });
  const afterSnapshot = await used();
  let thumbBytes = 0;
  for (const image of images) {
    const blob = await photo(400, 300, 0.75);
    thumbBytes += blob.size;
    await put("thumbs", image.id, blob);
  }
  const afterThumbs = await used();

  // The full images opened with a connection (30 at most, D10).
  let cachedBytes = 0;
  for (let n = 0; n < 30; n++) {
    const blob = await photo(2048, 1536, 0.82);
    cachedBytes += blob.size;
    await put("images", images[n].id, { blob, usedAt: n });
  }
  const afterCached = await used();

  // The 20 images that may wait to be sent (RF-34).
  let pendingBytes = 0;
  for (let n = 0; n < 20; n++) {
    const full = await photo(2048, 1536, 0.82);
    const thumb = await photo(400, 300, 0.75);
    pendingBytes += full.size + thumb.size;
    await put("pending-images", `l${n}`, {
      localId: `l${n}`,
      eventId: events[n].id,
      full,
      thumb,
      width: 2048,
      height: 1536,
      bytes: full.size + thumb.size,
      reservedId: null,
    });
  }
  const afterPending = await used();
  db.close();
  await new Promise((resolve) => {
    const del = indexedDB.deleteDatabase("cafam-offline");
    del.onsuccess = del.onerror = del.onblocked = () => resolve();
  });

  const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
  return {
    snapshotJson: mb(JSON.stringify({ events, comments, images }).length),
    copy: mb(afterThumbs - before),
    snapshotStored: mb(afterSnapshot - before),
    thumbs: mb(thumbBytes),
    thumbAverageKb: Math.round(thumbBytes / 300 / 1024),
    cached: mb(afterCached - afterThumbs),
    cachedBlobs: mb(cachedBytes),
    pending: mb(afterPending - afterCached),
    pendingBlobs: mb(pendingBytes),
    pendingAverageKb: Math.round(pendingBytes / 20 / 1024),
  };
});

await browser.close();
console.log(JSON.stringify(result, null, 2));
console.log(
  `RNF-2: copia ${result.copy} MB (límite 40) · pendientes ${result.pending} MB (límite 50)`,
);
process.exit(result.copy <= 40 && result.pending <= 50 ? 0 : 1);
