# Tasks 012 - Imágenes en los eventos

> Estado: **Aprobadas** por el usuario (2026-10-30).
> Spec: `specs/012-imagenes-en-eventos/spec.md` (aprobada el 2026-10-29). Plan: `specs/012-imagenes-en-eventos/plan.md` (aprobado el 2026-10-30).
> 13 tareas en dos iteraciones: T1–T6 (base de datos, Storage, limpieza y lógica pura) y T7–T13 (navegador, interfaz y validación). No se empieza la segunda sin cerrar la primera.
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si toca esquema, Storage o datos, también `npm run test:db -- <filtro>` (por tandas si salta el límite de Auth).
> - Si toca interfaz: capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo, y revisión con movimiento reducido (P9).
> - Un commit por tarea, citándola, en la rama `012-imagenes-en-eventos`. El primer commit lleva `plan.md` y `tasks.md`.
>
> Sin dependencias nuevas (P6): canvas, `createImageBitmap`, `XMLHttpRequest` y la API de Storage de `@supabase/supabase-js`.
> Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario (plan, "Pasos fuera del repositorio").

## Tareas

### Iteración 1 — Base de datos, Storage, limpieza y lógica pura

- [x] T1 Crear la tabla de imágenes con sus permisos y la cola de borrado
  Pasos:
  - Primero, `tests/integration/event-images.test.ts` en rojo, sembrando filas con `service_role`. Comprueba:
    - propietario, Editor y Lector leen las filas `ready` de su calendario; un ajeno y `anon` no ven nada; las `pending` solo las ve quien las reservó;
    - borra el autor, el propietario y un Editor; un Lector no borra la imagen de otro (0 filas);
    - nadie inserta ni actualiza directamente (`42501`);
    - borrar la imagen, el evento, el calendario o la cuenta del propietario deja el `object_id` en `image_purge_queue`, salvo si otra fila lo usa;
    - mover el evento a otro calendario y `merge_calendars` conservan las filas; el Lector del calendario anterior deja de verlas;
    - al borrar la cuenta del autor, `uploaded_by` queda nulo y la fila sigue;
    - `list_tables_without_rls()` sigue vacía.
  - Después, la migración `event_images` según "Modelo de datos" (tabla, RLS, cola y trigger).

  Hecho cuando: `npm run test:db -- event-images schema` en verde y `src/types/database.ts` con `event_images`. Cubre: RF-4, RF-15, RF-16, RF-17, RF-19, RF-29, RF-30 | Módulo: images-schema
  Evidencia (2026-10-30): rojo antes de la migración (11 tests, tabla inexistente). Migración `20261030100000_event_images.sql` aplicada en dev y tipos regenerados con `event_images` e `image_purge_queue`. `test:db -- event-images schema` 5 archivos y 48 tests en verde (11 de `event-images`; `schema` cubre `list_tables_without_rls`). typecheck, lint y format en verde, `npm test` 159 archivos y 1418 tests, build correcto.

- [x] T2 Reservar y confirmar imágenes con los límites atómicos
  Pasos:
  - Primero, ampliar `event-images.test.ts` en rojo:
    - un Lector reserva en su calendario y también en un calendario traído (sembrado como en la 007);
    - un ajeno o un evento inexistente da `CF404`; 0 u 11 elementos dan `22023`;
    - con 8 imágenes, pedir 5 devuelve 2 `id`; con 10, `CF429` `event`;
    - dos reservas simultáneas (`Promise.all`) de 6 no pasan de 10 en total;
    - con 300 `object_id` propios (sembrados), `CF429` `user`; las copias con el mismo `object_id` no cuentan doble;
    - con filas sembradas que suman más de `images_total_limit()`, `CF429` `total`;
    - `confirm_event_image` sin los dos objetos da `P0002`; de otro usuario, `CF404`.
  - Después, `reserve_event_images`, `confirm_event_image` e `images_total_limit` según "Contratos".

  Hecho cuando: `npm run test:db -- event-images` en verde. Cubre: RF-2, RF-4, RF-8, RF-20, RF-22, RF-23 | Módulo: images-functions
  Evidencia (2026-10-30): rojo antes de la migración (8 tests, funciones inexistentes). Migración `20261030110000_event_images_functions.sql` aplicada en dev y tipos regenerados. `test:db -- event-images` 19 tests en verde (incluida la reserva simultánea, que da exactamente 10). El código `CF429` lleva en el mensaje `event`, `user` o `total`. typecheck, lint y format en verde, `npm test` 1418 tests, build correcto.

- [x] T3 Crear el bucket privado y la matriz de permisos de Storage
  Pasos:
  - Primero, `tests/integration/storage-images.test.ts` en rojo, con usuarios reales y la API de Storage:
    - sin reserva, subir a `event-images` falla; con reserva propia, `full.jpg` y `thumb.jpg` suben y otro nombre no;
    - con una reserva de otro usuario, subir falla; un tipo que no es JPEG o más de 4 MB, también;
    - tras confirmar, los miembros descargan y un ajeno y `anon` no, aunque conozcan la ruta;
    - un Lector expulsado deja de descargar en la siguiente petición;
    - tras mover el evento a un calendario sin ese Lector, deja de descargar;
    - borrar un objeto que no está en la cola falla; en la cola, se borra;
    - `confirm_event_image` con los dos objetos pone `ready` y los `bytes` reales.
  - Después, la migración con el bucket, las funciones `can_read_event_image`, `image_upload_allowed` e `image_purge_pending` y las políticas de `storage.objects`.

  Hecho cuando: `npm run test:db -- storage-images` en verde. Cubre: RF-25, RF-26, RF-30 | Módulo: images-schema
  Evidencia (2026-10-30): rojo antes de la migración (6 tests). Migraciones `20261030120000_event_images_storage.sql` y `20261030120100_event_images_purge_claim.sql` aplicadas en dev. Dos hallazgos que ajustaron el plan (D5, D7): el CDN de Supabase seguía sirviendo la imagen a un Lector expulsado con la misma URL y token (se descarga con `?v=` aleatorio, que da `BYPASS`), y Postgres solo borra filas visibles por una política `SELECT` (los objetos se reclaman con el secreto y solo son visibles para `anon` 5 minutos). `test:db -- storage-images event-images` 27 tests en verde. typecheck, lint y format en verde, `npm test` 1418 tests, build correcto.

- [x] T4 Conservar las imágenes al copiar, sincronizar y subir a Google
  Pasos:
  - Primero, tests en rojo en `event-images.test.ts`:
    - `copy_calendar_for_owner` crea en cada copia las filas `ready` con el mismo `object_id`, autor, medidas y fecha, y el nuevo propietario descarga la imagen;
    - `sync_apply_events` que quita un evento traído deja su `object_id` en la cola (RF-18);
    - `sync_attach_uploaded` (subir a Google) conserva las filas (RF-32);
    - un calendario `missing` conservado mantiene sus imágenes.
  - Después, la migración `copy_calendar_images` (`create or replace` de `copy_calendar_for_owner`, plan D6).

  Hecho cuando: `npm run test:db -- event-images account-orphans sync-worker` en verde. Cubre: RF-18, RF-31, RF-32 | Módulo: images-copy
  Evidencia (2026-10-30): rojo en la copia (0 filas copiadas); la sincronización, desconectar conservando y subir a Google ya cumplían por diseño (D6) y quedan cubiertos. Migraciones `20261030130000_copy_calendar_images.sql` y `20261030130100_copy_calendar_images_fix.sql` (la segunda porque `account-apply` hace varias copias en una transacción y la tabla temporal chocaba, `42P07`). `test:db -- event-images account-copy account-apply sync-worker` 62 tests en verde (los de la 006 se llaman `account-*`, no `account-orphans`). typecheck, lint y format en verde, `npm test` 1418 tests, build correcto.

- [x] T5 Limpiar Storage cada hora sin la clave secreta
  Pasos:
  - Primero, en rojo:
    - `event-images.test.ts`: `images_claim_purge` con un secreto incorrecto da `42501`; con el correcto, caduca las reservas `pending` de más de 1 h, encola las carpetas sin fila de más de 1 h y devuelve la cola; `images_done_purge` la vacía; tras 5 intentos no reclama la fila; `sync_scheduled_jobs` (o su equivalente) incluye `images-purge`;
    - `tests/unit/images-purge-route.test.ts` (`@vitest-environment node`, Supabase simulado): `401` sin el `Bearer` correcto; con él, reclama, llama a `storage.remove` con `full` y `thumb` de cada `object_id`, confirma y devuelve `{ removed }`; un fallo de Storage no confirma esos objetos.
  - Después, `images_purge_trigger`, el `pg_cron` `images-purge`, `src/lib/images/purge.ts` y `src/app/api/images/purge/route.ts`.

  Hecho cuando: `npm run test:db -- event-images` y `npm test -- images-purge` en verde. Cubre: RF-16, RF-17, RF-18 | Módulo: images-purge-job
  Evidencia (2026-10-30): rojo (6 tests de BD, ruta inexistente). Migración `20261030140000_images_purge.sql` (`images_claim_purge` con `p_object_ids` y `p_orphan_age` para poder probar sin tocar lo de otros tests, `images_done_purge`, `images_purge_trigger`, `images_scheduled_jobs` y el `pg_cron` `images-purge` a las `:15`), `src/lib/images/purge.ts`, `paths.ts` y la ruta. `test:db -- event-images storage-images` 37 tests y `npm test -- images-purge` 5 tests en verde. typecheck, lint y format en verde, `npm test` 1423 tests, build correcto.

- [x] T6 Escribir la lógica pura de las imágenes
  Pasos:
  - Primero, `tests/unit/images-core.test.ts` en rojo:
    - `fitWithin` (horizontal, vertical, cuadrada, ya pequeña, 2048 y 400);
    - `isAcceptedType` acepta JPEG, PNG, WebP, HEIC y HEIF, y rechaza GIF, SVG y vacío;
    - `imageAlt("Cumpleaños de Ana", 1, 5)` da "Cumpleaños de Ana, imagen 2 de 5";
    - `objectPath(id, "full" | "thumb")`;
    - `slotsLeft` y el texto de "Solo caben N";
    - `getImageErrorMessage` para `CF429` (`event`, `user`, `total`), `CF404`, `P0002`, 20 MB, tipo, ilegible, red y desconocido, todos en español.
  - Después, `src/lib/images/limits.ts`, `fit.ts`, `alt.ts`, `paths.ts` y `error-messages.ts`.

  Hecho cuando: `npm test -- images-core` en verde. Cubre: RF-3, RF-5, RF-14, RF-20, RF-21, RF-22, RF-23 | Módulo: images-core
  Evidencia (2026-10-30): rojo (módulos inexistentes). `images-core.test.ts` 12 tests en verde. Los huecos libres los calcula la base de datos, así que `slotsLeft` no hace falta: basta `fitNotice(pedidas, reservadas)`. `isAcceptedType` mira la extensión cuando el navegador no da tipo (algunos HEIC). typecheck, lint y format en verde, `npm test` 1435 tests, build correcto.

### Iteración 2 — Navegador, interfaz y validación

- [x] T7 Reducir y subir imágenes desde el navegador
  Pasos:
  - Primero, en rojo, con `createImageBitmap`, canvas y `XMLHttpRequest` simulados en jsdom:
    - `tests/unit/prepare-image.test.ts`: rechaza más de 20 MB y un tipo no admitido sin decodificar; un fallo al decodificar da "Este navegador no puede leer esta imagen"; dibuja a las medidas de `fitWithin`, exporta JPEG con la calidad del plan y cierra el bitmap;
    - `tests/unit/upload-object.test.ts`: envía a la ruta del bucket con `apikey`, `Authorization` y `x-upsert: false`; informa del progreso; `abort` cancela; un error de red da `network`; un 409 cuenta como `ok`; un 4xx da `rejected`.
  - Después, `src/lib/images/prepare-image.ts` y `upload-object.ts`.

  Hecho cuando: `npm test -- prepare-image upload-object` en verde. Cubre: RF-3, RF-5, RF-6, RF-21, RF-24 | Módulo: images-prepare, images-upload
  Evidencia (2026-10-30): rojo (módulos inexistentes). `prepare-image.test.ts` 4 tests y `upload-object.test.ts` 5 tests en verde. `uploadObject` devuelve además `aborted` al cancelar y acepta como subido el 409 que Storage manda dentro de un 400. typecheck, lint y format en verde, `npm test` 1444 tests, build correcto.

- [x] T8 Reservar, confirmar, cancelar y borrar desde el servidor y cargar la galería
  Pasos:
  - Primero, en rojo, con Supabase simulado:
    - `tests/unit/image-actions.test.ts`: `reserveImages` valida y traduce `CF429` y `CF404`, y devuelve el aviso "Solo caben N" cuando hay menos `id`; `confirmImage`; `cancelImage` y `deleteImage` borran la fila y después los dos objetos; 0 filas da "ya no existe" o "sin permiso"; `deleteImage` revalida `/dashboard`;
    - `tests/unit/images-queries.test.ts`: las imágenes salen en orden de subida, con autor "Cuenta borrada" o "un antiguo miembro" (`authorLabel`), y `canDelete` para el autor, el propietario y un Editor, no para un Lector ajeno;
    - `load-event` devuelve `images` y `canAttach` para cualquier miembro, también en un traído.
  - Después, `src/app/dashboard/events/image-actions.ts`, `src/lib/images/queries.ts` y `load-event.ts`.

  Hecho cuando: `npm test -- image-actions images-queries load-event` en verde. Cubre: RF-2, RF-4, RF-8, RF-11, RF-15, RF-19, RF-20, RF-22, RF-23 | Módulo: images-actions, images-queries
  Evidencia (2026-10-30): rojo (módulos inexistentes). `image-actions.test.ts` 13 tests e `images-queries.test.ts` 2 tests en verde. `load-event.ts` no tenía test propio: devuelve `images` (de `getEventImages`) y `canAttach: true` para cualquier miembro, porque llegar a cargarlo ya exige serlo (RLS); lo comprueban el tipado y los tests de interfaz de la T9. La purga inmediata usa `purgeDeps()` (clave publicable + `CRON_SECRET`), también desde la ruta. typecheck, lint y format en verde, `npm test` 1457 tests, build correcto.

- [x] T9 Añadir imágenes desde el detalle del evento con progreso, cancelar y reintentar
  Pasos:
  - Primero, `tests/unit/image-uploader.test.tsx` en rojo (Testing Library, acciones y subida simuladas):
    - "Añadir imágenes" aparece para cualquier miembro, Lector y traído incluidos;
    - el campo acepta `image/*` y varias a la vez, sin `capture`;
    - cada imagen muestra su barra de progreso (`role="progressbar"` con valor) y "Cancelar", que la quita y llama a `cancelImage`;
    - un fallo de red muestra "No se ha podido subir la imagen" y "Reintentar", sin tocar las demás;
    - con 12 elegidas y 10 libres, avisa de que solo caben 10 y no sube las dos últimas;
    - al terminar todas hace `router.refresh()` una sola vez (`handled`).
  - Después, `image-picker.tsx`, `upload-list.tsx` y `use-image-uploads.ts` en `src/components/images/`, montados en el detalle (`event-detail`) de la ventana y de la página.

  Hecho cuando: `npm test -- image-uploader event-detail event-modal` en verde y capturas a 390, 768 y 1440 px en los dos temas. Cubre: RF-1, RF-2, RF-4, RF-6, RF-8, RF-20, RF-24 | Módulo: images-uploader
  Evidencia (2026-10-30): rojo (componentes inexistentes). `image-uploader.test.tsx` 7 tests y 2 nuevos en `event-panel.test.tsx`; `image-uploader event-detail event-modal event-panel` 36 tests en verde. `EventDetail` recibe `media` y `EventPanel` `canAttach` (páginas completa y ventana). La subida real al bucket y las capturas del detalle se hacen junto con la galería en la T10, que es la misma pantalla. typecheck, lint y format en verde, `npm test` 1466 tests, build correcto.

- [x] T10 Ver las imágenes en miniatura y a pantalla completa
  Pasos:
  - Primero, en rojo (`showModal` simulado, descarga de Storage simulada):
    - `tests/unit/event-images.test.tsx`: sin imágenes no hay galería; con imágenes, miniaturas en orden con su `alt` ("…, imagen 2 de 5"); los `blob:` se liberan al desmontar; una descarga denegada muestra un hueco con "No disponible";
    - `tests/unit/image-viewer.test.tsx`: abre en la pulsada; anterior y siguiente con botones, ← → y un deslizamiento simulado; Escape y "Cerrar" la cierran; muestra autor y fecha en la zona del perfil; "Descargar" crea un enlace con el `blob` y el nombre `<título>-<n>.jpg`; "Borrar" solo con `canDelete`, tras `ConfirmDialog`.
  - Después, `event-images.tsx`, `use-image-blob.ts` e `image-viewer.tsx`, con `next/image` `unoptimized` (plan D10).

  Hecho cuando: `npm test -- event-images image-viewer` en verde y capturas a 390, 768 y 1440 px en los dos temas, también con movimiento reducido. Cubre: RF-9, RF-10, RF-11, RF-13, RF-14, RF-15, RF-25, RF-26 | Módulo: images-gallery, images-viewer
  Evidencia (2026-10-30): rojo (componentes inexistentes). `event-images.test.tsx` 10 tests en verde (galería y visor en el mismo archivo). Prueba real con `next start -p 3100` y un usuario `@cafam.test`: un PNG de 3000×2000 y otro de 900×1600 se suben al bucket, la completa queda en 2048×1365 (25 KB) y la miniatura en 3,5 KB; las miniaturas se descargan del endpoint autenticado (200); borrar desde el visor quita la fila y los dos archivos del bucket. Tres fallos encontrados en el navegador y corregidos:
  - dos imágenes de una tanda tenían el mismo `created_at` y el orden no seguía la selección (RF-9): migración `20261030150000_reserve_images_order.sql` con `clock_timestamp()` y su test en `event-images.test.ts`;
  - `DownloadLink` y `ConfirmDialog` compartían `key` y se duplicaba "Descargar" (test añadido);
  - la hora salía "9:07"; ahora "09:07" como en el resto de la app.
  Tras borrar, el visor pasa a la imagen que queda o se cierra si no queda ninguna. También: el `afterAll` de los tests de BD dejaba miles de filas en la cola de dev (limpiaba antes de borrar los usuarios); ahora borra después y por tandas con `deleteQueuedImages` (`helpers.ts`), y se limpiaron las 4.041 filas sobrantes. Capturas del detalle y del visor a 390, 768 y 1440 px, en claro y oscuro, con el acento rojo y el amarillo (24 capturas en el scratchpad de la sesión). El visor no añade animaciones propias. typecheck, lint y format en verde, `npm test` 1476 tests, `test:db -- event-images storage-images` 38 tests, build correcto.

- [x] T11 Adjuntar imágenes al crear un evento
  Pasos:
  - Primero, en rojo:
    - `event-form.test.tsx`: en el alta completa hay "Añadir imágenes"; con imágenes pendientes envía `images=1`; con `{ done: "created", eventId }` sube y después cierra la ventana o navega al detalle; si una falla, el evento ya está guardado y queda "Reintentar";
    - `event-actions.test.ts`: `createEvent` con `images=1` devuelve `eventId` en vez de redirigir, también en la página completa y en un calendario traído; sin `images` sigue igual;
    - duplicar (`?from=`) no trae imágenes (RF-28).
  - Después, `event-form.tsx`, `events/actions.ts` y `lib/forms/form-state.ts` (`eventId`).

  Hecho cuando: `npm test -- event-form event-actions new-event` en verde y capturas del alta a 390 y 1440 px en los dos temas. Cubre: RF-7, RF-28 | Módulo: event-create-images

  Evidencia (2026-10-30): rojo (sin "Añadir imágenes" en el formulario ni `eventId` en la respuesta). `event-form.test.tsx` 21 tests (6 nuevos) y `event-actions.test.ts` 3 nuevos (con `images=1` devuelve `eventId` en la ventana, en la página completa y escribiendo en Google; sin imágenes sigue redirigiendo) en verde. Prueba real con `next start -p 3100`: en la página completa dos imágenes se suben y se llega al detalle con las dos miniaturas; en la ventana sobre el calendario se cierra con "Evento creado" y el evento tiene su imagen. Fallo encontrado en el navegador y corregido: `router.replace` al detalle lo interceptaba `@modal` y dejaba el formulario detrás; se navega con `window.location.assign`, igual que el `redirect` de `createEvent`. Capturas del alta a 390 y 1440 px en claro y oscuro. typecheck, lint y format en verde, `npm test` 1485 tests, build correcto.

- [x] T12 Marcar en las vistas los eventos con imágenes y proteger la caché sin conexión
  Pasos:
  - Primero, en rojo:
    - `getEventsInRange` devuelve `imageCount` (test de `queries`);
    - `agenda-view`, `month-view`, `week-view` y `day-view`: un evento con imágenes lleva el icono con el texto oculto "Con imágenes"; en el mes y en bloques cortos de semana y día solo cuando cabe (bloque de 30 min o más);
    - `sw-no-data.test.ts`: una petición a `/storage/v1/object/` de otro origen no se guarda en la caché.
  - Después, `ImageIcon` en `icons.tsx`, `event-row.tsx`, `event-chip.tsx`, `time-grid.tsx` y `lib/calendar/queries.ts`.

  Hecho cuando: `npm test -- agenda-view month-view week-view day-view sw-no-data queries` en verde y capturas de las cuatro vistas a 390 y 1440 px en los dos temas. Cubre: RF-12, RF-27 | Módulo: images-marks, images-queries

  Evidencia (2026-10-30): rojo en las cuatro vistas (sin "Con imágenes") y en `event-images.test.ts` ("getEventsInRange counts the ready images only": `imageCount` indefinido). El test de `sw-no-data.test.ts` con `/storage/v1/object/` ya pasaba, porque `sw.js` no toca otros orígenes: se queda como guardia de RF-27. `getEventsInRange` cuenta solo las imágenes listas (`event_images(count)` con `event_images.status = ready`, porque quien reserva ve también sus pendientes). `ImageMark` (en `event-chip.tsx`) lleva el icono y el texto oculto; en semana y día el icono solo sale en bloques de 30 min o más, y en el mes va delante del título para que los puntos suspensivos no lo escondan. `agenda-view month-view week-view day-view event-chip time-grid sw-no-data` 52 tests en verde y el de integración en verde contra dev. Capturas de agenda, mes, semana y día a 390 y 1440 px en claro y oscuro. typecheck, lint y format en verde, `npm test` 1490 tests, build correcto.

- [ ] T13 Validar las imágenes de punta a punta
  Pasos:
  - Checklist RF-1 a RF-32 con el test que cubre cada uno (tabla de evidencias en este archivo).
  - Prueba manual en un móvil real: subir desde la cámara y desde la galería (una foto HEIC en iPhone), cancelar, cortar la red y reintentar, ver, deslizar, descargar y borrar; comprobar en Storage que la foto subida no lleva ubicación (EXIF vacío) y no pasa de 2048 px.
  - Escritorio: teclado completo en la galería y el visor, lector de pantalla con los `alt`.
  - Miniaturas del detalle en menos de 2 s con 4G (Chrome, red "Fast 4G").
  - Capturas a 390, 768 y 1440 px en los dos temas con el acento rojo y el amarillo, revisadas contra P9.
  - Verificación obligatoria completa, incluido `npm run test:db` entero; borrar los usuarios y objetos de prueba de dev y la carpeta `.playwright-cli/`.
  - Actualizar `AGENTS.md` (estado, esquema, rutas, trampas) y marcar la spec como cerrada tras la aprobación del usuario.

  Hecho cuando: checklist RF-1 a RF-32 completo con su evidencia, verificación obligatoria en verde con la salida reportada y aprobación del usuario para cerrar. Cubre: todos | Módulo: validation

  Evidencia (2026-10-30), a falta de la aprobación del cierre y de la prueba en un móvil real:
  - Checklist RF-1 a RF-32 en "Evidencias RF-1 a RF-32 (T13)", más abajo.
  - EXIF y tamaño (navegador real, `next start -p 3100`): un JPEG de 4000×3000 y 7,4 MB con GPS y marca de cámara, subido desde el detalle, queda guardado en 2048×1536, 600 KB y **sin EXIF ni GPS** (leído con Pillow sobre la descarga de "Descargar", `EXIF T13-1.jpg`).
  - Rendimiento: con la red "Fast 4G" de Chrome (150 ms, 9 Mb/s) la primera miniatura del detalle se pinta a los 832 ms.
  - Teclado: Enter sobre la miniatura abre el visor, "Descargar" funciona, Escape cierra y el foco vuelve a la miniatura ("Ver EXIF T13, imagen 1 de 1"). Las flechas y el deslizar están en `event-images.test.tsx`.
  - Capturas: detalle y visor a 390, 768 y 1440 px en claro y oscuro con rojo y amarillo (T10); alta con imágenes a 390 y 1440 px (T11) y a 768 px con los dos acentos; agenda, mes, semana y día a 390 y 1440 px (T12) y a 768 px con rojo y amarillo en los dos temas. Revisadas contra P9: solo tokens, texto en tinta, el color del calendario solo marca y el icono de imagen en `currentColor`.
  - Verificación: typecheck, lint, format:check, `npm test` (167 archivos, 1490 tests) y build en verde. `npm run test:db` completo: 36 archivos, 340 tests en verde y 4 fallos, todos de las trampas conocidas: 7 archivos con `AuthApiError: Request rate limit reached` (repetidos con `--no-file-parallelism`: 7 en verde) e `invites.test.ts` ("returns a 43 character token", el reloj local por detrás del de la base de datos, abierto desde la 010 y ajeno a esta spec).
  - Limpieza de dev: el usuario de la prueba manual y sus 8 imágenes (16 objetos) borrados; borrados también 268 usuarios `@cafam.test` que dejaron ejecuciones de `test:db` cortadas por el límite de Auth (13 de hoy y 255 del 2026-10-29) y su correo en cola. Quedan 1 usuario (el real), 0 objetos en `event-images`, 0 filas en `event_images` y la cola de purga vacía. Sin carpeta `.playwright-cli/`.
  - `AGENTS.md` actualizado: estado, funciones, esquema, rutas, estructura y trampas (CDN de Storage, `clock_timestamp()`, cola de purga, R5 del movimiento en Google, navegación tras el alta con imágenes y el `input` oculto por Activity).
  - Queda para el usuario: probar en un móvil real (cámara y galería, una foto HEIC en iPhone, cortar la red y reintentar, deslizar), el lector de pantalla con los `alt`, aplicar las 8 migraciones en prod y aprobar el cierre.

## Evidencias RF-1 a RF-32 (T13)

| RF | Evidencia (tests en verde y pruebas en el navegador) |
|----|------------------------------------------------------|
| RF-1 | `image-uploader.test.tsx`, `event-panel.test.tsx` ("Añadir imágenes" en el detalle para cualquier miembro); navegador (T10, T13) |
| RF-2 | `event-images.test.ts` (`reserve_event_images`, `confirm_event_image`), `storage-images.test.ts`, `image-actions.test.ts`, `image-uploader.test.tsx`; navegador: varias imágenes a la vez (T10, T11) |
| RF-3 | `images-core.test.ts` y `prepare-image.test.ts` (tipos aceptados y lectura que falla con mensaje); HEIC en iPhone queda para la prueba en el móvil del usuario |
| RF-4 | `event-images.test.ts` ("any member reserves, viewers included"), `storage-images.test.ts` |
| RF-5 | `prepare-image.test.ts` (2048 px, JPEG); navegador (T13): un JPEG de 4000×3000 y 7,4 MB con GPS queda en 2048×1536, 600 KB y **sin EXIF ni GPS** |
| RF-6 | `upload-object.test.ts` (progreso y cancelar), `image-uploader.test.tsx` ("Cancelar" libera la reserva) |
| RF-7 | `event-form.test.tsx` y `event-actions.test.ts` (T11); navegador en página completa y en la ventana |
| RF-8 | `event-images.test.ts` ("a viewer reserves in a synced calendar too"); ninguna llamada a Google en `image-actions.ts` |
| RF-9 | `event-images.test.tsx` (orden y `alt`), `event-images.test.ts` ("keeps the order of the chosen images") |
| RF-10 | `event-images.test.tsx` (botones, flechas, deslizar, "Cerrar" y Escape); navegador con teclado (T13): Enter abre, Escape cierra y el foco vuelve a la miniatura |
| RF-11 | `event-images.test.tsx` (autor y fecha), `images-queries.test.ts` |
| RF-12 | `agenda-view`, `month-view`, `week-view`, `day-view` y `event-images.test.ts` (`imageCount`) (T12); capturas de las cuatro vistas |
| RF-13 | `event-images.test.tsx` (enlace "Descargar" con nombre legible); navegador: se descarga `EXIF T13-1.jpg`, la imagen guardada |
| RF-14 | `images-core.test.ts` (`imageAlt`), `event-images.test.tsx` |
| RF-15 | `event-images.test.ts` (matriz de borrado), `image-actions.test.ts`, `event-images.test.tsx` (confirmar); navegador (T10): borra fila y archivos |
| RF-16 | `event-images.test.ts` ("deleting the event or the calendar queues…"), `images-purge-route.test.ts` |
| RF-17 | `event-images.test.ts` (calendario y cuenta del propietario) |
| RF-18 | `event-images.test.ts` ("an event removed by the sync queues the objects") |
| RF-19 | `event-images.test.ts` ("deleting the uploader's account keeps the image without author"), `images-queries.test.ts` |
| RF-20 | `event-images.test.ts` (10 por evento, también en paralelo), `images-core.test.ts` (`fitNotice`), `image-uploader.test.tsx` |
| RF-21 | `prepare-image.test.ts` y `images-core.test.ts` (más de 20 MB, mensaje en español) |
| RF-22 | `event-images.test.ts` ("refuses new images when the project space is full"), `image-actions.test.ts` |
| RF-23 | `event-images.test.ts` ("stops at 300 own images"), `image-actions.test.ts` |
| RF-24 | `upload-object.test.ts`, `image-uploader.test.tsx` y `event-form.test.tsx` ("Reintentar" sin perder las demás) |
| RF-25 | `storage-images.test.ts` (matriz de lectura del bucket), `event-images.test.ts`, `event-images.test.tsx` ("No disponible") |
| RF-26 | `storage-images.test.ts` (expulsado deja de leer); descarga sin caché del CDN (plan D5) |
| RF-27 | `sw-no-data.test.ts` ("ignores the images of Supabase Storage") |
| RF-28 | `event-form.test.tsx` ("starts without images, also when duplicating") |
| RF-29 | `event-images.test.ts` ("merge_calendars keeps the images") |
| RF-30 | `event-images.test.ts` ("moving the event keeps its images…"), `storage-images.test.ts` |
| RF-31 | `event-images.test.ts` ("each copy gets the ready images, sharing the object") |
| RF-32 | `event-images.test.ts` ("uploading a calendar to Google keeps the images in CaFam") |

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T9, T13 |
| RF-2 | T2, T8, T9 |
| RF-3 | T6, T7 |
| RF-4 | T1, T2, T8, T9 |
| RF-5 | T6, T7, T13 |
| RF-6 | T7, T9 |
| RF-7 | T11 |
| RF-8 | T2, T8, T9 |
| RF-9 | T10 |
| RF-10 | T10 |
| RF-11 | T8, T10 |
| RF-12 | T12 |
| RF-13 | T10 |
| RF-14 | T6, T10 |
| RF-15 | T1, T8, T10 |
| RF-16 | T1, T5 |
| RF-17 | T1, T5 |
| RF-18 | T4, T5 |
| RF-19 | T1, T8 |
| RF-20 | T2, T6, T8, T9 |
| RF-21 | T6, T7 |
| RF-22 | T2, T6, T8 |
| RF-23 | T2, T6, T8 |
| RF-24 | T7, T9 |
| RF-25 | T3, T10 |
| RF-26 | T3, T10 |
| RF-27 | T12 |
| RF-28 | T11 |
| RF-29 | T1 |
| RF-30 | T1, T3 |
| RF-31 | T4 |
| RF-32 | T4 |

Módulos del plan: images-schema (T1, T3), images-functions (T2), images-copy (T4), images-purge-job (T5), images-core (T6), images-prepare e images-upload (T7), images-actions e images-queries (T8, T12), images-uploader (T9), images-gallery e images-viewer (T10), event-create-images (T11), images-marks (T12), validation (T13).

## Dudas abiertas

- Ninguna. D6 y D8 aprobadas con el plan el 2026-10-30.
