# Plan 007 — Sincronización de calendarios externos (Google)

> Spec de origen: `specs/007-sincronizacion-oauth/spec.md` (aprobada, 2026-10-23). Constitución: `docs/constitution.md`. Estado: **Aprobado** por el usuario (2026-10-23), con RF-30 y RF-47 reformulados en la spec. **Enmendado** el 2026-10-27 con la Enmienda 1 de la spec: se quita Microsoft (ver "Comprobaciones de la T1"); lo que solo servía a Microsoft se borra del plan. Spec **cerrada** el 2026-10-28 con la Enmienda 2 (aplicación de Google en "Prueba").
> Fuentes consultadas el 2026-10-23: Google (`support.google.com/cloud/answer/7454865`, `developers.google.com/identity/protocols/oauth2`, `developers.google.com/workspace/calendar/api/auth`) y Microsoft Learn (`event: delta`, ya sin uso tras la Enmienda 1). Lo que no pude confirmar está en "Dudas abiertas".

## Resumen de arquitectura

La conexión OAuth y la lectura de los proveedores corren en **Route Handlers y Server Actions de Next.js** (código `src/lib/sync/`), sin librerías de OAuth ni de los proveedores. Todo lo que se guarda lo gobierna Postgres: las tablas llevan RLS, los calendarios traídos son de solo lectura por una política y las escrituras de la sincronización pasan por funciones `SECURITY DEFINER` protegidas con un secreto de servidor que vive en Vault y en Vercel (`CRON_SECRET`), así que **no hay clave `service_role` en la aplicación** (P4). La actualización automática la dispara `pg_cron` desde Postgres, que llama con `pg_net` a un endpoint de la aplicación; el botón "Actualizar ahora" usa el mismo motor. Los grupos son una tabla por usuario y una columna en `calendar_preferences`.

```
Usuario ── /dashboard/connections/new?provider= ──▶ aviso (RF-48) ──▶ /api/oauth/[provider]/start (state + PKCE en cookie)
        ◀── /api/oauth/[provider]/callback ◀── proveedor ── code ──▶ intercambio ──▶ rpc connect_account (token a Vault)
        ──▶ /dashboard/connections/[id] ── elegir calendarios ──▶ rpc select_synced_calendars (crea calendarios)
        ── Actualizar ahora / pg_cron horario ──▶ runSync: sync_claim_* ─▶ token ─▶ API del proveedor ─▶ normalizar ─▶ sync_apply_events
Postgres ── pg_cron cada hora ──▶ sync_trigger() ──▶ pg_net POST /api/sync/run (Bearer CRON_SECRET) ──▶ runSync de lo que toque
```

## Módulos y responsabilidades

### SQL: migraciones nuevas (nunca se editan las aplicadas)

- `sync_schema`: tablas `calendar_connections`, `calendar_connection_secrets` y `synced_calendars`; columna `events.external_id` con índice único parcial `(calendar_id, external_id)`; función `is_synced_calendar(uuid)`; política de eventos de solo lectura en calendarios traídos; ampliación de los tipos de `account_notices`; bloqueo en `merge_calendars`. Cubre: RF-6, RF-7, RF-20, RF-26, RF-44.
- `sync_connect_functions`: `connect_account`, `select_synced_calendars`, `detach_synced_calendars`, `disconnect_account`. Cubre: RF-6 a RF-8, RF-10, RF-11, RF-14, RF-27 a RF-29, RF-32, RF-45.
- `sync_worker_functions`: `sync_claim_due`, `sync_claim_connection`, `sync_get_token`, `sync_store_token`, `sync_apply_events`, `sync_fail`, `sync_trigger` y la programación con `cron.schedule`. Cubre: RF-13, RF-22 a RF-26, RF-31, RF-33, RF-34.
- `calendar_groups`: tabla `calendar_groups` y columna `calendar_preferences.group_id`. Cubre: RF-35 a RF-43, RF-46.

No cambian: las políticas de `calendars`, `calendar_members` y `event_categories`. `import_calendar` no se toca.

### Lógica pura y proveedores (`src/lib/sync/`)

- `limits.ts`: constantes (5 cuentas, 20 calendarios, 2.000 eventos, ventana de −6 y +12 meses, 5 minutos, 3 fallos, 6 horas). Cubre: RF-8, RF-14, RF-15, RF-19, RF-22, RF-24, RF-34.
- `window.ts`: calcula el rango `[hoy−6 meses, hoy+12 meses]` en UTC. Cubre: RF-15.
- `providers/google.ts`: construye la URL de autorización (PKCE), intercambia el código, renueva el token, lista calendarios, lee eventos del rango y revoca el token. Recibe `fetch` por parámetro para probarse sin red. Cubren: RF-1 a RF-3, RF-9, RF-12, RF-15, RF-16, RF-30.
- `google-events.ts`: convierte la respuesta de Google al tipo `EventRow` que ya usa la importación `.ics`. Descarta cancelados y eventos inválidos y cuenta lo omitido. Cubren: RF-16 a RF-18.
- `limit-events.ts`: si hay más de 2.000, se queda con los más cercanos a hoy y devuelve cuántos omitió. Cubre: RF-19.
- `nearest-color.ts`: elige el color de la paleta de la spec 002 más cercano al del proveedor. Cubre: RF-10.
- `oauth-state.ts`: genera y valida `state` y el verificador PKCE, guardados en una cookie `httpOnly`, `secure`, `sameSite=lax` de 10 minutos. Cubre: RF-1, RF-4, RF-5.
- `run-sync.ts`: orquesta una actualización (reclamar → token → leer → normalizar → limitar → aplicar), con concurrencia máxima de 4 calendarios y un presupuesto de 50 s, y clasifica los errores en `transient`, `revoked` o `missing`. Cubre: RF-13, RF-22, RF-23, RF-25, RF-31, RF-33.
- `error-messages.ts` y `summary.ts`: textos en español de errores y del resumen de una actualización. Cubren: RF-4, RF-5, RF-18, RF-19, RF-23, RF-24, RF-47.
- `schemas.ts`: esquemas `zod` de las acciones (identificadores, selección, decisión de desconexión). Cubre: RF-9, RF-11, RF-27.

### Rutas y Server Actions

- `src/app/api/oauth/[provider]/start/route.ts`: exige sesión, guarda `state` y PKCE y redirige al proveedor. Cubre: RF-1, RF-2.
- `src/app/api/oauth/[provider]/callback/route.ts`: valida `state`, intercambia el código, lee correo e identificador de la cuenta del `id_token` recibido por canal directo, llama a `connect_account` y redirige. Cubre: RF-3 a RF-8, RF-32, RF-47.
- `src/app/api/sync/run/route.ts`: `POST` protegido por `Authorization: Bearer ${CRON_SECRET}`; llama a `sync_claim_due` y a `runSync`. `maxDuration` de 60 s. Cubre: RF-22, RF-33.
- `src/app/dashboard/connections/actions.ts`: `saveSelection`, `syncNow`, `disconnectAccount`. Cada una valida con `zod`, comprueba por RLS que la conexión es del usuario y llama a `revalidatePath("/dashboard", "layout")`. Cubre: RF-10, RF-11, RF-23, RF-24, RF-27 a RF-30.
- `src/app/dashboard/calendars/group-actions.ts`: `createGroup`, `renameGroup`, `deleteGroup`, `assignToGroup`, `setGroupVisibility` y la ampliación de `saveOrder` (en `preferences-actions.ts`) para ordenar grupos y calendarios dentro de un grupo. Cubre: RF-35 a RF-41.

### Páginas y componentes

- `/dashboard/connections` (lista de cuentas, botón Google, errores de la vuelta de OAuth), `/dashboard/connections/new` (aviso de RF-48 antes de ir al proveedor) y `/dashboard/connections/[id]` (calendarios de la cuenta con casillas, estado, "Actualizar ahora", desconectar). Enlace desde "Más" y desde "Mis calendarios". Cubre: RF-1, RF-3, RF-9, RF-12, RF-14, RF-23, RF-26, RF-27, RF-48.
- `src/components/connections/`: `connection-list`, `provider-notice`, `calendar-picker`, `sync-status`, `sync-now-button`, `disconnect-dialog` (reutiliza `ConfirmDialog`). Cubren: las mismas rutas.
- `src/components/groups/`: `group-section` (cabecera con interruptor de visibilidad y estado parcial), `group-form`, `assign-group-select`. Se integran en `calendar-list` y en el panel de filtros. Cubren: RF-35 a RF-41, RF-46.
- `src/lib/calendar/organize-groups.ts` (pura): devuelve las secciones del usuario (grupos con sus calendarios, luego el agrupado por persona de los que no tienen grupo, que ya hace `grouping.ts`), el estado de visibilidad de cada grupo y la marca "Sin propietario". Cubre: RF-36, RF-37, RF-40, RF-42, RF-46.
- Modificaciones: formularios de evento y detalle ocultan los calendarios traídos como destino y el botón de editar y borrar (RF-20); el formulario de juntar los excluye (RF-44, RF-45); la ficha del calendario muestra la cuenta de origen solo al propietario y la última actualización a todos (RF-21, RF-26); `notice-list` (spec 006) muestra los avisos nuevos (RF-31, RF-34).

No hacen: ninguna de estas piezas escribe en el proveedor, guarda contactos ni almacena otros datos de la cuenta.

## Modelo de datos

Todas las tablas nuevas con RLS, `created_at` y las convenciones de la constitución.

- `calendar_connections { id uuid pk, owner_id → profiles on delete cascade, provider ('google'|'microsoft'; tras la Enmienda 1 solo se usa 'google', y 'microsoft' se queda en el `check` de la migración ya aplicada para una versión futura), account_subject text, account_email text, status ('active'|'needs_reauth'), last_synced_at timestamptz null, created_at, updated_at }`. Único `(owner_id, provider, account_subject)` (RF-6). Lectura solo del propietario; sin políticas de escritura.
- `calendar_connection_secrets { connection_id pk → calendar_connections on delete cascade, vault_secret_id uuid }`. RLS activado sin políticas. El token de renovación está en Vault (`vault.secrets`), nunca en una tabla de `public`.
- `synced_calendars { calendar_id pk → calendars on delete cascade, connection_id → calendar_connections on delete cascade, provider, external_id text, state ('active'|'missing'), last_attempt_at, last_synced_at null, consecutive_failures int default 0, last_error text null, last_summary jsonb null, sync_started_at null }`. Único `(connection_id, external_id)`. Lectura para los miembros del calendario (sin correo de la cuenta); escritura solo por funciones. Si se borra la conexión, la fila desaparece y el calendario queda como normal (la conservación del RF-28 y del caso "propietario borra la cuenta").
- `events.external_id text null`, con índice único parcial `(calendar_id, external_id) where external_id is not null`. Se vacía al conservar.
- `account_notices.kind` amplía su `check` con `sync_revoked` y `sync_failing`; `calendar_name` guarda la cuenta o el calendario afectado.
- `calendar_groups { id uuid pk, user_id → profiles on delete cascade, name text (1 a 40), position int null, created_at, updated_at }`, índice único `(user_id, lower(btrim(name)))` y único `(id, user_id)`. RLS: el propio usuario lee y escribe.
- `calendar_preferences.group_id uuid null`, con FK compuesta `(group_id, user_id) → calendar_groups(id, user_id) on delete set null (group_id)`: un grupo ajeno no se puede asignar y borrar un grupo devuelve sus calendarios a "sin grupo" (RF-37, RF-41). La fila ya la limpian el borrado del calendario (cascada) y el trigger de quien sale (RF-43).
- Vault (los crea el usuario en el SQL Editor de cada proyecto): `cron_secret` (igual que `CRON_SECRET`) y `sync_app_url` (URL de la aplicación). Sin ellos, la actualización automática no arranca y el botón sigue funcionando.
- Política de eventos: `insert`, `update` y `delete` exigen además `not is_synced_calendar(calendar_id)`, y el `with check` impide mover un evento a un calendario traído (RF-20).

## Contratos e interfaces

Funciones `SECURITY DEFINER` con `search_path = ''`. Las de **usuario** (`authenticated`) usan `auth.uid()`. Las de **sincronización** reciben `p_secret`, que se compara con `cron_secret` de Vault; se conceden a `anon` y `authenticated` porque el motor las llama con la clave pública y sin sesión. Un secreto incorrecto lanza `42501`.

De usuario:
- `connect_account(p_provider, p_subject, p_email, p_refresh_token) returns uuid`: crea la conexión y guarda el token en Vault; si ya existe para ese usuario, reemplaza el token, la pone `active` y reinicia fallos (RF-32); si el usuario ya tiene 5 cuentas, lanza `CF429` (RF-8). Devuelve el id y si ya existía.
- `select_synced_calendars(p_connection_id, p_calendars jsonb) returns jsonb`: para cada `{external_id, name, color}` nuevo crea el calendario del llamante y su fila en `synced_calendars`; si el total supera 20, lanza `CF429` (RF-14). No cambia nombre ni color de los ya traídos.
- `detach_synced_calendars(p_connection_id, p_calendar_ids uuid[], p_delete boolean)`: con `p_delete = false` borra solo la fila de `synced_calendars` y los `external_id` (RF-28, RF-45); con `true` borra los calendarios (RF-29, RF-11).
- `disconnect_account(p_connection_id, p_delete boolean)`: aplica lo anterior a todos sus calendarios, borra el secreto de Vault y la conexión (RF-30, parte local).

De sincronización:
- `sync_claim_due(p_secret, p_limit) returns table(calendar_id, connection_id, provider, external_id)`: calendarios `active` de conexiones `active` con `last_attempt_at` de hace más de 5 horas y sin `sync_started_at` reciente; marca intento e inicio (RF-22).
- `sync_claim_connection(p_secret, p_connection_id, p_manual) returns jsonb`: si es manual y la conexión se actualizó hace menos de 5 minutos, devuelve `{status:"too_soon", next_at}` (RF-24); si no, `{status:"ok", calendars:[…]}`.
- `sync_get_token(p_secret, p_connection_id) returns text` y `sync_store_token(p_secret, p_connection_id, p_token)` (por si Google devuelve un token de renovación nuevo al renovar).
- `sync_apply_events(p_secret, p_calendar_id, p_events jsonb, p_skipped int, p_omitted int) returns jsonb`: en una transacción y con el calendario bloqueado, inserta los nuevos, modifica solo los que cambian, borra los que ya no llegan y guarda `last_summary` con `{added, changed, removed, skipped, omitted}`; reinicia fallos (RF-23, RF-25). Los eventos se identifican por `external_id`, sin duplicados.
- `sync_fail(p_secret, p_calendar_id, p_kind)`: `transient` suma un fallo y, al llegar a 3, crea el aviso `sync_failing` una vez (RF-33, RF-34); `revoked` pone la conexión en `needs_reauth` y crea `sync_revoked` (RF-31); `missing` marca `state = 'missing'` (RF-13).
- `sync_trigger()` (solo `postgres`): si hay algo pendiente y existen los secretos, hace `net.http_post` a `sync_app_url || '/api/sync/run'` con `timeout_milliseconds = 60000`. `cron.schedule('sync-run-due', '0 * * * *', …)`.

HTTP:
- `GET /api/oauth/[provider]/start` → 307 al proveedor; sin sesión → `/login`.
- `GET /api/oauth/[provider]/callback` → 307 a `/dashboard/connections/<id>` si va bien, o a `/dashboard/connections?error=cancelled|failed|limit|max` (RF-4, RF-5, RF-8, RF-47).
- `POST /api/sync/run` → `200 {"ok":true,"calendars":n}`, `401` sin secreto, `500` si falla.

Variables nuevas (en `.env.example`, sin valores): `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (solo servidor, Vercel y `.env.local`) y `CRON_SECRET` en `.env.test.local` con el mismo valor que Vault, para los tests de base de datos.

Permisos pedidos (solo lectura, RF-2): Google `openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly`.

## Flujo principal paso a paso

Caso central: conectar Google, traer un calendario y verlo actualizarse.

1. El usuario pulsa Google en `/dashboard/connections`; la página `new` le explica el aviso de "aplicación no verificada" (RF-48) y sigue a `start` (RF-1, RF-2).
2. `start` guarda `state` y PKCE en la cookie y redirige. El usuario autoriza (RF-3) o cancela (RF-4).
3. `callback` valida `state`, intercambia el código, toma correo y `sub` del `id_token` y llama a `connect_account` (RF-6, RF-8). Redirige a `/dashboard/connections/<id>`.
4. La página pide el token con `sync_get_token`, lista los calendarios de Google (RF-9, RF-12) y el usuario marca dos. `saveSelection` llama a `select_synced_calendars` (RF-10, RF-14) y lanza una primera actualización.
5. `runSync` reclama el calendario, renueva el token, pide `events.list` con `singleEvents=true` en el rango (RF-15, RF-16), normaliza (RF-17, RF-18), limita a 2.000 (RF-19) y llama a `sync_apply_events` (RF-25). La pantalla muestra el resumen (RF-23, RF-26).
6. Cada hora, `pg_cron` llama a `sync_trigger`, que avisa a `/api/sync/run`; este procesa los calendarios con más de 5 horas desde el último intento (RF-22). Un fallo temporal conserva los datos (RF-33).
7. Al desconectar, el diálogo muestra cuántos calendarios hay y con quién se comparten y pide conservar o borrar (RF-27); la acción revoca el token en Google (RF-30) y llama a `disconnect_account` (RF-28, RF-29).

## Decisiones técnicas

- D1: Motor de sincronización en Route Handlers y Server Actions de Next.js. Descartado: Edge Functions de Supabase (otro entorno y otro despliegue) y llamadas HTTP desde plpgsql (la renovación de tokens y la conversión serían SQL difícil de probar). Motivo: TypeScript testeable con el mismo patrón que la importación `.ics`. Cubre: RF-15 a RF-19, RF-22, RF-23.
- D2: La actualización automática la dispara `pg_cron` + `pg_net` hacia `/api/sync/run`. Descartado: el cron de Vercel Hobby, que solo admite una ejecución al día y RF-22 pide 6 horas, y GitHub Actions (otro lugar con secretos). Motivo: ya se usa `pg_cron` y `pg_net` en la spec 006 y no hay nada que añadir. Cubre: RF-22.
- D3: Una ejecución horaria que procesa lo que tiene más de 5 horas desde su último intento. Descartado: un trabajo cada 6 horas exactas, que con retrasos pasaría de 6. Motivo: garantiza como máximo unas 6 horas entre actualizaciones. Cubre: RF-22.
- D4: Secretos de la sincronización en funciones protegidas por `cron_secret` (Vault y Vercel), sin clave `service_role`. Descartado: la clave secreta en la aplicación (P4 y `no-secrets.test.ts` lo prohíben). Motivo: la frontera de seguridad sigue en Postgres. Riesgo: la función depende de un secreto y no de una identidad (R2). Cubre: RF-20, RF-22 a RF-25, RF-31.
- D5: El botón "Actualizar ahora" comprueba la propiedad por RLS y ejecuta el mismo motor con el secreto del servidor. Descartado: un camino de escritura distinto para el usuario. Motivo: un solo código para manual y automático. Cubre: RF-23, RF-24.
- D6: El token de renovación se guarda en Vault, escrito por `connect_account` y leído por funciones de sincronización. Descartado: cifrarlo en la aplicación con una clave propia (otra variable, rotación de clave y más código). Motivo: Vault ya se usa en la 006 y no añade claves. El token nunca está en tablas de `public` ni llega al navegador. Cubre: RF-3, RF-30, requisito de privacidad.
- D7: Cada actualización relee toda la ventana y reconcilia por `external_id`. Descartado: sincronización incremental (`syncToken` de Google), que obliga a guardar estado por calendario y a manejar tokens que caducan (410). Motivo: con un máximo de 2.000 eventos es más simple y correcta. Cubre: RF-15, RF-25.
- D8: Los repetidos los expande el proveedor (`singleEvents=true` en Google). Descartado: reutilizar `ical.js` sobre un `.ics`, que solo existe de forma pública. Motivo: ya respetan excepciones y cancelados y no hay dependencia nueva. Cubre: RF-16.
- D9: Permisos mínimos de solo lectura (apartado "Contratos"). Descartado: `calendar.readonly`, que además permitiría descargar otros datos. Motivo: RF-2. Cubre: RF-2.
- D10: OAuth con código de autorización, PKCE y `state` en cookie `httpOnly`, escrito con `fetch` y `node:crypto`. Descartado: una librería OAuth (P6). Motivo: dos proveedores con flujo estándar. Cubre: RF-1, RF-4, RF-5.
- D11: Solo lectura por política RLS (`is_synced_calendar`) y no por la interfaz. Descartado: ocultar los botones sin política. Motivo: P3, la base de datos decide. Cubre: RF-20.
- D12: Conservar al desconectar es borrar la fila de `synced_calendars`; así el mismo mecanismo sirve cuando el propietario borra su cuenta (cascada). Descartado: una columna "congelado" que habría que mirar en cada política. Motivo: menos estados. Cubre: RF-28, caso límite de la spec 006.
- D13: Los grupos son una tabla por usuario más `group_id` en `calendar_preferences`, que ya es privada por usuario. Descartado: una tabla intermedia calendario-grupo. Motivo: la regla "un calendario, un grupo" (RF-37) queda garantizada por la clave primaria. Cubre: RF-35 a RF-43.
- D14: La visibilidad del grupo no se guarda: ocultar o mostrar un grupo escribe `visible` de cada uno de sus calendarios, y el estado parcial se calcula. Descartado: una columna `hidden` en el grupo, que se contradiría con la visibilidad individual. Motivo: una sola fuente de verdad. Cubre: RF-39, RF-40.
- D15: Los avisos reutilizan `account_notices` con dos tipos nuevos. Descartado: una tabla propia. Motivo: ya sobreviven al cierre de sesión y tienen lectura propia. Cubre: RF-31, RF-34.
- D16: El color del calendario es el de la paleta más cercano al del proveedor, y el nombre y color solo se copian al crear. Descartado: seguir al proveedor en cada actualización, que pisaría los cambios del propietario (casos límite de la spec). Cubre: RF-10, RF-21.
- D17: Límite de 2.000 eventos con los más cercanos a hoy, leyendo como mucho 10.000 del proveedor. Descartado: fallar o traer el principio de la lista. Motivo: RF-19 y que una cuenta enorme no agote los 60 s. Cubre: RF-19.
- D19: Un solo `maxDuration` de 60 s y hasta 4 calendarios en paralelo; lo que no llega se retoma en la siguiente ejecución. Descartado: colas o varias invocaciones encadenadas. Motivo: coste cero y simplicidad. Cubre: RF-22, requisito de rendimiento.

## Trazabilidad RF -> módulo

- RF-1 -> `oauth/start`, `providers/google`, `oauth-state`, `connection-list`, `provider-notice`
- RF-2 -> `providers/google` (permisos), `oauth/start`
- RF-3 -> `oauth/callback`, `connect_account`, `/connections/[id]`
- RF-4 -> `oauth/callback`, `oauth-state`, `error-messages`
- RF-5 -> `oauth/callback`, `error-messages`
- RF-6 -> `calendar_connections` (único), `connect_account`
- RF-7 -> `calendar_connections` (único por usuario)
- RF-8 -> `connect_account`, `limits`
- RF-9 -> `providers/google` (listar), `calendar-picker`
- RF-10 -> `select_synced_calendars`, `nearest-color`, `saveSelection`
- RF-11 -> `detach_synced_calendars`, `calendar-picker`, `disconnect-dialog`
- RF-12 -> `providers/google` (listar en cada visita), `/connections/[id]`
- RF-13 -> `sync_fail` (`missing`), `sync-status`
- RF-14 -> `select_synced_calendars`, `limits`
- RF-15 -> `window`, `providers/google`
- RF-16 -> `providers/google` (expansión), `google-events`
- RF-17 -> `google-events`
- RF-18 -> `google-events`, `summary`
- RF-19 -> `limit-events`, `summary`
- RF-20 -> política de eventos, `is_synced_calendar`, formularios y detalle de evento
- RF-21 -> políticas de `calendars` sin cambios, ficha del calendario
- RF-22 -> `sync_trigger`, `sync_claim_due`, `/api/sync/run`
- RF-23 -> `sync_apply_events` (resumen), `syncNow`, `sync-status`, `summary`
- RF-24 -> `sync_claim_connection`, `sync-now-button`
- RF-25 -> `sync_apply_events`
- RF-26 -> `synced_calendars`, `sync-status`
- RF-27 -> `disconnect-dialog`, `disconnectAccount`
- RF-28 -> `detach_synced_calendars`, `disconnect_account`
- RF-29 -> `detach_synced_calendars`, `disconnect_account`
- RF-30 -> `providers/google` (revocar), `disconnect_account` (borra el token)
- RF-31 -> `sync_fail` (`revoked`), `notice-list`
- RF-32 -> `connect_account` (reemplaza el token), `callback`
- RF-33 -> `sync_fail` (`transient`), `run-sync`
- RF-34 -> `sync_fail` (aviso al 3.er fallo), `notice-list`
- RF-35 -> `calendar_groups`, `createGroup`, `group-form`
- RF-36 -> `assignToGroup`, `organize-groups`, `group-section`
- RF-37 -> clave primaria de `calendar_preferences`, `organize-groups`
- RF-38 -> `saveOrder` ampliada, `calendar_groups.position`
- RF-39 -> `setGroupVisibility`, `group-section`
- RF-40 -> `organize-groups`, `group-section`
- RF-41 -> `renameGroup`, `deleteGroup`, FK `on delete set null`
- RF-42 -> `calendar_groups` (RLS propia), `organize-groups`
- RF-43 -> FK en cascada y trigger de salida de la spec 003
- RF-44 -> bloqueo en `merge_calendars`, formulario de juntar
- RF-45 -> `detach_synced_calendars`, formulario de juntar
- RF-46 -> `organize-groups`, `group-section`, `orphan-calendar-item` (spec 006)
- RF-47 -> `oauth/callback`, `error-messages`. (solo si Google devuelve el rechazo)
- RF-48 -> `provider-notice`, `/connections/new`

## Comprobaciones de la T1 (2026-10-27)

- (d) En dev, con una transacción revertida: una función `SECURITY DEFINER` con `search_path = ''` lee `vault.decrypted_secrets` (devolvió 2 filas); `net.http_post` tiene la firma `url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer`; `pg_cron` 1.6.4 activo con los 3 trabajos de la spec 006; `pg_net` 0.20.4 y `supabase_vault` 0.3.1 instalados.
- (a) Google: proyecto `CaFam` y cliente web con la URI `http://localhost:3000/api/oauth/google/callback` creados **sin pedir tarjeta** (no se activa la prueba de 300 $ del banner). Credenciales en `.env.local`. **Hallazgo:** Google exige URL de página principal y URL de **política de privacidad** para pasar a "En producción" aunque no se verifique, en contra de lo que daba por resuelto la spec. Mientras tanto la app queda en **"Prueba"** con usuarios de prueba (la autorización caduca a los 7 días), suficiente para desarrollar. Antes de la T14 hay que enmendar la spec: propuesta, una página pública `/privacy` en CaFam y la URL de Vercel como página principal (sin comprobar aún que Google acepte un dominio `vercel.app`).
- (b) Microsoft: **bloqueado**. Una cuenta personal (`live.com`) no tiene directorio de Entra (`AADSTS16000`) y crearlo exige una suscripción de Azure con **tarjeta** (P2), salvo Azure for Students o una cuenta de trabajo o universidad. Decisión del usuario (2026-10-27): **seguir solo con Google**; Microsoft queda fuera: spec, plan y tareas enmendados el mismo día (Enmienda 1).
- (a bis) Permisos registrados en la pantalla de consentimiento de Google (Acceso a los datos), añadidos por el usuario el 2026-10-27 para usos futuros: `calendar.calendarlist` (consultar, agregar y quitar calendarios suscritos), `calendar.calendars` (consultar y modificar propiedades de calendarios y crear calendarios secundarios), `calendar.calendars.readonly` (consultar título, descripción, zona horaria y otras propiedades), `calendar.events` (ver y editar eventos) y `calendar.events.readonly` (ver eventos), todos con el prefijo `https://www.googleapis.com/auth/`. Registrarlos **no** los concede: Google solo pide al usuario los que la aplicación incluye en la URL de autorización, y esta spec pide únicamente los de solo lectura del apartado "Contratos" (RF-2). Los de escritura (`calendar.events`, `calendar.calendars`, `calendar.calendarlist`) quedan disponibles para la sincronización bidireccional de una versión futura, con su propia spec.
- (c) `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.local`; las de Microsoft no existen.
- (e) `cron_secret` y `sync_app_url` (`http://localhost:3000`) en Vault de dev y `CRON_SECRET` en `.env.local` y `.env.test.local`: los crea el usuario con un script que no muestra el secreto.

## Pasos de producción (T14, los ejecuta el usuario)

En este orden. Ninguno muestra un secreto en pantalla si se pega desde un gestor de contraseñas; no los escribas en el chat.

1. **Google Cloud** (proyecto `CaFam` → Credenciales → cliente web): añadir la URI de retorno `https://calendario-familia-five.vercel.app/api/oauth/google/callback` sin quitar la de `localhost`. En la pantalla de consentimiento, mientras la app siga en **"Prueba"**, añadir como **usuarios de prueba** las cuentas de Google que se vayan a conectar en la T15 (la autorización caduca a los 7 días). Publicarla exige la enmienda pendiente de la página de privacidad (ver "Comprobaciones de la T1").
2. **Vercel** (Project → Settings → Environment Variables, entorno *Production*): `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (los mismos del cliente web) y comprobar que `CRON_SECRET` ya existe (lo usa el keep-alive desde la spec 001). Ninguna con `NEXT_PUBLIC_`.
3. **Migraciones a prod** (desde la raíz del repo):
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```
   Aplica `sync_schema`, `sync_readonly`, `sync_connect_functions`, `sync_worker_functions` y `calendar_groups`. El último comando vuelve a enlazar dev: no lo saltes.
4. **Vault de prod** (Supabase → `calendario-prod` → SQL Editor), con el **mismo valor** que `CRON_SECRET` de Vercel:
   ```sql
   select vault.create_secret('<valor de CRON_SECRET>', 'cron_secret');
   select vault.create_secret('https://calendario-familia-five.vercel.app', 'sync_app_url');
   ```
   Comprobación sin mostrar el valor: `select name from vault.secrets where name in ('cron_secret', 'sync_app_url');` debe devolver 2 filas.
5. **Desplegar**: integrar la rama en `main` (`git checkout main && git merge --ff-only 007-sincronizacion-oauth && git push origin main`). Vercel despliega solo.
6. **Comprobar** el trabajo programado en prod: `select jobname, schedule from cron.job where jobname = 'sync-run-due';` (cada hora, `0 * * * *`). Tras conectar una cuenta y esperar a la hora en punto, `select status_code from net._http_response order by created desc limit 5;` debe mostrar `200` de `/api/sync/run`.

## Riesgos y mitigaciones

- R1: La primera petición de `pg_net` a Vercel tras un arranque en frío o una ejecución larga se corta -> mitigación: `timeout_milliseconds = 60000`, procesamiento por calendario con `sync_started_at` para no solaparse y reintento en la siguiente hora.
- R2: Las funciones de sincronización dependen de un secreto compartido y no de una sesión -> mitigación: secreto aleatorio de al menos 32 bytes en Vault y Vercel, `42501` si no coincide, funciones sin devolver más que lo necesario y tests que comprueban que sin secreto no se puede leer ni escribir nada.
- R3: Si Google devuelve un token de renovación nuevo y se pierde, se pierde la cuenta -> mitigación: `sync_store_token` se llama antes de usar el token nuevo; si falla, la conexión pasa a `needs_reauth` (RF-31).
- R6: Google limita a 100 usuarios nuevos las aplicaciones sin verificar y a 100 tokens de renovación por cuenta y aplicación -> mitigación: aviso en RF-48 y en la documentación; el uso familiar queda lejos.
- R7: Un calendario muy grande agota los 60 s -> mitigación: tope de 10.000 eventos leídos, paralelismo de 4 y continuación en la ejecución siguiente.
- R9: Quien borra su cuenta de CaFam no revoca el permiso en el proveedor, porque ya no queda token que usar -> mitigación: `delete_own_account` no cambia; el diálogo de borrado de cuenta sugiere desconectar antes las cuentas y se documenta cómo retirarlo desde el proveedor.
- R10: Los textos de los proveedores (título, descripción, lugar) pueden superar los límites de la base de datos -> mitigación: se recortan a 100, 2.000 y 200 caracteres antes de enviarlos, y se rechaza el evento solo si sigue sin ser válido.

## Dudas abiertas

- Resueltas por el usuario (2026-10-23): RF-30 (revocación solo en Google), RF-47 (solo si Google devuelve el rechazo) y la comprobación de coste cero al crear los registros en Google y Microsoft (primera tarea del OAuth, antes de programar). Google: el límite de 7 días del token solo aplica en "Testing".
- La pantalla `/dashboard/connections` enlaza a `/dashboard/import` (spec 004) para quien quiera un calendario `.ics` de una sola vez (iCal); no es un requisito nuevo.
