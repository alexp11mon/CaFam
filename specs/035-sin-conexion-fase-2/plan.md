# Plan 035 — Modo sin conexión, fase 2

> Estado: **Aprobado** (2026-11-17), con D2 y D5 aprobadas expresamente por el usuario. Spec de origen: `specs/035-sin-conexion-fase-2/spec.md` (aprobada el 2026-11-17). Constitución: `docs/constitution.md`. Parte del código de la spec 034 (`lib/offline/`, `components/offline/`, `app/dashboard/offline-*.ts`, `public/sw.js`), que debe estar cerrada antes de la primera tarea de esta.

## Resumen de arquitectura

Se amplía el modo sin conexión de la 034 sin cambiar su forma: la copia en IndexedDB, la cola con base y datos, la comparación de tres versiones en el servidor, la hoja de cambios y el indicador.

Lo nuevo:

- **Más tipos de cambio** en la misma cola: serie con alcance, comentario (añadir, editar, borrar) e imagen (añadir, borrar). El servidor los aplica con las escrituras de siempre.
- **Escritura en Google e iCloud**: el servidor deja de rechazar los calendarios traídos. Antes de escribir, lee el evento en el proveedor y lo compara con la base, como compara con Postgres en la 034.
- **Copia más rica** (formato 2): filas de serie con sus totales, comentarios e imágenes del rango, y las miniaturas como `Blob` en un almacén aparte.
- **Envío con la app cerrada**: el service worker atiende el evento `sync` (Background Sync, solo Chromium). Lee la cola de IndexedDB y llama a dos Route Handlers con la cookie de sesión.

```
App abierta ── withOutbox ─┐                ┌─ Server Action applyOfflineChange ─┐
                           ├─ IndexedDB ────┤                                    ├─ applyChange (RLS + proveedor)
Service worker (sync) ─────┘  (cola, copia, └─ POST /api/offline/apply ──────────┘
                               miniaturas,     POST /api/offline/image (URL firmadas de subida)
                               imágenes pendientes)
```

## Módulos y responsabilidades

### Lógica pura (`src/lib/offline/`, testeada con Vitest)

- `outbox.ts` (amplía la 034):
  - nuevos tipos de cambio (ver "Modelo de datos");
  - `combine` funde también comentario añadido y editado (o añadido y borrado → nada) y dos cambios de la misma serie con el mismo alcance;
  - `enqueue` quita lo pendiente de un evento borrado (comentarios e imágenes);
  - `dependentsOf` arrastra los comentarios e imágenes de un evento rechazado.

  Cubre: RF-19, RF-23, RF-32, casos límite.
- `overlay.ts` (amplía la 034): comentarios e imágenes pendientes o borrados en el detalle, con su marca. Cubre: RF-20, RF-25, RF-35, RF-37.
- `series-overlay.ts`: aplica un cambio de serie pendiente a la copia con `planSeriesChange`/`planSeriesDelete` de siempre y vuelve a expandir la serie en el rango con `expandRows` (D2). Cubre: RF-10 a RF-12.
- `series-loss.ts`: cuenta en la copia lo que se perdería con un alcance (repeticiones cambiadas, imágenes y comentarios), para la confirmación de RF-13. Cubre: RF-13.
- `gates.ts` (amplía la 034):
  - sin red, los traídos se escriben con las mismas reglas que con red (`canWriteEvents`, `moveTargets`, `readOnlyReason`);
  - se ofrecen los tres alcances y "Repetir" en calendarios normales;
  - quién edita o borra un comentario o una imagen, según el rol guardado en la copia.

  Cubre: RF-1 a RF-3, RF-10, RF-11, RF-16, RF-23, RF-24, RF-36.
- `image-limits.ts`: 10 por evento (subidas más pendientes) y 20 pendientes en total. Cubre: RF-33, RF-34.

### Navegador

- `lib/offline/db.ts` (versión 2 de la base): almacenes nuevos `thumbs` (miniatura por id de imagen), `images` (imágenes grandes ya abiertas, con fecha de uso) y `pending-images` (las dos versiones reducidas de una imagen añadida sin red, más el id reservado si lo hay). `clearAll` vacía también los nuevos. Cubre: RF-29, RF-31, RF-35, RF-41, RF-47.
- `lib/offline/thumbs.ts`: tras cada lectura de la copia, descarga en segundo plano las miniaturas que faltan, 4 a la vez, con `downloadImage` de siempre. Borra las que ya no están en la copia. Cubre: RF-29.
- `lib/offline/image-cache.ts`: guarda en `images` cada imagen grande que el visor abre con red, como mucho 30 (sale la usada hace más tiempo). Sin red, el visor la lee de ahí o enseña la miniatura con el aviso de RF-31. Cubre: RF-31.
- `lib/offline/image-upload.ts`: sube una imagen pendiente:
  1. pide al servidor la reserva y las URL firmadas de subida, o las reutiliza si ya las tenía;
  2. sube los dos objetos con XHR (con progreso) o `fetch` (en el service worker);
  3. confirma.

  Guarda el id reservado en `pending-images` antes del paso 2, así un reintento no reserva otra (RF-41). Dos a la vez. Cubre: RF-39 a RF-41.
- `lib/offline/flush.ts` (amplía la 034):
  - recorre la cola saltando lo retenido: un resultado `held` deja ese cambio y los de su misma entidad en la cola y sigue con el resto (RF-7);
  - las imágenes van por `image-upload.ts`;
  - al terminar, registra `sync` si quedan cambios.

  Cubre: RF-4, RF-7, RF-8, RF-39.
- `lib/offline/background.ts`: registra la etiqueta `cafam-offline` con `registration.sync.register` al encolar y al quedar algo pendiente. Si el navegador no tiene Background Sync, no hace nada (RF-46). Cubre: RF-42, RF-46.
- `components/offline/offline-provider.tsx` (amplía la 034):
  - al abrir, lee el resumen que dejó el service worker (`meta.lastBackgroundSync`) y avisa "N cambios sincronizados" (RF-43);
  - al reconectarse una cuenta (`router.refresh` de la ficha), lanza `flush` (RF-8).

  Cubre: RF-8, RF-43.
- **Detalle sin red**:
  - `EventComments` lee los comentarios de la copia con el overlay: añadir, editar y borrar pasan por `withOutbox`, y "Ver anteriores" queda deshabilitado con "Necesita conexión";
  - `EventImages` e `ImageViewer` leen las miniaturas y la caché, y añadir y borrar pasan por `withOutbox`;
  - `SeriesScopeDialog` y `RepeatField` dejan de estar bloqueados sin red (salvo en traídos).

  Cubre: RF-18 a RF-20, RF-23 a RF-25, RF-30 a RF-37, RF-10, RF-11.
- `components/offline/changes-sheet.tsx` (amplía la 034):
  - conflictos de serie con las dos versiones y lo que se perdería (RF-14, RF-15);
  - comentario o imagen rechazados con su texto o "Descargar" (RF-21, RF-27, RF-40);
  - aviso de cuenta retenida con "Volver a conectar" (RF-7).

  Cubre: RF-7, RF-14, RF-15, RF-21, RF-27, RF-40.

### Service worker (`public/sw.js`, `CACHE_NAME` `cafam-v7`)

- Atiende `sync` con la etiqueta `cafam-offline`, dentro de `navigator.locks.request("cafam-offline-flush")`, el mismo candado que la app (RF-45):
  - lee la cola y las imágenes pendientes de IndexedDB;
  - las envía con `fetch` a `/api/offline/apply` y `/api/offline/image`;
  - clasifica como `flush.ts`: `applied`, `conflict`, `rejected` con dependientes, `held`, `retry` y `unauthenticated`;
  - guarda en `meta.lastBackgroundSync` cuántos se aplicaron.

  Si queda algo por reintentar, rechaza la promesa para que el navegador vuelva a intentarlo más tarde.
- La lógica del bucle está **escrita dos veces** (TypeScript en `flush.ts` y JavaScript en `sw.js`), porque el service worker no se empaqueta (D4). Un test unitario carga `sw.js` en un `vm` y le pasa los mismos casos que a `flush.ts`.

Cubre: RF-42, RF-44, RF-45.

### Servidor

- `app/dashboard/offline-reads.ts` (amplía la 034; copia de formato 2):
  - filas de las series del rango con sus totales para toda la serie (`exceptions`, `images`, `comments` y `latest`, la fecha más reciente entre sus excepciones);
  - los 50 comentarios más recientes por evento del rango, con autor y "editado";
  - las imágenes `ready` de los eventos del rango (id, autor, fecha y dimensiones).

  Todo con la sesión del usuario y RLS. Cubre: RF-17, RF-29, RF-13.
- `app/dashboard/offline-writes.ts` (amplía la 034):
  - **traídos**: deja de rechazarlos. Lee el evento en el proveedor (`readSyncedEvent`) y lo compara con la base. Escribe con `updateSingle`, `createSingle` y `deleteSingle` de siempre, que ya van primero al proveedor. Si el proveedor responde `revoked`, devuelve `held` (RF-4 a RF-9);
  - **series**: compara la fila de la serie y sus totales con la base. Si coinciden, aplica con `changeOccurrence`/`deleteOccurrences` y el alcance pedido, con `confirmLoss`; si no, devuelve un conflicto con la serie actual y su `series_loss` (RF-14, RF-15);
  - **crear o convertir en serie**: `repeat` en el cambio, resuelto con la fecha como en el formulario (RF-11);
  - **comentarios**: añadir con `client_id` (idempotente, RF-22), editar comparando el texto con la base, borrar dando por hecho si ya no está (RF-21, RF-26 a RF-28);
  - **borrar imagen**: con la política de siempre, y hecho si ya no está (RF-38).

  Cubre: RF-4 a RF-9, RF-11, RF-14, RF-15, RF-21, RF-22, RF-26 a RF-28, RF-38.
- `lib/sync/read-event.ts` + `readEvent` en `ProviderSession`: lee un evento del proveedor con su id externo:
  - Google: `GET events/{id}` (`404`/`410` → no existe);
  - iCloud: lee el recurso `.ics` del `href` y saca el `VEVENT` del `RECURRENCE-ID` si es una repetición (`404` → no existe).

  Devuelve los campos de `WritableEvent` o `null`. Cubre: RF-5, RF-6.
- `app/api/offline/apply/route.ts` (`POST`, con sesión; sin sesión `401` en JSON): el mismo contrato que `applyOfflineChange`, para el service worker. Valida con el mismo esquema. Cubre: RF-42, RF-44.
- `app/api/offline/image/route.ts` (`POST`, con sesión), con dos operaciones:
  - `reserve {eventId, image}` → `{ id, uploads: {full, thumb} }`: hace la reserva con `reserve_event_images` (que materializa la repetición si hace falta) y crea las URL firmadas con `createSignedUploadUrl`, con la sesión del usuario;
  - `confirm {id}`: llama a `confirm_event_image`.

  La usan la app y el service worker. Cubre: RF-39 a RF-41.
- `lib/offline/schemas.ts` (amplía la 034): esquemas zod de los cambios nuevos. Cubre: RNF-3.

### Cambios en lo que ya existe

- `/privacy`: la sección de la 034 añade miniaturas, imágenes abiertas, comentarios e imágenes pendientes. Cubre: RF-48.
- `SignOutGuard` y borrar la cuenta ya llaman a `clearAll`, que ahora vacía también los almacenes nuevos. Cubre: RF-47.

## Modelo de datos

Sin migraciones en Postgres: `client_id` de los comentarios, `reserve_event_images`, `confirm_event_image`, `series_loss` y las escrituras al proveedor ya existen.

IndexedDB `cafam-offline`, **versión 2**. La copia pasa a **formato 2**: una copia de formato 1 se descarta y se vuelve a leer, y la cola se conserva.

- `snapshot` añade:
  - `series: { id, calendarId, recurrence, recurrenceTz, recurrenceUntil, exdates, startsAt, endsAt, allDay, fields, totals: {exceptions, images, comments, latest} }[]`
  - `exceptions`: las excepciones del rango, con `seriesId` y `originalStart`
  - `comments: { id, eventId, authorId, authorName, body, createdAt, editedAt }[]`
  - `images: { id, eventId, uploadedBy, createdAt, width, height }[]`
- `thumbs`: clave id de imagen, valor `Blob`.
- `images`: clave id de imagen, valor `{ blob, usedAt }`, como mucho 30.
- `pending-images`: clave `localId`, valor `{ eventId, full: Blob, thumb: Blob, width, height, bytes, reservedId: string | null }`.
- `meta.lastBackgroundSync`: `{ applied, at }` o nada.
- Nuevos `OfflineChange`:
  - `event.create {id, data, repeat?}` y `event.update {id, base, data, repeat?}`: `repeat` como en el formulario (`none`, una opción rápida o `custom:<RRULE>`);
  - `series.update {id, scope, base: SeriesBase, data, repeat}` y `series.delete {id, scope, base: SeriesBase}`, con `scope` `this | following | all` y `SeriesBase = { fields, recurrence, exdates, totals }`;
  - `comment.add {eventId, clientId, body}`, `comment.update {id, eventId, base: {body}, body}` y `comment.delete {id, eventId, base: {body}}`;
  - `image.add {eventId, localId}` y `image.delete {id, eventId}`.
- Resultado nuevo de `applyOfflineChange`: `{ status: "held", connectionId }`, para una cuenta que necesita volver a conectarse.
- Tamaños previstos (RNF-2): miniatura de 400 px unos 30 KB, así que 300 son unos 9 MB. Los comentarios de 200 eventos ocupan menos de 2 MB. Una pendiente (grande más miniatura) son unos 1,5 MB, así que 20 son unos 30 MB. Se mide en las tareas.

## Contratos e interfaces

- `applyOfflineChange(change, { force })` y `POST /api/offline/apply` `{ change, force }` devuelven lo mismo que en la 034, más `held`. `401` sin sesión en la ruta; la acción responde `{ unauthenticated: true }`.
- `POST /api/offline/image`, con dos operaciones:
  - `{ op: "reserve", eventId, image: {bytes, width, height}, reservedId? }` → `200 { id, uploads: { full: {path, token}, thumb: {path, token} } }`. `429` con el mensaje de límite de siempre, `404` si el evento ya no existe o no se ve, y `401`. Con `reservedId` de una reserva todavía `pending` del usuario, devuelve URL nuevas para ella sin reservar otra.
  - `{ op: "confirm", id }` → `200 {}`, o `404` si la reserva ya no existe (se purgó tras 1 h: el cliente reserva de nuevo).
- `ProviderSession.readEvent(calendarId, eventId): Promise<WritableEvent | null>`.
- Service worker: `sync` con la etiqueta `cafam-offline`. Escribe `meta.lastBackgroundSync`.

## Flujo principal paso a paso

1. **Google sin red.** El usuario mueve un evento de su calendario de Google. `gates.ts` lo permite porque con red también podría (RF-1 a RF-3). `withOutbox` encola un `event.update` con la base de la copia y `background.ts` registra `sync`.
2. **Vuelve la red con la app cerrada** (Chrome de Android). El navegador lanza `sync`. El service worker toma el candado (RF-45) y envía el cambio a `/api/offline/apply`. El servidor:
   1. lee el evento en Google (`readEvent`);
   2. si coincide con la base, escribe primero en Google y después en CaFam (RF-4);
   3. si difiere, responde conflicto (RF-5), o conflicto con `null` si Google lo borró (RF-6);
   4. si Google responde `revoked`, responde `held`.

   El service worker guarda los conflictos y el resumen.
3. **Abre la app.** El proveedor lee `lastBackgroundSync`, avisa "1 cambio sincronizado" y el indicador cuenta los conflictos (RF-43). En el iPhone no hubo `sync`, y el mismo envío lo hace `flush` al abrir (RF-46).
4. **Serie sin red.** "Todos los eventos" a las 18:00:
   1. `series-loss.ts` cuenta en la copia lo que se perdería y se confirma (RF-13);
   2. se encola `series.update` con la serie y sus totales como base;
   3. `series-overlay.ts` pinta las repeticiones nuevas (RF-12).

   Al enviar, si la serie y sus totales no cambiaron, se aplica con `confirmLoss`. Si cambiaron, es un conflicto con las dos versiones y lo que se perdería ahora (RF-14, RF-15).
5. **Comentario e imagen sin red.**
   - El comentario se encola con un `clientId` nuevo y sale con "Pendiente de enviar" (RF-19, RF-20).
   - La foto se reduce como siempre y se guarda en `pending-images` (RF-32 a RF-35).

   Al volver la red:
   - el comentario se envía como `addComment` y un reenvío no lo duplica (RF-22);
   - la imagen se reserva, se suben sus dos objetos con progreso y se confirma (RF-39). Si se corta a medias, se reutiliza la reserva (RF-41).
6. **Cerrar sesión.** `clearAll` vacía copia, cola, miniaturas, imágenes y pendientes (RF-47).

## Decisiones técnicas

- **D1: Conflictos de Google e iCloud contra el proveedor**, leyendo el evento justo antes de escribir. Descartado comparar con la fila de CaFam, que puede llevar hasta 15 minutos de retraso respecto a Google y no vería un cambio reciente (caso límite de la spec). Cubre: RF-5, RF-6.
- **D2: Expandir series en el navegador con `expand.ts` (`ical.js`), cargado con `import()` solo cuando hay un cambio de serie pendiente o sin red.** La constitución lo permite: "ical.js… en módulos de `src/lib/` del servidor o puros", y `expand.ts` es puro. La guardia de `no-secrets.test.ts` que hoy lo limita al servidor se ajusta para admitir esta importación perezosa. Descartado escribir un expansor propio, que podría dar repeticiones distintas a las del servidor en los cambios de hora. **Necesita tu aprobación expresa**, porque cambia una regla del proyecto que hoy es "solo servidor". Cubre: RF-12.
- **D3: Conflicto de serie por los totales de toda la serie** (excepciones, imágenes, comentarios y la última fecha de cambio), guardados en la copia al leerla. Descartado comparar solo las repeticiones del rango, que no vería cambios fuera de él. Contra: un cambio de otra persona fuera del alcance elegido también pregunta. Es más seguro preguntar de más que pisar sin avisar. Cubre: RF-14, RF-15.
- **D4: Envío con la app cerrada con Background Sync en `sw.js` sin empaquetar, con el bucle escrito dos veces y probado con los mismos casos.** Descartado empaquetar el service worker con Next o un bundler, que sería una herramienta nueva (P6). Descartado también no implementar RF-42. Cubre: RF-42, RF-45.
- **D5: Dos Route Handlers para el service worker**, que comparten el código con las Server Actions. Descartado llamar a Server Actions desde el service worker, que necesitan el id de acción interno de Next y cambian en cada despliegue. Cubre: RF-42, RF-44.
- **D6: Imágenes con URL firmadas de subida**, creadas por el servidor con la sesión del usuario y RLS. Descartado subir con el cliente de Supabase del navegador, que el service worker no tiene porque no puede leer `document.cookie`. Descartado también pasar la imagen por una función de Vercel, por su límite de 4,5 MB. Cubre: RF-39 a RF-41.
- **D7: Idempotencia de las imágenes** guardando el id reservado antes de subir. Una reserva purgada (más de 1 h) se repite. Descartado reservar en cada intento, que dejaría reservas huérfanas y gastaría el límite de 10 por evento. Cubre: RF-41.
- **D8: Cuenta retenida (`held`)**: el cambio se queda en la cola y `flush` sigue con lo que no depende de él. Se vuelve a intentar al reconectar la cuenta o en el siguiente envío. Descartado pasarlo a "Cambios no enviados", que contradice RF-7. Cubre: RF-7, RF-8.
- **D9: Miniaturas como `Blob` en IndexedDB**, descargadas en segundo plano tras la lectura. Descartado meterlas en la copia como base64, que ocupa un 33 % más y hace lenta cada lectura de la copia. Descartado también la Cache API, porque `downloadImage` pide cada imagen con un `?v=` aleatorio y `no-store` para pasar por RLS. Cubre: RF-29, RNF-2.
- **D10: Las imágenes grandes abiertas con red se guardan, como mucho 30.** Descartado guardarlas todas, que no cabe en RNF-2. Cubre: RF-31.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1, RF-2, RF-3 | `gates.ts`, `offline-writes` |
| RF-4 | `offline-writes` (escrituras de siempre), `flush` |
| RF-5, RF-6 | `read-event.ts`, `offline-writes` (D1) |
| RF-7, RF-8 | `offline-writes` (`held`), `flush`, `offline-provider`, `changes-sheet` (D8) |
| RF-9 | `offline-writes`, `changes-sheet` |
| RF-10, RF-11 | `gates.ts`, `SeriesScopeDialog`, `RepeatField`, `offline-writes` |
| RF-12 | `series-overlay.ts` (D2) |
| RF-13 | `series-loss.ts`, `offline-reads` (totales) |
| RF-14, RF-15 | `offline-writes`, `changes-sheet` (D3) |
| RF-16 | `gates.ts` |
| RF-17 | `offline-reads` |
| RF-18 | `EventComments` sin red |
| RF-19, RF-20 | `outbox`, `overlay`, `EventComments` |
| RF-21, RF-22 | `offline-writes`, `changes-sheet` |
| RF-23, RF-24, RF-25 | `gates.ts`, `outbox`, `overlay`, `EventComments` |
| RF-26, RF-27, RF-28 | `offline-writes`, `changes-sheet` |
| RF-29 | `offline-reads`, `thumbs.ts`, `db` (D9) |
| RF-30 | `EventImages` sin red |
| RF-31 | `image-cache.ts` (D10) |
| RF-32 | `pending-images` en `db`, `EventImages` |
| RF-33, RF-34 | `image-limits.ts` |
| RF-35 | `overlay`, `EventImages` |
| RF-36, RF-37 | `gates.ts`, `overlay`, `EventImages` |
| RF-38 | `offline-writes` |
| RF-39, RF-40, RF-41 | `image-upload.ts`, `/api/offline/image`, `changes-sheet` (D6, D7) |
| RF-42 | `background.ts`, `sw.js`, `/api/offline/apply` (D4, D5) |
| RF-43 | `sw.js` (`lastBackgroundSync`), `offline-provider` |
| RF-44 | `/api/offline/apply` (`401`), `sw.js` |
| RF-45 | candado `cafam-offline-flush` en `flush` y `sw.js` |
| RF-46 | `background.ts`, `flush` al abrir |
| RF-47 | `db.clearAll` |
| RF-48 | `/privacy` |

RNF-1 → D4 y RF-46. RNF-2 → D9, D10, `image-limits` (medido). RNF-3 → validación zod y RLS en `offline-writes` y en las dos rutas. RNF-4 → las escrituras al proveedor solo en el servidor (`writeEngineDeps`). RNF-5 → sin dependencias: Background Sync y `createSignedUploadUrl` son de la plataforma y del cliente de Supabase que ya está. RNF-6 → `components/ui` e identidad Nexo.

## Riesgos y mitigaciones

- **R1: El bucle del service worker se separa del de `flush.ts`.** Mitigación: un único archivo de casos de prueba que pasa por los dos (D4).
- **R2: La sesión caduca con la app cerrada.** El proxy renueva la cookie en la petición del service worker, y si no puede, la ruta responde `401` y se conserva todo (RF-44).
- **R3: iCloud no da un recurso por repetición.** `readEvent` saca el `VEVENT` con el `RECURRENCE-ID`, o la repetición calculada de la serie si no hay uno propio, con `icloud-ics.ts`.
- **R4: Cuota de almacenamiento del navegador.** Al pasar de RNF-2 (medido en las tareas), primero se vacía `images`. Un `QuotaExceededError` al añadir una imagen sin red avisa y no la guarda (caso límite).
- **R5: Peso de `ical.js` en el navegador** (unos 50 KB comprimido). Mitigación: `import()` solo cuando hace falta (D2); nunca en el JavaScript inicial.
- **R6: Muchos falsos conflictos de serie** por D3. Mitigación: se mide en el recorrido con dos usuarios. Si molesta, se puede acotar a las excepciones del alcance con una función de Postgres en otra spec.
- **R7: Background Sync no existe en Safari ni en Firefox.** Esos navegadores envían al abrir (RF-46). Se documenta en `/privacy` y en `AGENTS.md`.

## Dudas abiertas

Ninguna técnica. Necesitan tu aprobación expresa al aprobar el plan:

- **D2:** `expand.ts` (`ical.js`) también en el navegador, con carga perezosa.
- **D5:** las dos rutas nuevas, `/api/offline/apply` y `/api/offline/image`.
