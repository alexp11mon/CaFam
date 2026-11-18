# Tasks 035 — Modo sin conexión, fase 2

> Estado: **Aprobadas** (2026-11-17). El usuario pidió hacerlas todas seguidas, con un commit por tarea.

Spec: `specs/035-sin-conexion-fase-2/spec.md`. Plan: `specs/035-sin-conexion-fase-2/plan.md`.

Cada tarea se hace con el test primero (rojo → verde). Ninguna se cierra sin la verificación obligatoria (P8):

```
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Además:

- `npm run test:db` en las tareas que tocan acceso a datos: T3, T6, T7 y T8;
- prueba manual a ≤ 768 px y en escritorio en las tareas de interfaz: T10 a T12.

Rama: `035-sin-conexion-fase-2`, creada desde la de la 034 una vez cerrada.

## Tareas

- [x] T1 Ampliar la cola y sus esquemas con series, comentarios e imágenes (`outbox.ts`, `schemas.ts`)
  Hecho cuando: `npm test -- offline-outbox offline-schemas` en verde. Los tests cubren:
  - los tipos nuevos `series.update`, `series.delete`, `comment.add`, `comment.update`, `comment.delete`, `image.add` e `image.delete`, y `repeat` en `event.create` y `event.update`;
  - fundir un comentario añadido y luego editado (llega uno, con el último texto) y uno añadido y luego borrado (no llega nada);
  - fundir dos cambios de la misma serie con el mismo alcance;
  - borrar un evento quita sus comentarios e imágenes pendientes;
  - un evento rechazado arrastra sus comentarios e imágenes;
  - zod acepta los cambios válidos y rechaza un comentario vacío o de más de 1.000 caracteres, un alcance desconocido y un `repeat` mal formado.

  Cubre: RF-11, RF-19, RF-22, RF-23, RF-24, RF-32, RF-36, RNF-3 | Módulo: outbox, schemas

  Evidencia (2026-11-18): `npm test -- offline-outbox offline-schemas` 26 en verde (10 casos nuevos de la cola y 5 de los esquemas). `image.add` no pasa por el esquema del servidor: la imagen va por su ruta (D5). Las series se funden por alcance y ocurrencia (`series:<alcance>:<id>`). Verificación completa: typecheck, lint (el aviso de siempre en `event-form.tsx`), format, 312 archivos y 2.931 tests, y build en verde. Se arregló de paso el error sin capturar de `offline-app.test.tsx` (`scrollIntoView` en jsdom).

- [x] T2 Decidir sin red qué se puede hacer y cómo queda una serie (`gates.ts`, `image-limits.ts`, `series-loss.ts`, `series-overlay.ts`)
  Hecho cuando: `npm test -- offline-gates offline-image-limits offline-series no-secrets` en verde. Los tests cubren:
  - los traídos se escriben sin red con las mismas reglas que con red, con solo lectura del proveedor, cuenta sin permiso y mover solo dentro de la misma cuenta;
  - los tres alcances y "Repetir" en calendarios normales, pero no en traídos;
  - quién edita y quién borra un comentario o una imagen según el rol de la copia;
  - 10 imágenes por evento (subidas más pendientes) y 20 pendientes en total;
  - lo que se perdería con "Este y los siguientes" y con "Todos los eventos";
  - las repeticiones nuevas de una serie cambiada, borrada desde una fecha, creada o convertida, incluido el cambio de hora;
  - `ical.js` solo se importa en los módulos permitidos y `expand.ts` llega al navegador solo con `import()` (D2).

  Cubre: RF-1, RF-2, RF-3, RF-10, RF-11, RF-12, RF-13, RF-16, RF-23, RF-24, RF-33, RF-34, RF-36 | Módulo: gates, image-limits, series-loss, series-overlay

  Evidencia (2026-11-18): `npm test -- offline-gates offline-image-limits offline-series no-secrets` 38 en verde. `series-overlay.ts` planifica con `planSeriesChange`/`planSeriesDelete` y expande con `expandRows`, como el servidor: el caso de "Todos los eventos" a las 19:00 cruza el cambio de hora del 25 de octubre y todas quedan a las 19:00 de Madrid. La guardia nueva de `no-secrets` recorre el grafo de importaciones estáticas desde cada componente cliente (parando en los `"use server"`, que llegan como referencia) y comprueba que no llega a `expand.ts` ni a `series-overlay.ts`. `gates.ts` no importa valores de `series-write` para no arrastrar `ical.js`. Las funciones nuevas aún no se usan en la interfaz: se conectan en la T10. Verificación completa en verde (314 archivos, 2.952 tests).

- [x] T3 Leer en el servidor la copia de formato 2 (`offline-reads.ts`)
  Hecho cuando: `npm run test:db -- offline-snapshot` en verde. Los tests cubren:
  - filas de serie con sus totales de toda la serie;
  - excepciones del rango;
  - los 50 comentarios más recientes por evento, con autor y "editado";
  - imágenes `ready` del rango, sin las `pending`;
  - nada de un calendario ajeno;
  - una copia de formato 1 se descarta y la cola se conserva.

  Cubre: RF-13, RF-14, RF-17, RF-29 | Módulo: offline-reads

  Evidencia (2026-11-18): `npm run test:db -- offline-snapshot` 6 en verde, con una excepción, 52 comentarios (quedan los 50 últimos, el último editado), imágenes `ready` y `pending` y un evento de Sam que Ana no ve. Lo nuevo está en `app/dashboard/offline-reads-detail.ts` (`seriesOf`, `commentsOf`, `imagesOf`), con lecturas por trozos de 150 ids y páginas de 1.000. Los totales cuentan todas las excepciones de la serie, también fuera del rango (D3). Cada imagen lleva su `objectId` para descargar la miniatura. `SNAPSHOT_FORMAT` pasa a 2: `offline-db.test.ts` comprueba que una copia de formato 1 se descarta y la cola se conserva. El test de RF-66 de la 034 ya no prohíbe comentarios e imágenes, que la 035 guarda a propósito. Verificación completa en verde y `npm run test:db` entero: 51 archivos, 573 tests.

- [x] T4 Guardar miniaturas, imágenes abiertas e imágenes pendientes en el dispositivo (`db.ts` versión 2, `thumbs.ts`, `image-cache.ts`)
  Hecho cuando: `npm test -- offline-db offline-thumbs offline-image-cache` en verde, con el IndexedDB en memoria de los tests de la 034. Los tests cubren:
  - el paso de la versión 1 a la 2 sin perder la cola;
  - descargar solo las miniaturas que faltan, 4 a la vez, y borrar las que ya no están;
  - como mucho 30 imágenes grandes, sale la usada hace más tiempo;
  - `pending-images` con su `reservedId`;
  - `clearAll` vacía los almacenes nuevos;
  - un `QuotaExceededError` se avisa sin guardar.

  Cubre: RF-29, RF-31, RF-35, RF-41, RF-47 | Módulo: db, thumbs, image-cache

  Evidencia (2026-11-18): `npm test -- offline-db offline-thumbs offline-image-cache` 15 en verde. El IndexedDB en memoria de los tests ahora conoce versiones (el paso de la 1 a la 2 crea los tres almacenes nuevos y conserva la cola), guarda los `Blob` sin clonarlos (jsdom no sabe) y simula un disco lleno (`quotaExceeded`). `syncThumbs` descarga por `objectId`, nunca más de 4 a la vez (medido en el test), y borra las que ya no están. La caché de imágenes grandes guarda 30 y sale la usada hace más tiempo; abrir una la marca como usada. `savePendingImage` devuelve `false` con el disco lleno y `rememberImage` lo ignora. Verificación completa en verde (316 archivos, 2.962 tests).

- [x] T5 Leer un evento en Google e iCloud (`readEvent`, `read-event.ts`)
  Hecho cuando: `npm test -- google-read-event icloud-read-event` en verde con respuestas sintéticas en `tests/fixtures/sync/`. Los tests cubren:
  - Google: evento suelto y repetición; `404` y `410` → `null`;
  - iCloud: recurso suelto, repetición con su propio `VEVENT`, repetición calculada de la serie y `404` → `null`;
  - `401` → `ProviderError` `revoked`;
  - campos en la forma de `WritableEvent`.

  Cubre: RF-5, RF-6 | Módulo: providers, read-event

  Evidencia (2026-11-18): `npm test -- google-read-event icloud-read-event` 9 en verde, con `tests/fixtures/sync/google-event.json` (suelto, repetición, día completo y cancelado) y `icloud-series.ics` (serie con `VTIMEZONE`, `EXDATE` y una repetición con su propio `VEVENT`). `readEvent` está en `ProviderSession`: Google hace `GET events/{id}` y da `null` con 404, 410 o `cancelled`; iCloud lee el recurso y busca el evento con `expandObject` en una ventana de un año a cada lado de la clave de la repetición. `read-event.ts` no importa `ical.js` directamente: pasa por `icloud-ics.ts`. Verificación completa en verde (318 archivos, 2.971 tests).

- [x] T6 Aplicar en el servidor los cambios de Google e iCloud hechos sin red (`offline-writes.ts`)
  Hecho cuando: `npm run test:db -- offline-apply-synced` en verde, con el proveedor simulado (`vi.mock` del cliente de Google e iCloud) y el calendario traído sembrado en dev. Los tests cubren:
  - crear, cambiar, mover dentro de la cuenta y borrar → primero el proveedor y después CaFam;
  - el proveedor cambió el evento → conflicto con su versión;
  - el proveedor lo borró → conflicto `null`;
  - `revoked` → `held` sin escribir;
  - el proveedor rechaza → `rejected` con el texto de `writeErrorText`;
  - un Lector o un calendario de solo lectura del proveedor → `rejected`.

  Cubre: RF-1, RF-2, RF-4, RF-5, RF-6, RF-7, RF-9, RNF-3, RNF-4 | Módulo: offline-writes

  Evidencia (2026-11-18): `npm run test:db -- offline-apply` 27 en verde (12 de `offline-apply-synced` y los 15 de la 034), con `openSession` simulado y una cuenta de Google sembrada en dev con tres calendarios (dos escribibles y uno de solo lectura). `readSyncedEvent` (`write-event.ts`) usa el mismo `sync_write_context` que escribir, así que un Lector o un calendario de solo lectura se rechazan antes de llamar al proveedor; si el proveedor responde `revoked`, llama a `sync_fail` como una escritura (aviso "Volver a conectar"). `offline-writes.ts` compara la base con el evento del proveedor y escribe con `updateSingle` contra esa versión. Una cuenta ya marcada hace que la base de datos responda "sin permiso": se distingue leyendo el calendario (rol, acceso del proveedor y `can_write`) y se devuelve `held`. `flush.ts` y la hoja de cambios tratan `held` como `retry` hasta la T9. Limitación anotada en el código: un alta en un traído coge el id del proveedor, así que reenviarla tras perder la respuesta la duplica (arreglarlo pide una migración). Verificación completa en verde (318 archivos, 2.971 tests).

- [x] T7 Aplicar en el servidor series, comentarios y borrados de imágenes hechos sin red (`offline-writes.ts`)
  Hecho cuando: `npm run test:db -- offline-apply-series offline-apply-comments` en verde. Los tests cubren:
  - "Este y los siguientes" y "Todos los eventos" con `confirmLoss`;
  - crear una serie y convertir un suelto con `repeat`;
  - serie cambiada por otro → conflicto con la serie actual y su `series_loss`;
  - comentario o imagen añadidos por otro en la serie → conflicto;
  - comentario: añadir dos veces con el mismo `clientId` deja uno; editar con conflicto si cambió; editar uno borrado → `rejected`; borrar uno que ya no está → `applied`; evento borrado o usuario expulsado → `rejected`;
  - borrar una imagen: la propia, como propietario o como Editor → `applied`; ya borrada → `applied`; la ajena siendo Lector → `rejected`.

  Cubre: RF-10, RF-11, RF-14, RF-15, RF-21, RF-22, RF-26, RF-27, RF-28, RF-38 | Módulo: offline-writes

  Evidencia (2026-11-18): `npm run test:db -- offline-apply` 43 en verde en 4 archivos (8 de `offline-apply-series`, 8 de `offline-apply-comments` y los de la 034 y la T6), y `npm run test:db -- event-series event-images event-comments offline-snapshot` 95 en verde tras mover `createSeries`, `convertToSeries` y la materialización (`materializeWith`) de las acciones a `event-writes.ts`. Las series se comparan con `sameSeries` (`conflict.ts`, con sus tests unitarios): campos, regla, fechas borradas y los totales que calcula `totalsOf` (extraída de la lectura de la copia); el conflicto lleva la serie actual y su `series_loss`. Un alta con `repeat` usa el id del navegador; convertir no se da por hecho aunque los campos coincidan. Limitación anotada en el código: reenviar un cambio de serie tras perder la respuesta pregunta en lugar de darlo por hecho. `npm test` en verde (318 archivos, 2.973 tests) con `--maxWorkers=4`: con todos los hilos, 1 o 2 tests de interfaz distintos en cada pasada agotan su tiempo por carga ajena de la máquina, y cada uno pasa solo. typecheck, lint, format y build en verde.

- [x] T8 Abrir las rutas del service worker y subir imágenes pendientes (`/api/offline/apply`, `/api/offline/image`, `image-upload.ts`)
  Hecho cuando: `npm test -- offline-routes offline-image-upload` y `npm run test:db -- offline-image-route` en verde. Los tests cubren:
  - sin sesión `401`; cambio no válido → `rejected`; el mismo resultado que la acción;
  - `reserve` devuelve URL firmadas de subida con la sesión del usuario, y con `reservedId` todavía `pending` no reserva otra;
  - `429` con el límite de siempre; `404` si el evento ya no está;
  - `confirm`, y `404` si la reserva se purgó;
  - el cliente guarda el id reservado antes de subir, sube dos a la vez con progreso y, tras un corte, reutiliza la reserva (una sola imagen al final).

  Cubre: RF-39, RF-40, RF-41, RF-42, RF-44, RNF-3 | Módulo: rutas offline, image-upload

  Evidencia (2026-11-18): `npm test -- offline-routes offline-image-upload` 13 en verde y `npm run test:db -- offline-image-route` 5 en verde, subiendo bytes reales a las URL firmadas de dev. La acción y `/api/offline/apply` comparten `applyWithSession` (`offline-session.ts`); `/api/offline/image` llama a `offlineImage` (`offline-images.ts`), que reserva con `reserve_event_images` (materializando la repetición si hace falta), firma con `createSignedUploadUrl` y la sesión del usuario, y responde `429`, `404`, `409` (falta un objeto al confirmar) o `503` si falla Supabase. Storage no firma una URL para un objeto que ya existe: tras un corte, ese objeto llega con URL nula y el cliente no lo vuelve a subir. Cada respuesta lleva también la URL completa, así el service worker no necesita configuración. `image-upload.ts` guarda el id antes de subir, sube los dos objetos a la vez con progreso y repite la reserva una vez si se purgó. Verificación completa en verde (320 archivos, 2.986 tests, con 4 hilos).

- [x] T9 Enviar con la app cerrada y con cuentas retenidas (`flush.ts`, `background.ts`, `public/sw.js`)
  Hecho cuando: `npm test -- offline-flush offline-sw-sync offline-background` en verde. `offline-flush` y `offline-sw-sync` pasan los mismos casos (archivo compartido) por `flush.ts` y por `sw.js` cargado en un `vm`. Los tests cubren:
  - `held` deja el cambio y los de su entidad en la cola y sigue con el resto;
  - imágenes por `image-upload`;
  - `applied`, `conflict`, `rejected` con dependientes, `retry` y `unauthenticated`;
  - el candado `cafam-offline-flush` compartido;
  - `meta.lastBackgroundSync`;
  - registrar `sync` solo si el navegador lo tiene;
  - `CACHE_NAME` `cafam-v7`;
  - `sw-no-data` sigue en verde.

  Cubre: RF-4, RF-7, RF-8, RF-39, RF-42, RF-44, RF-45, RF-46 | Módulo: flush, background, sw.js

  Evidencia (2026-11-18): `npm test -- offline-flush offline-sw-sync offline-background sw-no-data` 47 en verde. Los 11 casos de `tests/unit/offline-flush-cases.ts` (orden, conflicto, rechazado con dependientes, `held`, reintento, fallo de red, sin sesión, imagen subida, imagen rechazada que conserva sus bytes, imagen sin bytes y el candado) pasan por `flush.ts` y por `sw.js` cargado en un `vm`, con el mismo servidor falso (`fakeServer`) detrás de `fetch`. `flush.ts` vuelve a leer la cola de IndexedDB dentro del candado (el service worker pudo enviar parte), salta lo retenido con sus dependientes, sube las imágenes con `uploadPendingImage` y deja en `queue-store` qué cambios esperan a qué cuenta (`held`, para la T11). `background.ts` registra `cafam-offline` con `getRegistration` (no `ready`, que nunca se resuelve sin service worker) al encolar y si queda algo tras enviar. `sw.js` (`cafam-v7`) atiende `sync`, suma lo aplicado en `meta.lastBackgroundSync` (`readBackgroundSync` en `db.ts`) y rechaza la promesa solo si queda algo por reintentar (sin sesión o con una cuenta retenida no sirve que el navegador repita). Verificación completa en verde (322 archivos, 3.017 tests, con 4 hilos).

- [x] T10 Usar comentarios, imágenes y series en el detalle sin red
  Incluye `EventComments`, `EventImages`, `ImageViewer`, `SeriesScopeDialog`, `RepeatField` y la confirmación de pérdidas con `series-loss`.
  Hecho cuando: `npm test -- event-comments event-images image-viewer series-scope-dialog repeat-field` en verde, con los casos sin red. Los tests cubren:
  - comentarios guardados y "Ver anteriores" deshabilitado con "Necesita conexión";
  - añadir, editar y borrar con "Pendiente de enviar" y "Deshacer";
  - galería con miniaturas, visor con la imagen guardada o con el aviso de RF-31;
  - añadir hasta los límites y quitar una pendiente;
  - borrar con "Deshacer";
  - los tres alcances y "Repetir" sin red, con la confirmación de pérdidas.

  Además, prueba manual con la red cortada en el navegador, a 390 px y en escritorio.

  Cubre: RF-10, RF-11, RF-12, RF-13, RF-18, RF-19, RF-20, RF-23, RF-24, RF-25, RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, RF-36, RF-37 | Módulo: detalle sin red

  Evidencia (2026-11-18): `npm test -- event-comments event-images image-viewer series-scope-dialog repeat-field offline-event-actions` 69 en verde (8 archivos). Nuevos: `offline-event-actions.test.ts` (pérdidas de "Todos los eventos" con confirmación, "Este y los siguientes", borrar toda la serie, arrastre, "Solo este evento", "Repetir" al crear, convertir y regla no válida, Google escribible y de solo lectura), `event-comments-offline.test.tsx` (guardados, "Ver anteriores" deshabilitado con "Necesita conexión", añadir con "Pendiente de enviar" y "Deshacer", editar y borrar a la cola) y `event-images-offline.test.tsx` (miniatura del dispositivo sin descargar, visor con el aviso de RF-31, borrar con "Deshacer", pendientes con "Quitar", límite de 10 por evento y de 20 en el dispositivo). La prueba destapó que, cuando solo cabían algunas imágenes, no se decía por qué: `addImagesOffline` calcula el motivo con las que entran. `syncThumbs` se conecta al leer la copia (`offline-provider`). Prueba en el navegador con la red cortada (`scripts/e2e-offline-detail.mjs`, Edge y Playwright) a 390 y 1440 px: comentario guardado, comentar e imagen pendiente sin red, y al volver la red llegan 2 comentarios y 1 imagen en los dos tamaños; usuarios de prueba borrados. Verificación completa: typecheck, lint, test (325 archivos, 3.033 tests) y build en verde; `format:check` en verde para `src`, `tests`, `public` y `scripts` (solo fallan `graphify-out/`, `.claude/settings.json` y `CLAUDE.md`, ajenos a la tarea).

- [x] T11 Mostrar lo nuevo en "Cambios no enviados", el aviso al abrir y `/privacy`
  Incluye `changes-sheet.tsx`, `offline-provider.tsx` y `/privacy`.
  Hecho cuando: `npm test -- changes-sheet offline-provider privacy` en verde. Los tests cubren:
  - conflicto de serie con las dos versiones y lo que se perdería;
  - comentario rechazado con su texto y editado con conflicto;
  - imagen rechazada con "Descargar";
  - cuenta retenida con "Volver a conectar";
  - al abrir, "N cambios sincronizados" desde `lastBackgroundSync` y los conflictos que dejó;
  - al reconectar la cuenta, `flush`;
  - cerrar sesión vacía también miniaturas, imágenes y pendientes;
  - la sección de `/privacy` actualizada.

  Cubre: RF-7, RF-8, RF-9, RF-14, RF-15, RF-21, RF-27, RF-40, RF-43, RF-47, RF-48 | Módulo: changes-sheet, offline-provider, privacy

  Evidencia (2026-11-18): `npm test -- changes-sheet offline-provider privacy` en verde. Casos nuevos: serie en conflicto con las dos versiones, "Ahora se repite: …" y "Se perderán 2 cambios, 1 imagen y 3 comentarios."; comentario editado rechazado con su texto; imagen rechazada con "Descargar" (y "Descartar" borra sus bytes del dispositivo); cuenta retenida con sus cambios y "Volver a conectar" a `/dashboard/connections/<id>`; "Conservar la mía" con la cuenta retenida avisa en vez de "Necesita conexión"; al abrir, "3 cambios sincronizados" desde `lastBackgroundSync` una sola vez y los conflictos que dejó en la lista; un cambio retenido sigue en la cola y se envía al volver a la app tras conectar la cuenta; cerrar sesión deja vacíos miniaturas, imágenes abiertas e imágenes pendientes; `/privacy` con comentarios, miniaturas, imágenes abiertas, lo pendiente, la pérdida de imágenes pendientes si el navegador borra los datos y el envío con la app cerrada. Prueba en el navegador (Edge, 390 y 1440 px) con un conflicto de serie, un comentario y una imagen rechazados puestos en IndexedDB: la hoja muestra todo y "Descargar" baja `imagen-cafam.jpg`; usuarios de prueba borrados. Verificación completa en verde: typecheck, lint, format:check, test (325 archivos, 3.042 tests) y build.

- [x] T12 Validar RF por RF y documentar
  Hecho cuando hay en este archivo:
  - la tabla RF-1 a RF-48 con el test que cubre cada uno;
  - las medidas de RNF-2 (copia con 300 miniaturas y 50 comentarios en 200 eventos, y 20 pendientes);
  - capturas a 390, 768 y 1440 px en claro y oscuro de la galería sin red, un comentario pendiente y un conflicto de serie;
  - los recorridos manuales de los criterios de finalización: Google e iCloud de prueba, series con dos usuarios, comentarios e imágenes en el iPhone, envío con la app cerrada en Chrome de Android y en escritorio, y envío al abrir en el iPhone;
  - `AGENTS.md` actualizado (estado, "Añadido por la spec 035", trampas de Background Sync y de las URL firmadas).

  Cubre: todos | Módulo: validación

  Evidencia (2026-11-18): ver "Validación RF por RF (T12)" más abajo: la tabla RF-1 a RF-48, RNF-2 medido (copia 11,6 MB con 10.000 comentarios y 300 miniaturas, 28,1 MB con las 30 imágenes abiertas; pendientes 11,5 MB), 12 capturas en `capturas/`, los recorridos hechos en Edge (detalle sin red a 390 y 1440 px, envío con la app cerrada en escritorio y hoja de cambios) y los que quedan para el usuario con cuentas reales y dispositivos. `AGENTS.md` actualizado.

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T2, T6 |
| RF-2 | T2, T6 |
| RF-3 | T2 |
| RF-4 | T6, T9 |
| RF-5, RF-6 | T5, T6 |
| RF-7 | T6, T9, T11 |
| RF-8 | T9, T11 |
| RF-9 | T6, T11 |
| RF-10 | T2, T7, T10 |
| RF-11 | T1, T2, T7, T10 |
| RF-12 | T2, T10 |
| RF-13 | T2, T3, T10 |
| RF-14 | T3, T7, T11 |
| RF-15 | T7, T11 |
| RF-16 | T2 |
| RF-17 | T3 |
| RF-18 | T10 |
| RF-19, RF-20 | T1, T10 |
| RF-21 | T7, T11 |
| RF-22 | T1, T7 |
| RF-23, RF-24 | T1, T2, T10 |
| RF-25 | T10 |
| RF-26 | T7 |
| RF-27 | T7, T11 |
| RF-28 | T7 |
| RF-29 | T3, T4 |
| RF-30 | T10 |
| RF-31 | T4, T10 |
| RF-32 | T1, T10 |
| RF-33, RF-34 | T2, T10 |
| RF-35 | T4, T10 |
| RF-36 | T1, T2, T10 |
| RF-37 | T10 |
| RF-38 | T7 |
| RF-39 | T8, T9 |
| RF-40 | T8, T11 |
| RF-41 | T4, T8 |
| RF-42 | T8, T9 |
| RF-43 | T11 |
| RF-44 | T8, T9 |
| RF-45, RF-46 | T9 |
| RF-47 | T4, T11 |
| RF-48 | T11 |
| RNF-1 a RNF-6 | T6, T8, T9, T12 |

## Validación RF por RF (T12)

Tests de `tests/unit/` salvo los marcados (test:db), que están en `tests/integration/`. Las pruebas en el navegador corren en Edge contra `next start`:

- "e2e-detalle" es `scripts/e2e-offline-detail.mjs`;
- "e2e-cerrada" es `scripts/e2e-offline-background.mjs`;
- "hoja" es la comprobación de la hoja de cambios de la T11.

| RF | Cubierto por |
|----|--------------|
| RF-1 | `offline-gates`; `offline-event-actions` (Google escribible); `event-panel` ("Editar" en un traído sin red); `offline-apply-synced` (test:db) |
| RF-2 | `offline-gates` (solo lectura del proveedor y cuenta sin permiso); `offline-event-actions`; `offline-apply-synced` (test:db) |
| RF-3 | `offline-gates` (`offlineMoveTargets`: misma cuenta); `offline-apply-synced` (test:db) |
| RF-4 | `offline-apply-synced` (test:db: primero el proveedor y solo si acepta, CaFam) |
| RF-5 | `google-read-event`; `icloud-read-event`; `offline-apply-synced` (test:db: cambiado en el proveedor → conflicto) |
| RF-6 | `google-read-event`; `icloud-read-event` (borrado → `null`); `offline-apply-synced` (test:db) |
| RF-7 | `offline-apply-synced` (test:db, `held`); `offline-flush` y `offline-sw-sync` (casos compartidos: se salta y se conserva); `changes-sheet` ("Volver a conectar"); `offline-provider` |
| RF-8 | `offline-provider` (retenido y enviado al volver a la app tras conectar la cuenta) |
| RF-9 | `offline-apply-synced` (test:db: rechazo del proveedor con el motivo en español) |
| RF-10 | `offline-event-actions` (los tres alcances al guardar, arrastrar y borrar); `series-scope-dialog`; `offline-apply-series` (test:db) |
| RF-11 | `offline-event-actions` ("Repetir" al crear y al convertir); `repeat-field`; `offline-outbox`; `offline-apply-series` (test:db) |
| RF-12 | `offline-series` (repeticiones de la serie cambiada, con el cambio de hora); `offline-gates` |
| RF-13 | `offline-event-actions` (pide confirmar lo que se pierde según la copia); `offline-series` (`lossInCopy`) |
| RF-14 | `offline-conflict`; `offline-apply-series` (test:db); `changes-sheet` (las dos versiones y "Ahora se repite"); hoja |
| RF-15 | `offline-apply-series` (test:db: comentarios e imágenes nuevos en una repetición); `changes-sheet` ("Se perderán 2 cambios, 1 imagen y 3 comentarios.") |
| RF-16 | `offline-gates`; `offline-event-actions` (sin "Repetir" en un traído) |
| RF-17 | `offline-snapshot` (test:db: los 50 más recientes de cada evento del rango) |
| RF-18 | `event-comments-offline` (guardados y "Ver anteriores" deshabilitado con "Necesita conexión"); `event-panel`; e2e-detalle "comentario guardado sin red" |
| RF-19 | `event-comments-offline`; `offline-outbox`; `offline-apply-comments` (test:db, Lector) ; e2e-detalle "comentar sin red" |
| RF-20 | `event-comments-offline` ("Pendiente de enviar" y "Deshacer"); e2e-detalle |
| RF-21 | `offline-apply-comments` (test:db: evento borrado y expulsado); `changes-sheet` (texto visible) |
| RF-22 | `offline-apply-comments` (test:db: mismo `client_id` dos veces, una fila); `offline-outbox` |
| RF-23 | `event-comments-offline` (editar a la cola); `offline-gates` (`canEditComment`) |
| RF-24 | `offline-gates` (`canDeleteComment`: autor y propietario); `event-comments-offline` |
| RF-25 | `event-comments-offline` (borrar lo quita del detalle) |
| RF-26 | `offline-conflict`; `offline-apply-comments` (test:db: editado en otro sitio → conflicto) |
| RF-27 | `offline-apply-comments` (test:db); `changes-sheet` (editado y ya borrado, con su texto) |
| RF-28 | `offline-apply-comments` (test:db: borrar uno que ya no existe es `applied`) |
| RF-29 | `offline-thumbs` (descargar las que faltan y borrar las que sobran); `offline-snapshot` (test:db: imágenes del rango) |
| RF-30 | `event-images-offline` (miniatura del dispositivo sin descargar) |
| RF-31 | `event-images-offline` (visor con la miniatura y "La imagen completa necesita conexión"); `offline-image-cache` |
| RF-32 | `event-images-offline` (añadir sin red); e2e-detalle "añadir una imagen sin red" |
| RF-33 | `offline-image-limits`; `event-images-offline` (10 por evento con las guardadas) |
| RF-34 | `offline-image-limits`; `event-images-offline` (20 en el dispositivo) |
| RF-35 | `event-images-offline` ("Pendiente de enviar" y "Quitar"); `offline-outbox` (añadir + quitar = nada) |
| RF-36 | `offline-gates` (`canDeleteImage`) |
| RF-37 | `event-images-offline` (borrar con "Deshacer") |
| RF-38 | `offline-apply-comments` (test:db: borrar una imagen que ya no existe es `applied`) |
| RF-39 | `offline-image-upload` (dos a la vez y progreso); `offline-image-route`; `offline-routes`; e2e-detalle "al volver la red llegan" |
| RF-40 | `offline-image-route` (límites y evento borrado); `offline-flush` (a "Cambios no enviados"); `changes-sheet` ("Descargar"); hoja |
| RF-41 | `offline-image-upload` y `offline-image-route` (reserva reutilizada y objeto ya subido) |
| RF-42 | `offline-sw-sync` (el bucle del service worker con los casos compartidos); `offline-background`; e2e-cerrada "cerrar la app y volver la red" |
| RF-43 | `offline-sw-sync` (`lastBackgroundSync`); `offline-provider` ("3 cambios sincronizados" y conflictos que dejó); e2e-cerrada "al abrir, el aviso" |
| RF-44 | `offline-flush` y `offline-sw-sync` (casos compartidos: `401` conserva todo); `offline-routes` |
| RF-45 | `offline-flush` (cerrojo `cafam-offline-flush`); `offline-sw-sync`; `offline-provider` |
| RF-46 | `offline-background` (sin Background Sync no registra nada); `offline-provider` (envío al abrir) |
| RF-47 | `offline-provider` (cerrar sesión vacía miniaturas, imágenes y pendientes); `offline-db`; `sign-out-guard` |
| RF-48 | `privacy-page` |

RNF-1: Edge en escritorio probado aquí, también el envío con la app cerrada. Quedan para el usuario Chrome de Android, Safari de iOS y la app instalada en producción.

RNF-2: medido con `scripts/perf/offline-measure-035.mjs` (Edge, IndexedDB de la app y `navigator.storage.estimate()`):

- La medida usa imágenes de tipo foto con grano, codificadas como `prepareImage` (400 px a 0,75 y 2048 px a 0,82). El grano agranda el JPEG, así que es una cota alta.
- La copia ocupa **11,6 MB** con 200 eventos, 50 comentarios en **cada** uno (10.000 comentarios) y 300 miniaturas, frente a un límite de 40 MB:
  - el JSON pesa 4,4 MB y 0,9 MB guardado;
  - las miniaturas suman 6,2 MB, 21 KB cada una.
- Con las 30 imágenes grandes abiertas (16,5 MB) llega a **28,1 MB**, también por debajo de 40.
- Las 20 imágenes pendientes ocupan **11,5 MB**, 584 KB cada una, frente a un límite de 50 MB.

RNF-3: las rutas y `offline-writes` validan con zod y escriben con la sesión (`offline-apply*`, test:db, Lector y expulsado). RNF-4: `no-secrets` y las escrituras al proveedor solo con `writeEngineDeps` en el servidor. RNF-5: `package.json` sin cambios. RNF-6: las capturas y `design-tokens`.

### Capturas

En `capturas/`, a 390, 768 y 1440 px, en claro y oscuro:

- `detalle-sin-red-*`: la galería con una imagen pendiente, un comentario guardado y uno pendiente;
- `conflicto-serie-*`: la hoja "Cambios" con un conflicto de serie, cómo se repite ahora y lo que se perdería.

Salen de `scripts/screenshots-035.mjs`.

### Recorridos

Hechos aquí, en Edge:

- **Detalle sin red a 390 y 1440 px** (e2e-detalle, 12 pasos en verde): comentario guardado, comentar e imagen pendiente sin red, y al volver la red llegan 2 comentarios y 1 imagen.
- **Envío con la app cerrada en escritorio** (e2e-cerrada, 4 pasos en verde): con el comentario en la cola, se cierra la página y vuelve la red sin ninguna página abierta. El comentario llega al servidor en 1 s, y al abrir la app avisa "1 cambio sincronizado".
- **Hoja de cambios a 390 y 1440 px**: conflicto de serie, comentario rechazado con su texto e imagen rechazada con "Descargar" (baja `imagen-cafam.jpg`).
- **Series con dos usuarios**: cubiertas por `offline-apply-series` (test:db), con otra persona que cambia la serie, comenta o sube imágenes a una repetición. No hay recorrido con dos navegadores (R6, falsos conflictos).

Pendientes del usuario, porque necesitan cuentas reales o dispositivos que no hay aquí:

1. **Google**: con una cuenta conectada con escritura, sin red crear, cambiar, mover y borrar en un calendario traído; al volver la red, comprobar en Google Calendar. Cambiar el mismo evento en Google mientras tanto para ver el conflicto. Revocar el permiso en Google antes de recuperar la red para ver "Volver a conectar"; tras conectar, se envía.
2. **iCloud**: lo mismo con una cuenta de iCloud y el calendario del iPhone, incluida una repetición de una serie.
3. **Series con dos usuarios**: una persona cambia "Todos los eventos" sin red y la otra cambia una repetición con red. Al volver la red, la primera ve el conflicto con lo que se perdería.
4. **iPhone** (Safari y la app instalada): comentarios e imágenes sin red, con la cámara. Como no hay envío con la app cerrada, se comprueba que se envía al abrir la app (RF-46).
5. **Chrome de Android y Chrome de escritorio**: dejar un cambio sin red, cerrar la app y recuperar la red; llega sin abrirla, y al abrir avisa "N cambios sincronizados".

## Dudas abiertas

Ninguna.
