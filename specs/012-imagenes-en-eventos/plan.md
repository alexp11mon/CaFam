# Plan 012 — Imágenes en los eventos

Spec de origen: `specs/012-imagenes-en-eventos/spec.md` (aprobada el 2026-10-29). Plan aprobado el 2026-10-30, con D6 y D8. Constitución: `docs/constitution.md` (enmienda 3: Supabase Storage permitido, bucket privado con políticas en `storage.objects`).

## Resumen de arquitectura

- **Datos:** una tabla nueva `event_images` (una fila por imagen y evento, con RLS) y un bucket **privado** `event-images` de Supabase Storage con dos objetos por imagen: `<object_id>/full.jpg` (lado mayor ≤ 2048 px) y `<object_id>/thumb.jpg` (≤ 400 px). Las políticas de `storage.objects` preguntan a funciones `SECURITY DEFINER` si la fila existe y si quien llama es miembro del calendario del evento. Así la base de datos decide todos los permisos (P3), también al mover, juntar o salir de un calendario.
- **Subida:** el navegador reduce y recomprime cada imagen (canvas → JPEG, sin metadatos), **reserva** su hueco con una función que aplica los límites de forma atómica, sube los dos objetos directamente a Storage con `XMLHttpRequest` (para tener progreso y poder cancelar) y **confirma**. Nada pasa por las funciones de Vercel ni por el límite de cuerpo de las Server Actions.
- **Ver y borrar:** el navegador descarga cada imagen con la sesión del usuario (`storage.download`, RLS en cada petición, sin enlaces públicos ni firmados) y la pinta desde un `blob:`. Borrar la fila (a mano, en cascada con el evento o el calendario, o desde la sincronización) mete sus objetos en una cola; la acción de borrar los quita al momento y un trabajo horario de `pg_cron` → `/api/images/purge` limpia el resto con la clave publicable y `CRON_SECRET` (mismo patrón que la 007, sin `service_role`).

```
Detalle / formulario ── ImagePicker ─▶ prepareImage() (canvas: 2048 px + miniatura 400 px, JPEG, sin EXIF)
        │                                  │ rechaza > 20 MB, tipos no admitidos, ilegibles (RF-3, RF-5, RF-21)
        ▼                                  ▼
reserveImages(eventId, bytes[]) ──RPC reserve_event_images──▶ event_images (status pending) — límites 10/300/total (RF-20, 22, 23)
        ▼
uploadObject() XHR PUT /storage/v1/object/event-images/<id>/{full,thumb}.jpg  (progreso, abort, reintento) (RF-6, RF-24)
        │ política INSERT: image_upload_allowed(name) = fila pending propia
        ▼
confirmImage(id) ──RPC confirm_event_image──▶ status ready + bytes reales de storage.objects
        ▼
EventImages (galería) ── useImageBlob(path) ── storage.download (política SELECT: can_read_event_image(name)) ──▶ <Image unoptimized src=blob:>
ImageViewer (<dialog>) ── anterior/siguiente, teclado, deslizar, autor y fecha, descargar, borrar (RF-10…15)

DELETE event_images (directo con RLS, o cascada desde events/calendars) ── trigger ──▶ image_purge_queue (si nadie más usa el objeto)
pg_cron images-purge (cada hora) ─▶ images_purge_trigger() ─net.http_post─▶ /api/images/purge ─▶ images_claim_purge(p_secret)
                                                                                     └▶ storage.remove(paths) (política DELETE: objeto en la cola)
                                                                                     └▶ images_done_purge(p_secret, paths)
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `images-schema` | `supabase/migrations/<ts>_event_images.sql` | Tabla `event_images` con RLS, cola `image_purge_queue` (sin acceso de clientes), bucket privado `event-images` (JPEG, 4 MB por objeto), trigger de cola al borrar una fila, funciones de permiso de Storage y políticas de `storage.objects` | No borra objetos de Storage (Supabase solo lo permite por su API) | RF-4, RF-15, RF-16, RF-17, RF-18, RF-19, RF-25, RF-26, RF-29, RF-30 |
| `images-functions` | Misma migración (o `<ts>_event_images_functions.sql`) | `reserve_event_images` (límites atómicos), `confirm_event_image`, `images_total_limit()` y, con `p_secret`, `images_claim_purge` / `images_done_purge` | No decide la interfaz | RF-2, RF-20, RF-22, RF-23, RF-24 |
| `images-copy` | `supabase/migrations/<ts>_copy_calendar_images.sql` | `create or replace` de `copy_calendar_for_owner` para copiar también las filas de `event_images` de cada evento a su copia, apuntando al **mismo objeto** | No duplica bytes en Storage | RF-31 |
| `images-purge-job` | Migración (`images_purge_trigger()` y el `pg_cron` `images-purge`), `src/app/api/images/purge/route.ts`, `src/lib/images/purge.ts` | Cada hora, si hay cola o reservas caducadas, llama a la ruta; la ruta reclama tandas, borra en Storage y confirma | No toca filas de `event_images` | RF-16, RF-17, RF-18, casos límite (evento borrado durante la subida) |
| `images-core` | `src/lib/images/limits.ts`, `alt.ts`, `fit.ts`, `error-messages.ts`, `paths.ts` | Lógica pura: límites (10, 300, 20 MB, 2048, 400, calidad), tipos admitidos, `fitWithin(w, h, max)`, `imageAlt(title, i, n)`, `objectPath(id, variant)`, traducción de SQLSTATE a español y `slotsLeft()` | No toca la red ni el DOM | RF-3, RF-5, RF-14, RF-20, RF-21, RF-22, RF-23 |
| `images-prepare` | `src/lib/images/prepare-image.ts` (cliente) | `prepareImage(file)`: valida tipo y tamaño, decodifica con `createImageBitmap` (respeta la orientación EXIF), dibuja en canvas a 2048 px y a 400 px sobre fondo opaco y exporta JPEG. Al recomprimir se pierden todos los metadatos, ubicación incluida | No sube nada | RF-3, RF-5, RF-21, casos límite (corrupta, HEIC ilegible) |
| `images-upload` | `src/lib/images/upload-object.ts` (cliente) | `uploadObject(path, blob, token, onProgress, signal)`: `XMLHttpRequest` a la API de Storage con la sesión del usuario; progreso, cancelación y error tipado (`network`, `rejected`); un 409 ("ya existe") cuenta como subido para que "Reintentar" no falle | No reserva ni confirma | RF-6, RF-24 |
| `images-actions` | `src/app/dashboard/events/image-actions.ts` | Server Actions `reserveImages`, `confirmImage`, `deleteImage` (borra la fila con RLS y después los objetos en Storage, ya en la cola) y `cancelImage`. Validan con `zod`, traducen errores y hacen `revalidatePath` | No sube bytes | RF-2, RF-6, RF-15, RF-20, RF-22, RF-23 |
| `images-queries` | `src/lib/images/queries.ts`, `src/app/dashboard/events/load-event.ts`, `src/lib/calendar/queries.ts` (`getEventsInRange`) | Lista las imágenes listas de un evento en orden de subida, con autor (`authorLabel`, spec 006), fecha, tamaño y si quien mira puede borrarlas. Añade `imageCount` a los eventos de las vistas (`event_images(count)`) | No descarga bytes | RF-9, RF-11, RF-12, RF-15, RF-19 |
| `images-uploader` | `src/components/images/image-picker.tsx`, `upload-list.tsx`, `use-image-uploads.ts` | "Añadir imágenes" (`<input type="file" accept="image/*" multiple>`, que en el móvil ofrece cámara y galería), cola de subidas con progreso, "Cancelar", "Reintentar" y el aviso de cuántas caben. Funciona en el detalle y dentro de `EventForm` al crear | No pinta la galería | RF-1, RF-2, RF-4, RF-6, RF-7, RF-8, RF-20, RF-24 |
| `images-gallery` | `src/components/images/event-images.tsx`, `use-image-blob.ts` | Miniaturas en el detalle (fuera si hay 0 imágenes), descargadas con la sesión y liberadas (`revokeObjectURL`) al desmontar | — | RF-9, RF-14, RF-25, RF-26, RF-27 |
| `images-viewer` | `src/components/images/image-viewer.tsx` | `<dialog>` a pantalla completa: anterior/siguiente con botones, ← → y deslizar (eventos de puntero), "Cerrar" y Escape, autor y fecha, "Descargar" (el `blob` de la imagen completa) y "Borrar" con `ConfirmDialog` a quien puede | — | RF-10, RF-11, RF-13, RF-14, RF-15 |
| `images-marks` | `components/calendar/event-row.tsx`, `event-chip.tsx`, `time-grid.tsx`, `components/shell/icons.tsx` (`ImageIcon`) | Icono de imagen en la fila de agenda y, si cabe, en mes, semana y día (con `sr-only` "Con imágenes") | — | RF-12 |
| `event-create-images` | `components/calendar/event-form.tsx`, `app/dashboard/events/actions.ts`, `lib/forms/form-state.ts` | Con imágenes pendientes, el formulario envía `images=1` y `createEvent` devuelve `{ done: "created", eventId }` también en la página completa; el formulario sube y después cierra o navega al detalle. Duplicar (`?from=`) nunca lleva imágenes | No cambia el alta sin imágenes | RF-7, RF-28 |
| `validation` | `tests/integration/event-images.test.ts`, `storage-images.test.ts`, capturas, móvil real | Matriz de permisos de tabla y Storage, ciclo de vida (mover, juntar, copiar, subir a Google, borrar), capturas y prueba en móvil | — | todos |

## Modelo de datos

### `public.event_images`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK `default gen_random_uuid()` | |
| `event_id` | `uuid not null references events (id) on delete cascade` | Índice `(event_id, created_at)` |
| `object_id` | `uuid not null` | Carpeta del objeto en Storage. En la original `object_id = id`; las copias de la spec 006 comparten el de la original (D6). Índice |
| `uploaded_by` | `uuid references profiles (id) on delete set null` | Nulo = "Cuenta borrada"; fuera del calendario = "un antiguo miembro" (RF-19). Índice |
| `status` | `text not null default 'pending'`, `check in ('pending','ready')` | `pending` mientras se sube |
| `bytes` | `integer not null check (bytes > 0)` | Lo declarado al reservar; al confirmar, lo real de `storage.objects` (suma de los dos objetos) |
| `width`, `height` | `integer not null check (> 0)` | De la imagen completa; evita saltos al pintar |
| `created_at` | `timestamptz not null default now()` | Orden de la galería (RF-9) y fecha de RF-11 |

Sin `updated_at`: una fila solo pasa de `pending` a `ready` (lo hace una función).

**RLS** (todas con `(select auth.uid())`):

| Operación | Quién |
|-----------|-------|
| `SELECT` | Miembros del calendario del evento (`is_calendar_member`), filas `ready`; además las `pending` propias |
| `DELETE` | `uploaded_by = auth.uid()`, o `calendar_role_for(calendario del evento) in ('owner','editor')` (RF-15). Vale para calendarios sin propietario: sus Editores siguen siendo Editores |
| `INSERT`, `UPDATE` | Nadie: solo las funciones |

### `public.image_purge_queue`

`object_id uuid primary key`, `bytes integer not null`, `queued_at timestamptz not null default now()`, `attempts smallint not null default 0`. RLS activada **sin políticas** (como `email_outbox`).

- Trigger `after delete on event_images for each row`: si ninguna otra fila usa `old.object_id`, inserta `(old.object_id, old.bytes)` con `on conflict do nothing`. Cubre el borrado a mano, el del evento (RF-16), el del calendario (RF-17), el de la sincronización (RF-18), el de la cuenta y el de "Desconectar → borrar".

### Bucket `event-images`

`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('event-images', 'event-images', false, 4194304, '{image/jpeg}')`. Rutas: `<object_id>/full.jpg` y `<object_id>/thumb.jpg` (`objectPath`). Políticas en `storage.objects`, solo para `bucket_id = 'event-images'`:

| Operación | Rol | Condición |
|-----------|-----|-----------|
| `SELECT` | `authenticated` | `public.can_read_event_image(name)`: existe una fila `ready` con ese `object_id` en un evento de un calendario del que es miembro (RF-25, RF-26, RF-29, RF-30) |
| `INSERT` | `authenticated` | `public.image_upload_allowed(name)`: fila `pending` propia con ese `object_id`, nombre `full.jpg` o `thumb.jpg`, reserva de menos de 1 h |
| `DELETE` | `anon`, `authenticated` | `public.image_purge_pending(name)`: el `object_id` está en la cola (borrar lo que ya se va a borrar no da nada) |
| `UPDATE` | — | Nadie |

Las tres funciones son `SECURITY DEFINER`, `stable`, `search_path = ''`, y extraen el `object_id` con `(storage.foldername(name))[1]`.

### Límites

- Por evento: 10 filas (`pending` + `ready`) (RF-20).
- Por usuario: 300 `object_id` distintos con `uploaded_by` = él (las copias de la 006 no cuentan doble) (RF-23).
- Total: `images_total_limit()` = **800 MB** (`838860800`), suma de `bytes` de los objetos distintos más lo que está en la cola (D8, RF-22).
- Por imagen: 20 MB antes de reducir (RF-21, en el navegador) y 4 MB por objeto ya reducido (bucket).

## Contratos e interfaces

### Funciones SQL

- `reserve_event_images(p_event_id uuid, p_images jsonb) returns table (id uuid)`, `SECURITY DEFINER`, para `authenticated`:
  - `p_images`: array de 1 a 10 `{bytes, width, height}`; si no, `22023`.
  - Bloquea la fila del evento (`for update`) para que dos personas a la vez no pasen de 10. Evento inexistente o no miembro → `CF404`.
  - Inserta `min(pedidas, huecos)` filas `pending`, también para Lectores y en calendarios traídos (RF-4, RF-8). Si no cabe ninguna: `CF429` con `detail` `event` (10 por evento), `user` (300) o `total` (espacio).
  - Devuelve los `id` creados; el cliente compara con las pedidas para decir "Solo caben N" (RF-20).
- `confirm_event_image(p_id uuid) returns void`: solo la fila `pending` propia; exige que existan los dos objetos en `storage.objects`; pone `ready` y `bytes` con su tamaño real. Si falta alguno: `P0002`. Fila inexistente (p. ej. evento borrado): `CF404`.
- `images_claim_purge(p_secret text, p_limit int default 100) returns table (object_id uuid)`: compara `p_secret` con `cron_secret` de Vault (`42501` si no). Antes de reclamar, borra las reservas `pending` de más de 1 h (que pasan a la cola por el trigger) y mete en la cola las carpetas del bucket de más de 1 h sin ninguna fila (objetos huérfanos). Sube `attempts`; tras 5 intentos deja de reclamar la fila.
- `images_done_purge(p_secret text, p_object_ids uuid[]) returns void`: quita de la cola lo ya borrado.
- `images_purge_trigger() returns void` (solo `postgres`): si hay cola o reservas caducadas, `net.http_post` a `sync_app_url || '/api/images/purge'` con `Authorization: Bearer <cron_secret>`. `pg_cron` `images-purge`: `15 * * * *`.
- `copy_calendar_for_owner(p_calendar_id, p_user_id)`: misma firma y permisos; además copia las filas `ready` con el mismo `object_id`, `uploaded_by`, `bytes`, medidas y `created_at` (RF-31). Para casar eventos origen y copia, genera los `id` nuevos antes de insertar (CTE con `gen_random_uuid()`).

Códigos de error en `lib/images/error-messages.ts`:

| Caso | Mensaje |
|------|---------|
| `CF429` `event` | "Este evento ya tiene 10 imágenes." / "Solo caben N imágenes más en este evento." |
| `CF429` `user` | "Has llegado al límite de 300 imágenes. Borra alguna para subir más." |
| `CF429` `total` | "CaFam se ha quedado sin espacio para imágenes. Las que ya hay siguen guardadas." |
| `CF404` | "Este evento ya no existe o ya no tienes acceso." |
| Tipo no admitido | "Solo se admiten imágenes JPEG, PNG, WebP o HEIC." |
| > 20 MB | "La imagen pesa más de 20 MB." |
| No decodifica | "Este navegador no puede leer esta imagen." |
| Red | "No se ha podido subir la imagen." + "Reintentar" |

### Server Actions (`events/image-actions.ts`)

- `reserveImages(eventId: string, images: {bytes, width, height}[]): Promise<{ ids: string[]; notice?: string } | { error: string }>`.
- `confirmImage(id: string): Promise<{ error?: string }>`: al terminar la última, el cliente hace `router.refresh()`.
- `cancelImage(id: string)` y `deleteImage(id: string)`: borran la fila con la sesión (RLS) y después llaman a `storage.remove([full, thumb])`, que ya pasa la política de la cola; si eso falla, lo hará el trabajo horario. 0 filas borradas → "no existe" o "sin permiso" (como `canSeeEvent`). `deleteImage` revalida `/dashboard`.

### Cliente

- `prepareImage(file: File): Promise<{ full: Blob; thumb: Blob; width; height } | { error: string }>`.
- `uploadObject({ path, blob, accessToken, onProgress, signal }): Promise<"ok" | "network" | "rejected">`, a `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/event-images/<path>` con `apikey` publicable, `Authorization: Bearer <access_token>` y `x-upsert: false`.
- `useImageBlob(path): { url?: string; blob?: Blob; error?: true }`: `supabase.storage.from("event-images").download(path)` con el cliente del navegador.
- Ruta `POST /api/images/purge` con `Authorization: Bearer ${CRON_SECRET}` → `200 {"removed": n}` / `401` / `500`. `maxDuration` 60.

### Datos para la interfaz

- `EventImage { id, objectId, width, height, createdAt, author: string, canDelete: boolean }` en `EventData.images` (`load-event.ts`).
- `EventData.canAttach`: cualquier miembro (RF-4) mientras el evento existe.
- Eventos de las vistas: `imageCount: number`.

## Flujo principal paso a paso

1. **Elegir** (RF-1, RF-2, RF-4): en el detalle, cualquier miembro ve "Añadir imágenes". El selector de archivos (`accept="image/*"`, `multiple`) ofrece en el móvil la cámara y la galería.
2. **Preparar en el dispositivo** (RF-3, RF-5, RF-21): por cada archivo, `prepareImage` comprueba el tipo (`image/jpeg|png|webp|heic|heif`) y el tamaño (≤ 20 MB), decodifica con `createImageBitmap(file, { imageOrientation: "from-image" })`, dibuja a ≤ 2048 px y a ≤ 400 px sobre fondo opaco y exporta JPEG (0,82 y 0,75). El canvas no conserva EXIF: se van la ubicación y el resto de metadatos. Un fallo marca esa imagen con su mensaje y deja seguir a las demás.
3. **Reservar** (RF-20, RF-22, RF-23): `reserveImages` con los tamaños ya reducidos. Si devuelve menos `id` de los pedidos, las que sobran se quitan de la lista con "Solo caben N imágenes más en este evento".
4. **Subir** (RF-6, RF-24): de 2 en 2, cada imagen sube `thumb` y `full` con su barra de progreso (bytes enviados / total) y su botón "Cancelar" (`AbortController` → `cancelImage`). Un fallo de red la marca "No se ha podido subir" con "Reintentar", que vuelve a subir lo que falte con la misma reserva.
5. **Confirmar**: `confirmImage` la pasa a `ready`. Al terminar la tanda, `router.refresh()` vuelve a pintar el detalle con la galería, y las vistas con el icono (RF-12).
6. **Ver** (RF-9, RF-10, RF-11, RF-13, RF-14): la galería descarga las miniaturas con la sesión (RLS en cada petición) y las pinta con `next/image` `unoptimized` y su `alt` ("Cumpleaños de Ana, imagen 2 de 5"). Al pulsar una, `ImageViewer` descarga la completa y muestra autor y fecha; ←/→, los botones o deslizar cambian de imagen; Escape o "Cerrar" la cierran. "Descargar" guarda el `blob` como `<título>-<n>.jpg`.
7. **Borrar** (RF-15): quien puede ve "Borrar" en la vista completa → `ConfirmDialog` → `deleteImage` → la fila desaparece (RLS), el trigger la pone en la cola y la acción quita los objetos.
8. **Al crear** (RF-7): en el formulario completo, las imágenes elegidas se preparan y esperan en la lista. Al guardar, `createEvent` devuelve `eventId` (con `images=1`) y el formulario sigue en los pasos 3–5 con ese evento; al terminar, cierra la ventana (`finish("created")`) o navega al detalle. Si alguna falla, el evento ya está guardado y se puede reintentar o cerrar.
9. **Ciclo de vida**: borrar un evento o un calendario, o que la sincronización borre un evento traído, borra las filas en cascada y el trigger encola los objetos (RF-16, RF-17, RF-18). Mover, juntar y subir a Google no cambian `event_id`, así que las imágenes siguen ahí con los permisos del calendario nuevo (RF-29, RF-30, RF-32). Salir o ser expulsado quita la condición de miembro, y la siguiente descarga falla (RF-26). La copia de un calendario sin propietario comparte los objetos (RF-31). Duplicar un evento no lleva imágenes (RF-28).
10. **Limpieza horaria**: `images-purge` → `/api/images/purge` → reclama tandas de 100, `storage.remove`, `images_done_purge`.

## Decisiones técnicas

- D1: **Subida directa del navegador a Storage con `XMLHttpRequest`.** Descartado pasar los bytes por una Server Action: el cuerpo está limitado (3 MB en `next.config.ts`, 4,5 MB en Vercel) y no da progreso. Descartado `supabase.storage.upload`: usa `fetch`, que no informa del progreso de subida (RF-6). Cubre: RF-2, RF-6, RF-24.
- D2: **Reducir y recomprimir en el navegador con canvas a JPEG.** Descartado WebP: Safari no lo genera desde canvas y devolvería PNG, mucho más pesado. Descartada cualquier librería de imagen (P6). Volver a codificar quita todos los metadatos sin tener que leer EXIF a mano (RF-5). Las imágenes con transparencia se pintan sobre fondo blanco. Cubre: RF-3, RF-5, H4.
- D3: **Dos objetos por imagen: completa (2048 px) y miniatura (400 px).** Descartadas las transformaciones de imagen de Supabase: no están en el plan gratuito. Cubre: RF-9, requisito de rendimiento.
- D4: **Reservar → subir → confirmar, con los límites en una función que bloquea el evento.** Descartado comprobar los límites en la Server Action: dos subidas a la vez pasarían de 10 (caso límite). La política `INSERT` de Storage solo deja subir a una reserva propia, así que nadie puede llenar el bucket saltándose los límites. Cubre: RF-20, RF-22, RF-23, casos límite.
- D5: **Ver con descargas autenticadas (`storage.download` → `blob:`), sin enlaces firmados.** Un enlace firmado sigue sirviendo hasta caducar a quien lo tenga, también a alguien expulsado. Con la descarga autenticada RLS se evalúa en cada petición, y la dirección del objeto sin la sesión no da nada. Cumple el "enlaces de corta duración" de la spec de forma más estricta: no hay enlaces. Cubre: RF-25, RF-26, RF-13.
- D6: **El permiso de un objeto sale de `event_images` → `events` → miembro, nunca de la ruta.** La ruta (`<object_id>/…`) no lleva el calendario ni el evento, así que mover y juntar no exigen tocar Storage. Las copias de la 006 son filas nuevas con el mismo `object_id`, y el objeto solo se borra cuando ninguna fila lo usa. Descartado copiar los bytes en cada copia: duplicaría el espacio y exigiría la API de Storage desde `pg_cron`. Cubre: RF-29, RF-30, RF-31, RF-32.
- D7: **Borrado en Storage por cola + trabajo horario con la clave publicable y `CRON_SECRET`.** Supabase no deja borrar objetos con SQL (solo con su API), y las cascadas ocurren en Postgres. La política `DELETE` solo deja borrar lo que está en la cola, así que la ruta no necesita `service_role` (P4), igual que la sincronización (spec 007). Descartado borrar solo desde la acción de borrar evento: las cascadas de calendarios, cuentas y sincronización no pasan por ella. Cubre: RF-16, RF-17, RF-18.
- D8: **Límite total de 800 MB** de los 1 GB de Storage del plan gratuito (y bajo los 5 GB de transferencia al mes gracias a las miniaturas). El margen cubre la cola pendiente y lo declarado frente a lo real. Descartado 1 GB exacto: un exceso pausaría la subida de todo el proyecto. Cubre: RF-22, P2.
- D9: **"Añadir imágenes" con `<input type="file" accept="image/*" multiple>`, sin `capture`.** Con `capture` el móvil solo ofrecería la cámara; sin él ofrece cámara y galería. iOS entrega HEIC ya convertido a JPEG con `image/*`; si llega un HEIC que el navegador no decodifica, se rechaza con su mensaje. Cubre: RF-2, RF-3.
- D10: **`next/image` con `unoptimized` y `width`/`height` de la fila.** Descartado `<img>` suelto: lo marca el lint de Next. La optimización de Vercel no sirve con `blob:` y gastaría la cuota. Cubre: RF-9, rendimiento.
- D11: **Alta con imágenes: `createEvent` devuelve `eventId` cuando el formulario envía `images=1`**, también en la página completa, y el cliente sube antes de cerrar o navegar. Descartado subir antes de crear el evento: la reserva necesita un evento al que pertenecer y quedarían imágenes huérfanas si no se guarda. Cubre: RF-7.
- D12: **Las imágenes no entran en la escritura a Google**: `writeEvent` y `uploadCalendar` no las conocen. Adjuntar en un calendario traído usa el mismo camino que en uno normal, porque no modifica la fila del evento (que las políticas de `events` prohíben en los traídos). Cubre: RF-8, RF-32.
- D13: **El service worker no cambia**: ya ignora las peticiones a otros orígenes (Supabase), y las imágenes se pintan desde `blob:`. Se añade a `sw-no-data.test.ts` que una petición a `/storage/v1/` no se guarda. No se sube `CACHE_NAME`. Cubre: RF-27.
- D14: **El icono de las vistas sale de `event_images(count)` en `getEventsInRange`.** Descartada una columna `has_images` en `events`: exigiría un trigger y tocar las políticas de `events` en los traídos. Cubre: RF-12.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1 | images-uploader |
| RF-2 | images-uploader, images-actions, images-functions |
| RF-3 | images-core, images-prepare |
| RF-4 | images-schema, images-functions, images-uploader |
| RF-5 | images-prepare, images-core |
| RF-6 | images-upload, images-uploader, images-actions |
| RF-7 | event-create-images, images-uploader |
| RF-8 | images-functions, images-uploader (D12) |
| RF-9 | images-queries, images-gallery |
| RF-10 | images-viewer |
| RF-11 | images-queries, images-viewer |
| RF-12 | images-queries, images-marks |
| RF-13 | images-viewer |
| RF-14 | images-core, images-gallery, images-viewer |
| RF-15 | images-schema, images-actions, images-viewer |
| RF-16 | images-schema, images-purge-job |
| RF-17 | images-schema, images-purge-job |
| RF-18 | images-schema, images-purge-job |
| RF-19 | images-schema, images-queries |
| RF-20 | images-functions, images-core, images-uploader |
| RF-21 | images-prepare, images-core |
| RF-22 | images-functions, images-core |
| RF-23 | images-functions, images-core |
| RF-24 | images-upload, images-uploader |
| RF-25 | images-schema, images-gallery |
| RF-26 | images-schema, images-gallery |
| RF-27 | images-gallery, validation (D13) |
| RF-28 | event-create-images |
| RF-29 | images-schema (D6) |
| RF-30 | images-schema (D6) |
| RF-31 | images-copy |
| RF-32 | images-schema (D6, D12) |

## Riesgos y mitigaciones

- R1: **Storage local para `test:db`.** Los tests usan el proyecto `dev`, que tiene Storage. Mitigación: `storage-images.test.ts` crea y borra sus objetos y usuarios (`@cafam.test`) y comprueba cada fila de la matriz de políticas.
- R2: **`createImageBitmap` con `imageOrientation` o HEIC en navegadores antiguos.** Mitigación: si falla, se intenta con un `<img>` decodificado (que también respeta la orientación en los navegadores actuales); si también falla, "Este navegador no puede leer esta imagen". Se prueba en el móvil real.
- R3: **Memoria al reducir fotos de 48 MP en móviles.** Mitigación: una imagen cada vez en el canvas, `bitmap.close()` y el canvas a 0×0 tras exportar.
- R4: **El token de la sesión caduca durante una subida larga.** Mitigación: `uploadObject` pide la sesión justo antes de cada objeto (`getSession` la refresca) y un 401/403 cuenta como fallo con "Reintentar".
- R5: **Google mueve un evento entre calendarios.** La sincronización lo ve como borrado + alta y se pierden sus imágenes. Es coherente con RF-18 (el evento traído desaparece); se documenta en las trampas.
- R6: **Objetos que se quedan sin fila** (subida que acaba justo cuando se borra el evento). Mitigación: `images_claim_purge` encola las carpetas sin fila de más de 1 h.
- R7: **Transferencia del plan gratuito.** Mitigación: la galería solo descarga miniaturas; la imagen completa solo al abrirla, y los `blob:` se liberan al cerrar.
- R8: **Activity (spec 008) conserva el detalle oculto** con sus `blob:` y sus subidas. Mitigación: `useImageBlob` libera en la limpieza del efecto, y la cola de subidas atiende cada resultado una sola vez (`handled` con `useRef`).

## Pasos fuera del repositorio (los ejecuta el usuario)

1. Fusionar y publicar: `git switch main && git merge --ff-only 012-imagenes-en-eventos && git push origin main 012-imagenes-en-eventos`.
2. Migraciones en producción (crean el bucket, las políticas y el `pg_cron`; `cron_secret` y `sync_app_url` ya están en Vault desde la 007):
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```

## Dudas abiertas

- Ninguna. El límite total de 800 MB (D8) y las copias que comparten objeto (D6) quedaron aprobados con el plan el 2026-10-30.
