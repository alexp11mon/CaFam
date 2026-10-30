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

- [ ] T1 Crear la tabla de imágenes con sus permisos y la cola de borrado
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

- [ ] T2 Reservar y confirmar imágenes con los límites atómicos
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

- [ ] T3 Crear el bucket privado y la matriz de permisos de Storage
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

- [ ] T4 Conservar las imágenes al copiar, sincronizar y subir a Google
  Pasos:
  - Primero, tests en rojo en `event-images.test.ts`:
    - `copy_calendar_for_owner` crea en cada copia las filas `ready` con el mismo `object_id`, autor, medidas y fecha, y el nuevo propietario descarga la imagen;
    - `sync_apply_events` que quita un evento traído deja su `object_id` en la cola (RF-18);
    - `sync_attach_uploaded` (subir a Google) conserva las filas (RF-32);
    - un calendario `missing` conservado mantiene sus imágenes.
  - Después, la migración `copy_calendar_images` (`create or replace` de `copy_calendar_for_owner`, plan D6).

  Hecho cuando: `npm run test:db -- event-images account-orphans sync-worker` en verde. Cubre: RF-18, RF-31, RF-32 | Módulo: images-copy

- [ ] T5 Limpiar Storage cada hora sin la clave secreta
  Pasos:
  - Primero, en rojo:
    - `event-images.test.ts`: `images_claim_purge` con un secreto incorrecto da `42501`; con el correcto, caduca las reservas `pending` de más de 1 h, encola las carpetas sin fila de más de 1 h y devuelve la cola; `images_done_purge` la vacía; tras 5 intentos no reclama la fila; `sync_scheduled_jobs` (o su equivalente) incluye `images-purge`;
    - `tests/unit/images-purge-route.test.ts` (`@vitest-environment node`, Supabase simulado): `401` sin el `Bearer` correcto; con él, reclama, llama a `storage.remove` con `full` y `thumb` de cada `object_id`, confirma y devuelve `{ removed }`; un fallo de Storage no confirma esos objetos.
  - Después, `images_purge_trigger`, el `pg_cron` `images-purge`, `src/lib/images/purge.ts` y `src/app/api/images/purge/route.ts`.

  Hecho cuando: `npm run test:db -- event-images` y `npm test -- images-purge` en verde. Cubre: RF-16, RF-17, RF-18 | Módulo: images-purge-job

- [ ] T6 Escribir la lógica pura de las imágenes
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

### Iteración 2 — Navegador, interfaz y validación

- [ ] T7 Reducir y subir imágenes desde el navegador
  Pasos:
  - Primero, en rojo, con `createImageBitmap`, canvas y `XMLHttpRequest` simulados en jsdom:
    - `tests/unit/prepare-image.test.ts`: rechaza más de 20 MB y un tipo no admitido sin decodificar; un fallo al decodificar da "Este navegador no puede leer esta imagen"; dibuja a las medidas de `fitWithin`, exporta JPEG con la calidad del plan y cierra el bitmap;
    - `tests/unit/upload-object.test.ts`: envía a la ruta del bucket con `apikey`, `Authorization` y `x-upsert: false`; informa del progreso; `abort` cancela; un error de red da `network`; un 409 cuenta como `ok`; un 4xx da `rejected`.
  - Después, `src/lib/images/prepare-image.ts` y `upload-object.ts`.

  Hecho cuando: `npm test -- prepare-image upload-object` en verde. Cubre: RF-3, RF-5, RF-6, RF-21, RF-24 | Módulo: images-prepare, images-upload

- [ ] T8 Reservar, confirmar, cancelar y borrar desde el servidor y cargar la galería
  Pasos:
  - Primero, en rojo, con Supabase simulado:
    - `tests/unit/image-actions.test.ts`: `reserveImages` valida y traduce `CF429` y `CF404`, y devuelve el aviso "Solo caben N" cuando hay menos `id`; `confirmImage`; `cancelImage` y `deleteImage` borran la fila y después los dos objetos; 0 filas da "ya no existe" o "sin permiso"; `deleteImage` revalida `/dashboard`;
    - `tests/unit/images-queries.test.ts`: las imágenes salen en orden de subida, con autor "Cuenta borrada" o "un antiguo miembro" (`authorLabel`), y `canDelete` para el autor, el propietario y un Editor, no para un Lector ajeno;
    - `load-event` devuelve `images` y `canAttach` para cualquier miembro, también en un traído.
  - Después, `src/app/dashboard/events/image-actions.ts`, `src/lib/images/queries.ts` y `load-event.ts`.

  Hecho cuando: `npm test -- image-actions images-queries load-event` en verde. Cubre: RF-2, RF-4, RF-8, RF-11, RF-15, RF-19, RF-20, RF-22, RF-23 | Módulo: images-actions, images-queries

- [ ] T9 Añadir imágenes desde el detalle del evento con progreso, cancelar y reintentar
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

- [ ] T10 Ver las imágenes en miniatura y a pantalla completa
  Pasos:
  - Primero, en rojo (`showModal` simulado, descarga de Storage simulada):
    - `tests/unit/event-images.test.tsx`: sin imágenes no hay galería; con imágenes, miniaturas en orden con su `alt` ("…, imagen 2 de 5"); los `blob:` se liberan al desmontar; una descarga denegada muestra un hueco con "No disponible";
    - `tests/unit/image-viewer.test.tsx`: abre en la pulsada; anterior y siguiente con botones, ← → y un deslizamiento simulado; Escape y "Cerrar" la cierran; muestra autor y fecha en la zona del perfil; "Descargar" crea un enlace con el `blob` y el nombre `<título>-<n>.jpg`; "Borrar" solo con `canDelete`, tras `ConfirmDialog`.
  - Después, `event-images.tsx`, `use-image-blob.ts` e `image-viewer.tsx`, con `next/image` `unoptimized` (plan D10).

  Hecho cuando: `npm test -- event-images image-viewer` en verde y capturas a 390, 768 y 1440 px en los dos temas, también con movimiento reducido. Cubre: RF-9, RF-10, RF-11, RF-13, RF-14, RF-15, RF-25, RF-26 | Módulo: images-gallery, images-viewer

- [ ] T11 Adjuntar imágenes al crear un evento
  Pasos:
  - Primero, en rojo:
    - `event-form.test.tsx`: en el alta completa hay "Añadir imágenes"; con imágenes pendientes envía `images=1`; con `{ done: "created", eventId }` sube y después cierra la ventana o navega al detalle; si una falla, el evento ya está guardado y queda "Reintentar";
    - `event-actions.test.ts`: `createEvent` con `images=1` devuelve `eventId` en vez de redirigir, también en la página completa y en un calendario traído; sin `images` sigue igual;
    - duplicar (`?from=`) no trae imágenes (RF-28).
  - Después, `event-form.tsx`, `events/actions.ts` y `lib/forms/form-state.ts` (`eventId`).

  Hecho cuando: `npm test -- event-form event-actions new-event` en verde y capturas del alta a 390 y 1440 px en los dos temas. Cubre: RF-7, RF-28 | Módulo: event-create-images

- [ ] T12 Marcar en las vistas los eventos con imágenes y proteger la caché sin conexión
  Pasos:
  - Primero, en rojo:
    - `getEventsInRange` devuelve `imageCount` (test de `queries`);
    - `agenda-view`, `month-view`, `week-view` y `day-view`: un evento con imágenes lleva el icono con el texto oculto "Con imágenes"; en el mes y en bloques cortos de semana y día solo cuando cabe (bloque de 30 min o más);
    - `sw-no-data.test.ts`: una petición a `/storage/v1/object/` de otro origen no se guarda en la caché.
  - Después, `ImageIcon` en `icons.tsx`, `event-row.tsx`, `event-chip.tsx`, `time-grid.tsx` y `lib/calendar/queries.ts`.

  Hecho cuando: `npm test -- agenda-view month-view week-view day-view sw-no-data queries` en verde y capturas de las cuatro vistas a 390 y 1440 px en los dos temas. Cubre: RF-12, RF-27 | Módulo: images-marks, images-queries

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
