# Plan 009 — Sincronización bidireccional con Google

> Spec de origen: `specs/009-sincronizacion-bidireccional/spec.md` (aprobada, 2026-10-28). Constitución: `docs/constitution.md`. Parte del plan 007 (`specs/007-sincronizacion-oauth/plan.md`), cuyos módulos, decisiones D1–D19 y funciones siguen vigentes salvo lo que se cambia aquí.
> Estado: **Aprobado** por el usuario (2026-10-29).
> Lo que este plan da por supuesto y hay que confirmar antes de programar está en "Comprobaciones de la T1".

## Resumen de arquitectura

Se mantiene el diseño de la 007: el código que habla con Google vive en `src/lib/sync/` (TypeScript con `fetch`, sin librerías) y Postgres decide quién puede hacer qué. Las escrituras en un calendario traído **siguen prohibidas por RLS** a cualquier cliente; solo las hacen funciones `SECURITY DEFINER` nuevas que exigen **a la vez** la sesión del usuario (`auth.uid()`, para comprobar su rol como en un calendario normal) y el `cron_secret` del servidor (prueba de que el servidor ya escribió en Google). Así un cliente con la clave publicable nunca puede guardar en CaFam un cambio que Google no tiene, y no hace falta `service_role` (P4).

El orden de cada escritura es siempre **Google primero, CaFam después** (RF-10 a RF-12): si Google falla, no se llama a la función de guardado y el formulario conserva lo escrito (RF-21).

```
Formulario / ventana rápida / arrastrar ──▶ createEvent · updateEvent · deleteEvent (Server Actions)
   │  calendario normal ─────────────────▶ como hoy (insert/update/delete con RLS)
   │  calendario traído
   ▼
rpc sync_write_context (sesión + secreto) ── rol owner/editor, cuenta con escritura, mismo origen ──▶ ids de Google
   ▼
write-event.ts ── token (sync_get_token + renovación) ──▶ Google: insert · patch · move · delete  (plazo 9 s)
   │  ok                                   │ fallo → mensaje en español, nada se guarda (RF-21..RF-26)
   ▼                                       └ 404/410 → sync_commit_event('gone') quita el evento (RF-25)
rpc sync_commit_event (sesión + secreto) ── vuelve a comprobar el rol y guarda en CaFam ──▶ aviso breve (RF-18)

Actualización horaria (007) ── sync_apply_events(…, p_read_at, p_access) ── no pisa lo cambiado en CaFam después de leer (RF-27, RF-28)
```

## Módulos y responsabilidades

### SQL: migraciones nuevas

- `sync_write_schema`:
  - `calendar_connections.can_write boolean not null default false`: las cuentas de la 007 quedan en `false` y siguen como antes (RF-2).
  - `synced_calendars.google_access text null check (in 'owner','writer','reader')`: el permiso que la cuenta tiene sobre ese calendario en Google (RF-8).
  - `can_write_synced(uuid)`: verdadero si la conexión está `active` y con `can_write`, el calendario está `active` y `google_access` es `owner` o `writer`.
  - Campo calculado de PostgREST `can_write(synced_calendars)`, para que cualquier miembro sepa si se puede escribir sin leer la conexión, que solo ve el propietario.
  - Trigger `prevent_synced_rename` en `calendars`: el nombre de un calendario traído solo cambia con la marca de transacción `app.sync_write`, igual que `app.account_transfer` de la 006 (RF-29, RF-30).
  - `connect_account` se borra y se vuelve a crear con `p_can_write`. Con la misma cuenta, actualiza `can_write` y conserva los calendarios (RF-4, RF-5).
  - `select_synced_calendars` (mismo nombre y argumentos) guarda `google_access` de cada elemento.

  Cubre: RF-2, RF-4, RF-5, RF-7, RF-8, RF-29, RF-30.
- `sync_write_functions`. Las cinco funciones exigen sesión y `p_secret`:
  - `sync_write_context` (comprueba antes de llamar a Google).
  - `sync_commit_event` (guarda después de Google).
  - `sync_update_calendar` (nombre, color y descripción de un calendario traído).
  - `sync_attach_created` (calendario creado en Google desde CaFam).
  - `sync_attach_uploaded` (convierte un calendario subido).

  Cubre: RF-6, RF-7, RF-10 a RF-12, RF-16, RF-19, RF-20, RF-25, RF-29, RF-32 a RF-34, RF-36, RF-38.
- `sync_apply_events_v2`: `sync_apply_events` se borra y se vuelve a crear con `p_read_at timestamptz` y `p_access text`. Cambia en tres cosas:
  - No borra ni modifica eventos con `updated_at >= p_read_at`, para que gane el último cambio (RF-27, RF-28) y no se pierda uno recién creado (caso límite).
  - Solo borra eventos con `external_id` no nulo: los que quedaron fuera de un calendario subido no se tocan (RF-42).
  - Guarda `google_access`.

  Sigue sin tocar `color` ni `category_id` (RF-16). Cubre: RF-8, RF-16, RF-27, RF-28, RF-42.

Las políticas de `events`, `calendars` y `calendar_members` no cambian. `merge_calendars` sigue rechazando calendarios traídos.

### Lógica pura (`src/lib/sync/`)

- `scopes.ts`: los permisos pedidos y `missingScopes(granted)`, que dice cuáles faltan en el `scope` de la respuesta de Google. Cubre: RF-1, RF-5.
- `google-payload.ts`:
  - `toGoogleEvent(row)` convierte un evento de CaFam en el cuerpo de Google: `date` para los de día completo (fin exclusivo, spec 002) y `dateTime` en UTC para los que tienen hora.
  - `toGooglePatch(before, after)` devuelve solo los campos cambiados. Si cambia el inicio, el fin o "día completo", manda inicio y fin juntos. No manda nunca color, categoría ni nada que CaFam no muestra.

  Cubre: RF-13, RF-14, RF-15, RF-16, caso límite de día completo ↔ con hora y caso límite de la descripción recortada.
- `write-errors.ts`: clasifica un fallo de escritura en `transient | revoked | rejected | gone` y da su texto en español. Nunca muestra el texto de Google. Cubre: RF-22 a RF-26, RF-30.
- `read-only.ts` (se amplía):
  - `canWriteEvents` usa `synced.canWrite` en vez de excluir los traídos.
  - Nuevo `moveTargets(event, calendars)`: un evento normal solo va a calendarios normales, y uno traído solo a otros traídos con escritura de la misma conexión.
  - Nuevo `readOnlyReason(synced)`: `reconnect`, `google` o `null`, para el texto en pantalla.

  Cubre: RF-6 a RF-9, RF-19, RF-20.
- `upload-plan.ts`: separa los eventos de un calendario en "a Google" (dentro de `syncWindow` y con el tope de `limitEvents`) y "solo en CaFam", y da los dos números. Cubre: RF-35, RF-42, RF-43.

### Cliente de Google y motor (`src/lib/sync/`)

- `providers/google.ts` (se amplía):
  - `GOOGLE_SCOPES` pasa a `scopes.ts`.
  - `exchangeCode` devuelve también `scope`.
  - `listCalendars` devuelve `accessRole` y `listEvents` el `accessRole` de la respuesta.
  - Funciones nuevas: `insertEvent`, `patchEvent`, `moveEvent`, `deleteEvent`, `insertCalendar`, `patchCalendar` y `deleteCalendar`, esta solo para deshacer lo que CaFam acaba de crear.
  - `kindOf` lee también `error.errors[0].reason` de la API: 403 o 429 por límite de uso → `transient`; 400 y el resto de 403 → `rejected`.

  Cubre: RF-1, RF-8, RF-10 a RF-13, RF-15, RF-17, RF-19, RF-22 a RF-24, RF-29, RF-32, RF-34, RF-37.
- `write-event.ts`: orquesta crear, cambiar, mover y borrar, con dependencias inyectadas como `run-sync.ts`. Los pasos son contexto → token → Google → guardado, y todas las llamadas comparten un plazo de 9 s.
  - Al cambiar: primero `patch` y después `move` (D7).
  - Un evento traído sin `external_id` (fuera del rango al subirlo) se cambia y se borra solo en CaFam (D9).

  Cubre: RF-10 a RF-12, RF-14, RF-17, RF-19, RF-21 a RF-25, RF-27, tiempo de respuesta.
- `upload-calendar.ts`: crea el calendario en Google y copia los eventos de cuatro en cuatro, con reintento si Google pide esperar. Luego llama a `sync_attach_uploaded`. Si algo falla, borra el calendario de Google que acaba de crear y no toca CaFam. Cubre: RF-34 a RF-37, RF-42.
- `run-sync.ts` (se amplía): pasa `p_read_at` (la hora antes de leer de Google) y `p_access` a `sync_apply_events`. `rejected` cuenta como `transient` al leer. Cubre: RF-8, RF-27, RF-28.
- `engine.ts` (se amplía): `writeEngineDeps()` crea las dependencias de escritura con el cliente de la **sesión del usuario** (`@/lib/supabase/server`) y `CRON_SECRET`. Cubre: requisito de privacidad.

### Rutas y Server Actions

- `src/app/dashboard/events/actions.ts`: `createEvent`, `updateEvent` y `deleteEvent` pasan por `write-event.ts` cuando el origen o el destino es un calendario traído. Lo normal no cambia. Con un error se devuelven `formError` y `values`, y un evento ya borrado en Google devuelve `done: "gone"` (aviso "Este evento se había borrado en Google"). Cubre: RF-9 a RF-12, RF-18, RF-21 a RF-26.
- `src/app/dashboard/calendars/actions.ts`: `updateCalendar` usa `patchCalendar` y después `sync_update_calendar` si el calendario es traído y cambia el nombre. El color y la descripción solo se guardan en CaFam. Cubre: RF-29 a RF-31.
- `src/app/dashboard/connections/actions.ts`: `createGoogleCalendar(connectionId, name)` hace estos pasos:
  1. Comprueba el límite de 20.
  2. Llama a `insertCalendar`.
  3. Llama a `sync_attach_created`.
  4. Si el paso 3 falla, borra en Google el calendario recién creado.

  Cubre: RF-32, RF-33.
- `src/app/dashboard/calendars/[id]/upload/`: página y `actions.ts` (`uploadCalendar`, con `maxDuration` según la T1). Solo la ve el propietario de un calendario normal; si no, 404. Muestra el recuento de RF-43 y deja elegir la cuenta, que debe ser una cuenta propia con escritura. Cubre: RF-34 a RF-38, RF-42, RF-43.
- `src/app/api/oauth/[provider]/callback/route.ts`: calcula `can_write` con `missingScopes`. Si faltan permisos, redirige a `/dashboard/connections/<id>?scope=missing` (RF-5).
- `src/app/privacy/page.tsx`: página estática y pública. `getRouteAccess` no la protege porque no empieza por `/dashboard`; se añade un test que lo asegura. Cubre: RF-39.

### Páginas y componentes

- `reconnect-notice.tsx` (nuevo, `components/connections/`): aviso al propietario de que su cuenta es de solo lectura, con el enlace "Volver a conectar" a `/dashboard/connections/new?provider=google`. Va en "Mis calendarios" y en la ficha de la cuenta. Con `?scope=missing` dice qué permiso falta. Cubre: RF-3, RF-5.
- La ficha de la cuenta añade:
  - "Solo lectura en Google" en los calendarios que la cuenta solo puede leer (RF-8).
  - Un formulario "Crear calendario en Google" (RF-32).
- Los formularios de evento, la ventana rápida y el arrastre reciben como destino los calendarios con `canWriteEvents` (RF-9). El selector de calendario al editar se limita a `moveTargets` (RF-19, RF-20).
- El detalle del evento muestra Editar, Duplicar y Borrar según `canWriteEvents`. Si no se puede escribir, explica el motivo con `readOnlyReason` (RF-7, RF-8).
- "Mis calendarios" y la edición del calendario muestran el enlace "Subir a Google" solo si el usuario es propietario, el calendario es normal y no está sin propietario, y tiene alguna cuenta con escritura (RF-34, RF-38).
- La portada y `provider-notice` enlazan a `/privacy` (RF-40). `provider-notice` también deja de decir que la app está en "Prueba" (RF-41).

No hacen: nada de esto borra calendarios en Google por decisión del usuario, envía a Google el color o la descripción del calendario, toca invitados ni recordatorios, ni guarda cambios pendientes para más tarde.

## Modelo de datos

- `calendar_connections.can_write boolean not null default false`. Lo escribe solo `connect_account` y lo lee el propietario con la política actual (RF-2 a RF-5).
- `synced_calendars.google_access text null`, con `check in ('owner','writer','reader')`. `null` significa "aún no se sabe" y no deja escribir. Lo escriben `select_synced_calendars`, `sync_apply_events` (del `accessRole` de `events.list`), `sync_attach_created` y `sync_attach_uploaded` (estas dos con `owner`) (RF-8).
- `can_write(synced_calendars) returns boolean`: campo calculado, `stable`, `SECURITY DEFINER` y `search_path = ''`. Es `can_write_synced(calendar_id)` sobre la fila. Los miembros lo ven y no exponen la conexión.
- `events`: sin columnas nuevas.
  - `external_id` nulo en un calendario traído = evento que solo existe en CaFam (RF-42).
  - `created_by` es quien creó el evento en CaFam, también un Editor (caso límite de la spec 006).
  - `updated_at` es la marca que compara `sync_apply_events` (RF-27, RF-28).
- `FormState.done` admite además `"gone"`.
- Sin variables de entorno nuevas ni secretos nuevos en Vault.

## Contratos e interfaces

Todas las funciones nuevas son `SECURITY DEFINER` con `search_path = ''` y se conceden a `authenticated`. Sin sesión lanzan `42501`. Con un secreto distinto de `cron_secret` también lanzan `42501`. Los códigos de error son los de la 007: `CF404` (no válido para ti), `CF429` (más de 20) y `22023` (combinación no permitida).

- `sync_write_context(p_secret, p_calendar_id uuid, p_event_id uuid default null, p_target_calendar_id uuid default null) returns jsonb`.
  - Devuelve `{synced:false}` si el origen y el destino son normales.
  - Si no, devuelve `{synced:true, connection_id, calendar_external_id, event_external_id, target_external_id}`.
  - Exige rol `owner` o `editor` (`calendar_role_for`) en el origen y en el destino (RF-6, RF-7) y `can_write_synced` en los traídos (RF-2, RF-8).
  - Mezclar un calendario traído con uno normal, o dos conexiones distintas, lanza `22023` (RF-20).
  - Un evento que no está en `p_calendar_id` lanza `CF404`.
- `sync_commit_event(p_secret, p_op text, p_calendar_id uuid, p_event_id uuid, p_row jsonb, p_external_id text) returns uuid`.
  - `p_op` es `insert | update | delete | gone`, y la función repite las comprobaciones de `sync_write_context`.
  - `insert` hace un upsert por `(calendar_id, external_id)`, con `created_by = auth.uid()`: si la actualización horaria ya lo trajo, no se duplica.
  - `update` escribe `p_row`, que puede llevar el cambio de calendario, el color y la categoría.
  - `delete` y `gone` borran (RF-10 a RF-12, RF-19, RF-25).
- `sync_update_calendar(p_secret, p_calendar_id, p_name, p_description, p_color)`. Solo el propietario. Activa `app.sync_write` para el nombre (RF-29, RF-31).
- `sync_attach_created(p_secret, p_connection_id, p_external_id, p_name) returns uuid`.
  - Solo el dueño de la conexión, y la conexión debe tener `can_write`.
  - Crea el calendario y su fila en `synced_calendars` con `google_access = 'owner'`.
  - El calendario número 21 lanza `CF429` (RF-32, RF-33).
- `sync_attach_uploaded(p_secret, p_calendar_id, p_connection_id, p_external_id, p_mapping jsonb) returns void`.
  - El calendario debe ser propio, normal, no sin propietario y no traído, y la conexión del llamante y con escritura (RF-38). Además cuenta para el límite de 20 (RF-33).
  - `p_mapping` es `[{event_id, external_id}]` y fija `external_id` en esos eventos.
  - Crea la fila de `synced_calendars` con `google_access = 'owner'`. Miembros, categorías, colores y el resto de eventos quedan como estaban (RF-34, RF-36, RF-42).
- `sync_apply_events(p_secret, p_calendar_id, p_events jsonb, p_skipped int default 0, p_omitted int default 0, p_read_at timestamptz default now(), p_access text default null) returns jsonb`. Es la misma función de la 007 con los tres cambios de la migración `sync_apply_events_v2`.
- `connect_account(p_provider, p_subject, p_email, p_refresh_token, p_can_write boolean default false) returns jsonb`. Hace lo mismo que en la 007 y además guarda `can_write`.

Google: los permisos pedidos son `openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars` (RF-1, D1). Las llamadas nuevas son estas:

| Llamada | Para qué |
|---------|----------|
| `POST /calendars/{cal}/events` | Crear un evento |
| `PATCH /calendars/{cal}/events/{id}` | Cambiar un evento; el id de una repetición solo cambia esa repetición (RF-17) |
| `POST /calendars/{cal}/events/{id}/move?destination=` | Mover un evento |
| `DELETE /calendars/{cal}/events/{id}` | Borrar un evento |
| `POST /calendars` | Crear un calendario |
| `PATCH /calendars/{cal}` | Cambiar el nombre (`summary`) |
| `DELETE /calendars/{cal}` | Solo para deshacer RF-37 y RF-32 |

Ninguna lleva `If-Match`: gana el último cambio (RF-27).

Server Actions:
- `createEvent`, `updateEvent` y `deleteEvent` mantienen su firma.
- `uploadCalendar(calendarId, prevState, formData)` (campo `connectionId`) y `createGoogleCalendar(connectionId, prevState, formData)` (campo `name`, validado con el esquema del nombre de calendario) devuelven `FormState`. Al acabar bien, redirigen a la ficha del calendario o de la cuenta.

Textos (`write-errors.ts`):

| Tipo | Texto |
|------|-------|
| `transient` | "Google no responde. No se ha guardado el cambio; vuelve a intentarlo dentro de un momento." |
| `revoked` | "Google ya no deja a CaFam usar esta cuenta. Vuelve a conectarla para guardar cambios." |
| `rejected` | "Google no ha permitido el cambio, así que no se ha guardado." |
| `gone` | "Este evento se había borrado en Google y se ha quitado de CaFam." |

Rutas: `GET /privacy` es pública y estática.

## Flujo principal paso a paso

Caso central: un Editor cambia y mueve un evento de un calendario traído.

1. El Editor abre el evento. `load-event.ts` ve `synced.canWrite` y muestra Editar (RF-6). El selector de calendario solo ofrece los traídos con escritura de la misma cuenta (`moveTargets`, RF-19, RF-20).
2. Guarda. `updateEvent` valida con `zod` como siempre y llama a `sync_write_context` con el calendario de origen, el evento y el destino. Postgres comprueba el rol y que la cuenta puede escribir (RF-7, RF-8) y devuelve los ids de Google.
3. `write-event.ts` lee la fila actual del evento con la sesión, calcula `toGooglePatch` (RF-13 a RF-15), pide el token del propietario (`sync_get_token` y renovación, en el servidor) y hace `PATCH` y después `move` con el plazo de 9 s (RF-11, RF-17, RF-19).
4. Si Google falla, el tipo de fallo da el mensaje (RF-22 a RF-24, RF-26) y la acción devuelve `formError` con `values`, sin llamar a la base de datos (RF-21). Si el permiso está revocado, además llama a `sync_fail(…, 'revoked')`, que pone la cuenta en `needs_reauth` y crea el aviso (RF-23). Un 404 o 410 llama a `sync_commit_event('gone')` y devuelve `done: "gone"` (RF-25).
5. Si Google acepta, `sync_commit_event('update')` guarda en CaFam la fila nueva, con el color y la categoría de CaFam (RF-16). La acción revalida y la ventana muestra "Cambios guardados" (RF-18).
6. A la hora siguiente, `runSync` lee Google con `p_read_at`. El evento ya coincide y no cambia. Si otro lo hubiera tocado en CaFam después de la lectura, `sync_apply_events` lo respeta (RF-27). Un cambio en Google posterior al de CaFam se aplica (RF-28).

Subir un calendario (RF-34 a RF-38, RF-42, RF-43):

1. `/upload` comprueba los requisitos de RF-38.
2. `upload-plan` cuenta los eventos de "a Google" y de "solo en CaFam" (RF-43).
3. Al confirmar, se crea el calendario en Google y se copian los eventos con `toGoogleEvent`.
4. `sync_attach_uploaded` hace la conversión en una sola transacción.
5. Un fallo en cualquier paso borra el calendario de Google recién creado y deja CaFam igual (RF-37).

## Decisiones técnicas

- D1: Permisos `calendar.events` + `calendar.calendars` + `calendar.calendarlist.readonly`. Descartado: `calendar` (acceso total, incluido borrar calendarios y cambiar compartidos, que la spec deja fuera) y `calendar.calendarlist` de escritura (solo serviría para quitar suscripciones). Motivo: el mínimo que cubre eventos, crear y renombrar calendarios y listar. Cubre: RF-1.
- D2: Una cuenta escribe solo si Google concedió **todos** los permisos de D1 (`can_write`). Descartado: escribir por partes según cada permiso. Motivo: RF-5 lo exige ("todos los permisos pedidos") y hay un solo estado. Cubre: RF-2 a RF-5.
- D3: Las escrituras de calendarios traídos pasan por funciones que exigen sesión y `cron_secret` a la vez, y RLS de `events` no cambia. Descartado: abrir las políticas a propietario y Editor en calendarios traídos, porque un cliente podría escribir en CaFam sin pasar por Google y rompería "CaFam nunca muestra un cambio que Google no tiene". Motivo: la base de datos decide el rol (P3) y el secreto prueba que el servidor ya escribió en Google, sin `service_role` (P4). Cubre: RF-6, RF-7, RF-10 a RF-12, RF-21, requisito "Base de datos como frontera".
- D4: Google primero y CaFam después, sin cola. Descartado: guardar en CaFam y enviar luego (fuera de alcance) y una transacción distribuida. Motivo: si falla el guardado en CaFam tras Google, lo arregla la actualización horaria, que trae el cambio desde Google, y CaFam nunca va por delante. Cubre: RF-10 a RF-12, RF-21.
- D5: "Gana el último" con `PATCH` sin `If-Match` hacia Google y, hacia CaFam, `sync_apply_events` no pisa filas con `updated_at >= p_read_at`. Descartado: comparar el `updated` de Google con `updated_at` de CaFam, que mezcla relojes distintos y obliga a guardar el `updated` de cada evento. Motivo: con la hora de lectura de Google basta, y además evita el caso límite del evento recién creado durante una actualización. Cubre: RF-27, RF-28.
- D6: Solo se envía lo cambiado (`toGooglePatch`), comparando con la fila de CaFam antes del cambio. Descartado: `PUT` del evento entero, que borraría invitados, recordatorios y el resto de RF-15. Cubre: RF-13 a RF-15.
- D7: Al cambiar y mover a la vez, primero `PATCH` y luego `move`. Descartado: mover primero. Motivo: si `move` falla, Google tiene los cambios en el calendario original y la siguiente actualización los trae a CaFam; al revés, quedaría movido en Google pero no en CaFam. Cubre: RF-19, RF-21.
- D8: Las repeticiones se escriben con su id de instancia, el que ya da `singleEvents=true` (plan 007 D8). Descartado: tocar la serie. Motivo: Google cambia o cancela solo esa repetición. Cubre: RF-17.
- D9: En un calendario subido, un evento sin `external_id` (fuera del rango al subir) se cambia y borra solo en CaFam, y `sync_apply_events` ya no borra eventos con `external_id` nulo. Descartado: crearlo en Google al editarlo. Motivo: RF-42 dice que esos eventos no se envían a Google. Cubre: RF-42.
- D10: El permiso de cada calendario en Google (`google_access`) se guarda desde `accessRole`, que llega en `calendarList` y en cada `events.list`. Descartado: preguntarlo a Google antes de cada escritura (una llamada más dentro de los 10 s). Motivo: se actualiza cada hora sin coste, y si cambia entre medias Google rechaza el cambio (RF-24). Cubre: RF-8.
- D11: Los miembros saben si pueden escribir gracias al campo calculado `can_write(synced_calendars)`. Descartado: dar a los miembros lectura de `calendar_connections`, que expone el correo de la cuenta (RF-26 de la 007). Motivo: una sola regla (`can_write_synced`) para la interfaz y para las funciones. Cubre: RF-6 a RF-9.
- D12: Un plazo común de 9 s para todas las llamadas de una escritura (`AbortSignal.timeout` en un `fetch` envuelto). Descartado: un plazo por llamada, porque con la renovación del token y dos llamadas podría pasar de 10 s. Cubre: RF-22, tiempo de respuesta.
- D13: El nombre de un calendario traído está protegido con un trigger y la marca `app.sync_write`, como `app.account_transfer` (spec 006). Descartado: dejar que el propietario lo cambie directamente con RLS, porque CaFam tendría un nombre que Google no tiene. Cubre: RF-29, RF-30.
- D14: La subida se hace en una sola Server Action síncrona, con 4 llamadas a la vez y reintento con espera ante 429 o 403 por límite de uso. Si falla, se compensa borrando el calendario de Google, que borra también sus eventos. Descartado: un trabajo en segundo plano con tabla de progreso (más estado, y CaFam tendría un calendario a medias). Motivo: simplicidad y RF-37. Depende de `maxDuration` (T1). Cubre: RF-34, RF-35, RF-37.
- D15: Crear un calendario en Google desde la ficha de la cuenta, y si `sync_attach_created` falla, borrar el recién creado. Descartado: dejarlo en Google. Motivo: no dejar restos que el usuario no ve en CaFam; no es un borrado decidido por el usuario, que la spec deja fuera. Cubre: RF-32, RF-33.
- D16: Política de privacidad como página estática en `/privacy`. Descartado: un documento externo (Google Docs o GitHub). Motivo: está en el mismo dominio que Google pide como página principal, sin coste ni cuenta nueva. Cubre: RF-39, RF-40.

## Trazabilidad RF -> módulo

- RF-1 -> `scopes`, `providers/google`, `oauth/start`
- RF-2 -> `calendar_connections.can_write` (por defecto `false`), `can_write_synced`, `read-only`
- RF-3 -> `reconnect-notice`, "Mis calendarios", ficha de la cuenta
- RF-4 -> `connect_account` (`p_can_write`), `oauth/callback`
- RF-5 -> `scopes` (`missingScopes`), `oauth/callback`, `reconnect-notice`
- RF-6 -> `sync_write_context`, `sync_commit_event`, `can_write`, `read-only`, detalle de evento
- RF-7 -> `sync_write_context`, `sync_commit_event` (rol), `read-only`
- RF-8 -> `synced_calendars.google_access`, `sync_apply_events_v2`, `select_synced_calendars`, `readOnlyReason`, ficha de la cuenta
- RF-9 -> `canWriteEvents`, `load-new-event`, `load-event`, `calendar/page` (ventana rápida y arrastre)
- RF-10 -> `write-event`, `providers/google` (`insertEvent`), `sync_commit_event('insert')`, `createEvent`
- RF-11 -> `write-event`, `patchEvent`, `sync_commit_event('update')`, `updateEvent`
- RF-12 -> `write-event`, `deleteEvent` (Google), `sync_commit_event('delete')`, `deleteEvent` (acción)
- RF-13 -> `google-payload` (`toGoogleEvent`)
- RF-14 -> `google-payload` (`toGooglePatch`), `write-event`
- RF-15 -> `toGooglePatch` (solo campos de CaFam), `PATCH`
- RF-16 -> `sync_commit_event` (color y categoría en CaFam), `sync_apply_events` (no los toca)
- RF-17 -> D8, `patchEvent`/`deleteEvent` con id de instancia
- RF-18 -> `createEvent`/`updateEvent`/`deleteEvent` (`done`), avisos de la spec 008
- RF-19 -> `moveEvent`, `write-event`, `moveTargets`, `sync_commit_event`
- RF-20 -> `moveTargets`, `sync_write_context` (`22023`)
- RF-21 -> `write-event` (Google primero), acciones (`values`)
- RF-22 -> `write-errors` (`transient`), plazo de 9 s (D12)
- RF-23 -> `write-errors` (`revoked`), `sync_fail('revoked')`
- RF-24 -> `write-errors` (`rejected`), `kindOf`
- RF-25 -> `write-errors` (`gone`), `sync_commit_event('gone')`, `done: "gone"`
- RF-26 -> `write-errors` (textos propios)
- RF-27 -> D5, `PATCH` sin `If-Match`, `sync_apply_events_v2` (`p_read_at`)
- RF-28 -> `sync_apply_events_v2`, `run-sync`
- RF-29 -> `patchCalendar`, `sync_update_calendar`, `prevent_synced_rename`, `updateCalendar`
- RF-30 -> `write-errors`, `updateCalendar`
- RF-31 -> `patchCalendar` (solo `summary`), `sync_update_calendar`
- RF-32 -> `insertCalendar`, `sync_attach_created`, `createGoogleCalendar`, ficha de la cuenta
- RF-33 -> `sync_attach_created`, `sync_attach_uploaded` (`CF429`), `createGoogleCalendar`, `uploadCalendar`
- RF-34 -> `upload-calendar`, `sync_attach_uploaded`, página `/upload`
- RF-35 -> `upload-plan` (ventana y tope de 2.000)
- RF-36 -> `sync_attach_uploaded` (solo añade la fila y los `external_id`)
- RF-37 -> `upload-calendar` (compensación con `deleteCalendar`)
- RF-38 -> `sync_attach_uploaded`, página `/upload` (404), enlace "Subir a Google"
- RF-39 -> `/privacy`, `route-access` (test)
- RF-40 -> portada, `provider-notice`
- RF-41 -> paso de producción "Publicar la aplicación", `provider-notice`
- RF-42 -> `upload-plan`, D9, `sync_apply_events_v2`
- RF-43 -> `upload-plan`, página `/upload`

## Comprobaciones de la T1

Antes de programar. Las hacen el usuario (consolas) y el agente (documentación y dev):

- (a) **Duración de la subida.** Confirmar en la documentación de Vercel el `maxDuration` máximo de Hobby con Fluid compute. Si es 300 s, `/upload` usa 300. Si es 60, se mide en dev cuántos eventos se suben en 50 s y se anota. Si un calendario real de la familia no cabe, se vuelve al usuario antes de seguir (D14).
- (b) **Requisitos para publicar.** En Google Cloud (proyecto `CaFam` → Público), ver qué pide "Publicar aplicación" con permisos sensibles sin verificar: página principal, política de privacidad y dominio autorizado `calendario-familia-five.vercel.app`, sin verificar el dominio ni pagar. Se anota la respuesta. No se publica hasta la tarea final.
- (c) **Permisos de D1** registrados en "Acceso a los datos" (según AGENTS.md ya están `calendar.events` y `calendar.calendars`; `calendar.calendarlist.readonly` se usa desde la 007).
- (d) **Comportamiento de Google**, con una cuenta de prueba en dev y llamadas a mano:
  - `events.list` devuelve `accessRole`.
  - `PATCH` sobre el id de una repetición cambia solo esa.
  - `move` de una repetición: anotar qué responde; si la rechaza, se aplica RF-24.
  - Un 404 al cambiar un evento borrado.
  - El `scope` de la respuesta del token lista los permisos concedidos.

## Pasos de producción (los ejecuta el usuario)

1. Migraciones a prod: `npx supabase link --project-ref yznbdoskvtxeasujtirk`, `npx supabase db push` y `npx supabase link --project-ref uthubyzhonrtrmbcqcjh` (volver a dev). Aplica `sync_write_schema`, `sync_write_functions` y `sync_apply_events_v2`.
2. Desplegar: `git checkout main && git merge --ff-only 009-sincronizacion-bidireccional && git push origin main`.
3. Google Cloud (`CaFam`):
   - Página principal `https://calendario-familia-five.vercel.app`, política `https://calendario-familia-five.vercel.app/privacy` y dominio autorizado.
   - "Publicar aplicación" (RF-41).
   - Comprobar que una cuenta que no está en la lista de pruebas conecta pasando por el aviso de "aplicación no verificada".
4. Volver a conectar las cuentas de la 007 (RF-3, RF-4).

Sin variables nuevas en Vercel ni secretos nuevos en Vault.

## Riesgos y mitigaciones

- R1: Google acepta el cambio y falla el guardado en CaFam, por ejemplo por un corte de red con Supabase. CaFam queda por detrás de Google hasta la siguiente actualización. Mitigación: el mensaje dice que no se ha podido guardar en CaFam y la actualización horaria lo corrige; nunca queda CaFam por delante (D4).
- R2: La subida no cabe en `maxDuration` o Google limita las peticiones. Mitigación: comprobación (a) de la T1, 4 llamadas a la vez con reintento y compensación completa (RF-37).
- R3: Un Editor escribe con la cuenta de Google del propietario. Mitigación: el token solo se usa en el servidor y para el calendario que dicen las funciones (`sync_write_context` devuelve solo ids del calendario y del evento autorizados), nunca se devuelve al cliente, y `no-secrets` y la revisión del diff lo comprueban.
- R4: El secreto compartido sigue siendo la segunda llave de las escrituras (plan 007 R2). Mitigación: las funciones nuevas exigen además una sesión con rol, así que el secreto solo no basta para escribir.
- R5: Al quitar la condición `external_id is null` del borrado de `sync_apply_events`, un evento metido a mano en un calendario de la 007 dejaría de borrarse. No pasa porque RLS lo impedía. Mitigación: un test de integración lo comprueba.
- R6: Google rechaza mover una repetición o un evento de otro organizador. Mitigación: se aplica RF-24 y se comprueba en la T1 (d).
- R7: `calendar.calendars` hace que la pantalla de Google de "aplicación no verificada" sea más alarmante. Mitigación: `provider-notice` y la política de privacidad lo explican (RF-40).
- R8: El tope de 100 usuarios de las aplicaciones sin verificar (caso límite). Mitigación: RF-47 de la 007 ya lo trata.

## Dudas abiertas

- Ninguna que bloquee: lo que falta por confirmar está en "Comprobaciones de la T1" y su resultado se anota aquí antes de la T2.
