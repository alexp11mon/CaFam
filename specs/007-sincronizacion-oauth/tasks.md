# Tasks 007 - Sincronización de calendarios externos (Google)

> Estado: **Aprobadas** por el usuario (2026-10-23). **Enmendadas** el 2026-10-27 con la Enmienda 1 de la spec (se quita Microsoft); los números de tarea no cambian. Implementación sin empezar. 15 tareas (límite fijado por el usuario) en tres iteraciones: T1–T5, T6–T11 y T12–T15; no se empieza una sin cerrar la anterior.
> Spec: `specs/007-sincronizacion-oauth/spec.md` (aprobada). Plan: `specs/007-sincronizacion-oauth/plan.md` (aprobado, 2026-10-23).
> Reglas: una tarea cada vez, test primero (rojo → verde). Al cerrar cada tarea se ejecuta y reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, y `npm run test:db -- <filtro>` si toca esquema, RLS o acceso a datos. Si toca interfaz, capturas a 390, 768 y 1440 px con acento rojo y amarillo (P9). Un commit por tarea citándola, en la rama `007-sincronizacion-oauth` (creada desde `main`; el primer commit lleva `spec.md`, `plan.md` y `tasks.md`).
> Sin dependencias nuevas (P6): ninguna tarea toca `package.json`. Los proveedores se llaman con `fetch` y los tests lo sustituyen por un doble.
> Migraciones: solo nuevas en `supabase/migrations/`, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario con `npx supabase db push` tras enlazar prod, y vuelve a enlazar dev.
> Datos de prueba: respuestas sintéticas de los proveedores en `tests/fixtures/sync/` (nunca calendarios reales).
> Como el límite es 15, varias tareas agrupan piezas que van seguidas. Dentro de cada tarea se sigue el orden: primero el test de cada pieza en rojo, después la pieza, y un solo commit al cerrar.

## Tareas

### Iteración 1 — Comprobaciones, base de datos y lógica pura

- [x] T1 Comprobar en dev y en los proveedores lo que el plan da por supuesto (coste cero, Vault, pg_net)
  Pasos (el usuario hace los pasos de las consolas de Google y Microsoft; no se pegan secretos en el chat): (a) crear el proyecto de Google con la pantalla de consentimiento externa, **publicada**, con los permisos del plan y la URI de retorno `http://localhost:3000/api/oauth/google/callback`, comprobando que no pide tarjeta; (b) registrar la aplicación de Microsoft multiusuario (cuentas personales y de trabajo o escuela) con `Calendars.Read` y `offline_access` y la URI equivalente, comprobando que no pide tarjeta; (c) guardar las cuatro credenciales en `.env.local`; (d) en dev, con SQL de prueba: una función `SECURITY DEFINER` con `search_path = ''` lee `vault.decrypted_secrets`, `net.http_post` acepta `timeout_milliseconds` y `pg_cron` está activo; (e) crear en Vault de dev `cron_secret` y `sync_app_url`, y poner el mismo `CRON_SECRET` en `.env.local` y `.env.test.local`. Los resultados se anotan en `plan.md`.
  Resultado (2026-10-27): Google sin tarjeta, en "Prueba" hasta tener política de privacidad; Microsoft bloqueado (exige tarjeta) y el usuario decide seguir solo con Google. Detalle en `plan.md`, "Comprobaciones de la T1". Spec, plan y tareas enmendados (Enmienda 1).
  Hecho cuando: `plan.md` anota la salida de (d) y la confirmación de coste cero de (a) y (b), y `.env.example` lista las variables nuevas sin valores. Si (a) o (b) exigen tarjeta, se detiene la implementación y se vuelve al usuario. Cubre: requisitos de coste cero y de cuentas admitidas | Módulo: comprobación

- [x] T2 Crear el esquema de conexiones y calendarios traídos, con RLS y solo lectura de eventos
  Pasos: test primero en `tests/integration/sync-schema.test.ts` y `tests/integration/sync-readonly.test.ts`. Comprueban que: el propietario lee solo sus `calendar_connections` y nadie las escribe desde un cliente; `calendar_connection_secrets` no es legible por ningún cliente; un miembro lee `synced_calendars` de su calendario pero no el correo de la cuenta; `(owner_id, provider, account_subject)` es único; `events.external_id` es único por calendario cuando no es nulo; borrar la conexión borra `synced_calendars` y deja el calendario; `account_notices` acepta `sync_revoked` y `sync_failing`; en un calendario traído ni el propietario ni un editor pueden insertar, modificar, borrar ni mover un evento, y en uno normal todo sigue igual; `merge_calendars` falla si el origen o el destino es un calendario traído; `list_tables_without_rls()` no devuelve tablas nuevas. Migraciones `sync_schema` (tablas, columna, avisos) y la de `is_synced_calendar`, políticas de eventos y bloqueo de `merge_calendars`.
  Hecho cuando: `npm run test:db -- sync-schema sync-readonly schema rls calendars-events merge-calendars` en verde y `src/types/database.ts` contiene `calendar_connections` y `synced_calendars`. Cubre: RF-6, RF-20, RF-26, RF-44 | Módulo: sync_schema

- [x] T3 Crear las funciones del usuario: conectar, elegir calendarios y desconectar
  Pasos: test primero en `tests/integration/sync-connect.test.ts`. Comprueba que: `connect_account` crea la conexión y guarda el token en Vault (no aparece en ninguna tabla de `public`), no duplica la cuenta del mismo usuario y reemplaza el token, la pone `active` y reinicia fallos, deja que dos usuarios tengan la misma cuenta de forma independiente, falla en la sexta cuenta con `CF429` y sin sesión con `42501`; `select_synced_calendars` crea un calendario propio por elemento nuevo con su nombre y color, no toca los ya traídos, no duplica, falla en el calendario veintiuno con `CF429` y con `CF404` si la conexión es de otro; `detach_synced_calendars` conservando borra la fila de `synced_calendars` y los `external_id` (el calendario queda editable y apto de nuevo para `merge_calendars`) y borrando elimina el calendario con sus eventos y miembros; `disconnect_account` aplica la decisión a todos sus calendarios y borra el secreto de Vault y la conexión; solo el propietario puede y los calendarios no traídos no se tocan.
  Hecho cuando: `npm run test:db -- sync-connect` en verde. Cubre: RF-6, RF-7, RF-8, RF-10, RF-11, RF-14, RF-27, RF-28, RF-29, RF-32, RF-45 | Módulo: sync_connect_functions

- [x] T4 Crear las funciones de sincronización y programar la ejecución horaria
  Pasos: test primero en `tests/integration/sync-worker.test.ts` (usa `CRON_SECRET`). Comprueba que: sin secreto o con uno falso todas las funciones fallan con `42501`; `sync_claim_due` devuelve solo calendarios activos, de conexiones activas, con más de 5 horas desde el último intento y sin ejecución en curso, y los marca; `sync_claim_connection` manual devuelve `too_soon` con `next_at` si la cuenta se actualizó hace menos de 5 minutos y los calendarios si no; `sync_get_token` y `sync_store_token` leen y rotan el token en Vault; `sync_apply_events` inserta en la primera carga, en la segunda modifica, inserta y borra lo que corresponde, devuelve `{added, changed, removed}`, no duplica al repetir y guarda `last_summary`; `sync_fail` `transient` suma un fallo y al tercero crea un aviso `sync_failing` una sola vez, `revoked` pone la conexión en `needs_reauth` y crea `sync_revoked`, `missing` marca `state = 'missing'` sin borrar eventos, y un éxito reinicia los fallos; existe el trabajo `sync-run-due` con `0 * * * *` y `sync_trigger` no hace nada sin pendientes o sin secretos y con ellos encola `net.http_post` con `Authorization` y `timeout_milliseconds = 60000` (modo `p_dry_run`, nunca contra una URL real).
  Hecho cuando: `npm run test:db -- sync-worker` en verde. Cubre: RF-13, RF-22, RF-23, RF-24, RF-25, RF-31, RF-33, RF-34 | Módulo: sync_worker_functions

- [x] T5 Implementar la lógica pura: límites, ventana, tope, color y conversión de eventos de Google y Microsoft
  Pasos: test primero en `tests/unit/sync-core.test.ts`, `tests/unit/google-events.test.ts` y `tests/unit/microsoft-events.test.ts` con fixtures en `tests/fixtures/sync/`. Comprueban: constantes de `limits.ts`; `window.ts` da de 6 meses antes a 12 después de hoy, con fin de mes y año bisiesto; `limit-events.ts` con 2.500 eventos deja los 2.000 más cercanos a hoy y devuelve 500 omitidos; `nearest-color.ts` devuelve siempre un color de la paleta; ambos conversores dan evento con hora (instante UTC), de día completo (fin exclusivo, convención de la spec 002), varios días, sin título, descripción y lugar recortados a 2.000 y 200, cancelado omitido, fin anterior al inicio omitido y contado, repeticiones con `external_id` propio, y en Microsoft un día completo pedido con `Prefer: outlook.timezone="UTC"` queda de 00:00 UTC a 00:00 UTC del día siguiente (R8).
  Enmienda 1 (2026-10-27): el conversor de Microsoft, su test y su fixture se retiran.
  Hecho cuando: `npm test -- sync-core google-events microsoft-events` en verde. Cubre: RF-8, RF-10, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19 | Módulo: limits, window, limit-events, nearest-color, google-events, microsoft-events

### Iteración 2 — Proveedores, motor y pantallas

- [x] T6 Implementar el cliente de Google
  Pasos: test primero en `tests/unit/provider-google.test.ts` con `fetch` simulado. Comprueba: la URL de autorización lleva exactamente los permisos de solo lectura del plan, `state`, PKCE (`S256`) y `access_type=offline`; el intercambio del código y la renovación devuelven el token y el correo y `sub` del `id_token` (y el token de renovación nuevo si Google lo envía); el listado de calendarios y de eventos usa el rango de T5 con paginación y tope de 10.000 (`singleEvents=true`); `invalid_grant` → `revoked`, 404 → `missing`, 429 y 5xx → `transient`; la revocación llama al punto de revocación de Google.
  Hecho cuando: `npm test -- provider-google` en verde. Cubre: RF-1, RF-2, RF-9, RF-12, RF-15, RF-16, RF-30 | Módulo: providers/google

- [ ] T7 Implementar las rutas de inicio y de retorno del OAuth
  Pasos: test primero en `tests/unit/oauth-routes.test.ts` (`// @vitest-environment node`). Comprueba: `start` sin sesión redirige a `/login`, con sesión redirige al proveedor y guarda `state` y PKCE en una cookie `httpOnly`, `secure`, `sameSite=lax` de 10 minutos; `callback` con `state` distinto o sin cookie no conecta; con `error=access_denied` vuelve a `/dashboard/connections?error=cancelled` (con el texto que menciona la posible falta de plazas, RF-47); un fallo del proveedor vuelve con `error=failed`; el sexto intento con `CF429` vuelve con `error=max`; una cuenta repetida vuelve a su pantalla sin duplicar y restaura la conexión caducada; éxito llama a `connect_account` y redirige a `/dashboard/connections/<id>`.
  Hecho cuando: `npm test -- oauth-routes` en verde. Cubre: RF-1, RF-3, RF-4, RF-5, RF-32, RF-47 | Módulo: oauth/start, oauth/callback, oauth-state

- [ ] T8 Implementar el motor de actualización y su endpoint `POST /api/sync/run`
  Pasos: test primero en `tests/unit/run-sync.test.ts` y `tests/unit/sync-run-route.test.ts` (`// @vitest-environment node`, doble de proveedores y de `@supabase/supabase-js`). Comprueban: una actualización completa hace reclamar → renovar → leer → convertir → limitar → aplicar; guarda el token rotado antes de seguir; el resumen incluye añadidos, cambiados, quitados, omitidos y los omitidos por el tope; `revoked`, `missing` y `transient` llaman a `sync_fail` con el tipo correcto y conservan los datos; con 10 calendarios no pasa de 4 en paralelo y se detiene al agotar los 50 s dejando el resto sin marcar; el endpoint devuelve `401` sin secreto o con otro, `200 {"ok":true,"calendars":n}` con el secreto, `500` ante un fallo no controlado, y `maxDuration` es 60; mensajes de `error-messages.ts` y `summary.ts` en español.
  Hecho cuando: `npm test -- run-sync sync-run-route` en verde. Cubre: RF-13, RF-18, RF-19, RF-22, RF-23, RF-25, RF-31, RF-33 | Módulo: run-sync, error-messages, summary, /api/sync/run

- [ ] T9 Crear las pantallas de cuentas: lista, aviso previo, elegir calendarios y actualizar ahora
  Pasos: test primero en `tests/unit/connection-list.test.tsx`, `tests/unit/connection-page.test.tsx` y `tests/unit/connection-actions.test.ts`. Comprueban: la lista muestra proveedor, correo y estado de cada cuenta; los botones llevan a `/dashboard/connections/new?provider=…`, que explica por qué Google mostrará "aplicación no verificada" antes de seguir a `start`; los códigos `cancelled`, `failed`, `max` y `limit` de la vuelta muestran su mensaje en español; hay enlace a `/dashboard/import` y la sección aparece en "Más" y en "Mis calendarios"; la pantalla de la cuenta lista los calendarios (incluidos los nuevos) con casillas, los ya traídos marcados, el límite de 20 deshabilita el resto con su explicación, guardar valida con `zod`, desmarcar pide confirmación; "Actualizar ahora" muestra el resumen o la hora de espera si es `too_soon`; se ven estado, última actualización correcta y "ya no existe en la cuenta"; las acciones llaman a `revalidatePath("/dashboard", "layout")`.
  Hecho cuando: `npm test -- connection-list connection-page connection-actions design-tokens` en verde y capturas a 390, 768 y 1440 px revisadas. Cubre: RF-1, RF-3, RF-4, RF-5, RF-8, RF-9, RF-10, RF-11, RF-12, RF-13, RF-14, RF-23, RF-24, RF-26, RF-47, RF-48 | Módulo: /dashboard/connections, connection-list, provider-notice, calendar-picker, sync-status, sync-now-button, schemas

- [ ] T10 Implementar la desconexión y los avisos de revocación y de fallos repetidos
  Pasos: test primero en `tests/unit/disconnect-dialog.test.tsx`, `tests/unit/connection-actions.test.ts` y `tests/unit/notice-list.test.tsx` (ampliar los existentes). Comprueban: el diálogo cuenta los calendarios, nombra los compartidos y con cuántas personas y ofrece Conservar o Borrar sin opción marcada; la acción revoca el token en Google antes de llamar a `disconnect_account` y desconecta igualmente si la revocación falla; sin sesión o de otro usuario no hace nada; los avisos `sync_revoked` y `sync_failing` se muestran con la cuenta o el calendario, una acción "Volver a conectar" y se pueden descartar.
  Hecho cuando: `npm test -- disconnect-dialog connection-actions notice-list design-tokens` en verde y capturas revisadas. Cubre: RF-27, RF-28, RF-29, RF-30, RF-31, RF-34 | Módulo: disconnect-dialog, disconnectAccount, notice-list

- [ ] T11 Aplicar el solo lectura y el origen en la interfaz existente
  Pasos: test primero en `tests/unit/synced-calendar-ui.test.tsx`. Comprueba: los formularios de evento no ofrecen calendarios traídos como destino; el detalle de un evento traído no muestra Editar ni Borrar y lo explica; el formulario de juntar los excluye y vuelve a ofrecer el calendario conservado; la ficha del calendario muestra la última actualización a todos los miembros y la cuenta de origen solo al propietario, que sí puede cambiar nombre, descripción, color y compartir.
  Hecho cuando: `npm test -- synced-calendar-ui` en verde y capturas a 390, 768 y 1440 px revisadas. Cubre: RF-20, RF-21, RF-26, RF-44, RF-45 | Módulo: event-form, event-detail, merge-form, calendar ficha

### Iteración 3 — Grupos, producción y cierre

- [ ] T12 Crear los grupos de calendarios: esquema y organización
  Pasos: test primero en `tests/integration/calendar-groups.test.ts` y `tests/unit/organize-groups.test.ts`. Comprueban: un usuario crea, lee, renombra y borra solo sus grupos (RLS); nombre de 1 a 40 caracteres y sin duplicados ignorando mayúsculas y espacios exteriores; asignar un calendario a un grupo ajeno falla por la clave compuesta; un calendario tiene un solo grupo; borrar el grupo deja los calendarios sin grupo y sin borrarlos; el trigger de salida y el borrado del calendario limpian la asignación; se puede agrupar un calendario compartido y uno sin propietario; `organize-groups` devuelve primero los grupos del usuario con sus calendarios en su orden y después el agrupado por persona de los que no tienen grupo, sin repetir ninguno, con el estado mostrado, oculto o parcial de cada grupo y la marca "Sin propietario". Migración `calendar_groups`.
  Hecho cuando: `npm run test:db -- calendar-groups preferences rls` y `npm test -- organize-groups grouping` en verde y `src/types/database.ts` contiene `calendar_groups` y `group_id`. Cubre: RF-35, RF-36, RF-37, RF-40, RF-41, RF-42, RF-43, RF-46 | Módulo: calendar_groups, organize-groups

- [ ] T13 Implementar las acciones de grupos y mostrarlos en "Mis calendarios" y en los filtros
  Pasos: test primero en `tests/unit/group-actions.test.ts` y `tests/unit/group-section.test.tsx`. Comprueban: crear, renombrar, borrar y asignar validan con `zod`, traducen los errores (nombre repetido, grupo ajeno) y llaman a `revalidatePath`; `setGroupVisibility` escribe `visible` en todos los calendarios del grupo leídos de la base de datos; `saveOrder` guarda el orden de grupos y de calendarios dentro de cada uno sin tocar la visibilidad; cada grupo se pinta con cabecera, interruptor con estado parcial anunciado a lectores de pantalla y sus calendarios; crear, renombrar, borrar, mover y reordenar funciona solo con teclado; el calendario sin propietario conserva su aviso y plazo con la etiqueta "Sin propietario" dentro del grupo; los filtros del calendario usan los mismos grupos.
  Hecho cuando: `npm test -- group-actions group-section design-tokens` y `npm run test:db -- preferences calendar-groups` en verde y capturas a 390, 768 y 1440 px con acento rojo y amarillo revisadas. Cubre: RF-35, RF-36, RF-38, RF-39, RF-40, RF-41, RF-46 | Módulo: group-actions, group-section, group-form, assign-group-select

- [ ] T14 Vigilar los secretos, comprobar el alcance y preparar la producción
  Pasos: test primero en `tests/unit/no-secrets.test.ts` (ampliar): `src/` no contiene `NEXT_PUBLIC_` junto a `GOOGLE_CLIENT_SECRET` o `CRON_SECRET`, ni importa esas variables desde código de cliente, y ningún token de renovación aparece en `src/` fuera de los clientes de proveedor. Revisar el diff contra "Fuera de alcance" de la spec. Actualizar `.env.example` y los apartados de entornos de `AGENTS.md`. Dejar en `plan.md` los comandos exactos para producción, que ejecuta el usuario: URI de retorno `https://calendario-familia-five.vercel.app/api/oauth/google/callback` en Google, las tres variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `CRON_SECRET`) en Vercel, `cron_secret` y `sync_app_url` en Vault de prod con el mismo valor que `CRON_SECRET`, y `npx supabase link --project-ref yznbdoskvtxeasujtirk`, `npx supabase db push` y volver a enlazar dev.
  Hecho cuando: `npm test -- no-secrets` en verde; una lista confirma que no hay escritura al proveedor, inicio de sesión social, tiempo real, notificaciones, recurrentes propios ni CalDAV, y que `package.json` no cambia respecto a `main`; y `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run test:db` están en verde. Cubre: requisitos de seguridad, coste cero y Fuera de alcance | Módulo: seguridad, documentación y despliegue

- [ ] T15 Validar RF por RF en producción con cuentas reales
  Pasos: el usuario confirma que ejecutó los pasos de producción de T14. Checklist RF-1 a RF-48 con el test que cubre cada uno (tabla del final) y demo manual del usuario: conectar Google, elegir dos calendarios, ver sus eventos, cambiar un evento en Google y traerlo con "Actualizar ahora", comprobar la espera de 5 minutos, compartir uno con otra persona, desconectar conservando uno y borrando otro; crear un grupo, meter calendarios, reordenar, ocultar y mostrar; comprobar que la ejecución horaria llega a `/api/sync/run`. Revisar `AGENTS.md` y `docs/constitution.md` y actualizarlos.
  Hecho cuando: la checklist está completa con la salida de cada comprobación anotada, el usuario confirma la demo y aprueba cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T6, T7, T9
- RF-2 -> T6
- RF-3 -> T7, T9
- RF-4 -> T7, T9
- RF-5 -> T7, T9
- RF-6 -> T2, T3
- RF-7 -> T3
- RF-8 -> T3, T5, T9
- RF-9 -> T6, T9
- RF-10 -> T3, T5, T9
- RF-11 -> T3, T9
- RF-12 -> T6, T9
- RF-13 -> T4, T8, T9
- RF-14 -> T3, T5, T9
- RF-15 -> T5, T6
- RF-16 -> T5, T6
- RF-17 -> T5
- RF-18 -> T5, T8
- RF-19 -> T5, T8
- RF-20 -> T2, T11
- RF-21 -> T11
- RF-22 -> T4, T8
- RF-23 -> T4, T8, T9
- RF-24 -> T4, T9
- RF-25 -> T4, T8
- RF-26 -> T2, T9, T11
- RF-27 -> T3, T10
- RF-28 -> T3, T10
- RF-29 -> T3, T10
- RF-30 -> T6, T10
- RF-31 -> T4, T8, T10
- RF-32 -> T3, T7
- RF-33 -> T4, T8
- RF-34 -> T4, T10
- RF-35 -> T12, T13
- RF-36 -> T12, T13
- RF-37 -> T12
- RF-38 -> T13
- RF-39 -> T13
- RF-40 -> T12, T13
- RF-41 -> T12, T13
- RF-42 -> T12
- RF-43 -> T12
- RF-44 -> T2, T11
- RF-45 -> T3, T11
- RF-46 -> T12, T13
- RF-47 -> T7, T9
- RF-48 -> T9

## Dudas abiertas

- Ninguna que bloquee: las del plan están resueltas por el usuario (2026-10-23). T1 detuvo Microsoft porque exige tarjeta (P2) y el usuario lo quitó (Enmienda 1, 2026-10-27).
- Pendiente antes de la T14: Google exige URL de página principal y de política de privacidad para publicar la aplicación (hallazgo de la T1). Hace falta otra enmienda de la spec.
