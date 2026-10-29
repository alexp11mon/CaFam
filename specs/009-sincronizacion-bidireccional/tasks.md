# Tasks 009 - Sincronización bidireccional con Google

> Estado: **Aprobadas** por el usuario (2026-10-29). Plan aprobado el 2026-10-29.
> Spec: `specs/009-sincronizacion-bidireccional/spec.md` (aprobada, 2026-10-28). Plan: `specs/009-sincronizacion-bidireccional/plan.md` (aprobado, 2026-10-29).
> 14 tareas en tres iteraciones: T1–T5, T6–T10 y T11–T14. No se empieza una iteración sin cerrar la anterior.
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si toca esquema, RLS o acceso a datos, también `npm run test:db -- <filtro>`.
> - Si toca interfaz: capturas a 390, 768 y 1440 px con el acento rojo y el amarillo (P9).
> - Un commit por tarea, citándola, en la rama `009-sincronizacion-bidireccional`. El primer commit lleva `plan.md` y `tasks.md`.
>
> Sin dependencias nuevas (P6): ninguna tarea toca `package.json`. Google se llama con `fetch` y los tests lo sustituyen por un doble con respuestas sintéticas en `tests/fixtures/sync/`, nunca calendarios reales.
> Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario (plan, "Pasos de producción").
> Dentro de cada tarea: primero el test de cada pieza en rojo, después la pieza, y un solo commit al cerrar.

## Tareas

### Iteración 1 — Comprobaciones, base de datos y lógica pura

- [x] T1 Comprobar lo que el plan da por supuesto (duración de la subida, publicar la app y comportamiento de Google)
  Pasos: (a) a (d) de "Comprobaciones de la T1" del plan. El usuario hace lo de la consola de Google y conecta una cuenta de prueba en dev (no se pegan secretos en el chat). El agente consulta la documentación de Vercel y hace las llamadas a mano en dev con un script del scratchpad que no muestra el token. Los resultados se anotan en `plan.md`.
  Hecho cuando: `plan.md` anota el `maxDuration` de Hobby y lo que pide Google para publicar. También anota la respuesta de Google a cinco cosas: `accessRole`, `PATCH` de una repetición, `move` de una repetición, 404 de un evento borrado y `scope` del token. Si la subida no cabe (D14) o publicar exige pagar o verificar, se detiene y se vuelve al usuario. Cubre: RF-17, RF-35, RF-41, requisito de coste cero | Módulo: comprobación
  Evidencia (2026-10-29): resultados en "Resultado de la T1" del plan. 300 s en Hobby; publicar pide nombre, correo de asistencia, página principal y política, sin pagar ni verificar; prueba en vivo en dev correcta.

- [x] T2 Crear el esquema de escritura: permiso de la cuenta, permiso por calendario y nombre protegido
  Pasos: test primero en `tests/integration/sync-write-schema.test.ts`. Comprueba:
  - Una conexión creada como en la 007 tiene `can_write = false`, y `connect_account` con `p_can_write` la pone a `true` sin duplicar ni tocar sus calendarios traídos.
  - `select_synced_calendars` guarda `google_access`.
  - El campo calculado `can_write` es verdadero solo con conexión `active`, `can_write`, calendario `active` y `owner` o `writer`, y lo lee un Editor sin ver la conexión.
  - El propietario no puede cambiar el nombre de un calendario traído con un `update` directo, pero sí el color y la descripción, y en uno normal todo sigue igual.
  - `list_tables_without_rls()` sigue vacía.

  Migración `sync_write_schema`.
  Hecho cuando: `npm run test:db -- sync-write-schema sync-connect sync-schema` en verde y `src/types/database.ts` contiene `can_write` y `google_access`. Cubre: RF-2, RF-4, RF-5, RF-8, RF-29 | Módulo: sync_write_schema

- [x] T3 Crear las funciones de escritura con sesión y secreto
  Pasos: test primero en `tests/integration/sync-write.test.ts`, que usa `CRON_SECRET`. Comprueba:
  - Sin sesión o con un secreto falso, todas fallan con `42501`.
  - `sync_write_context` devuelve `{synced:false}` entre calendarios normales y los ids de Google al propietario y a un Editor. Falla con un Lector, con una cuenta sin `can_write`, en `needs_reauth` o con `google_access = 'reader'`. Mezclar un calendario normal con uno traído, o dos conexiones, da `22023`. Un evento de otro calendario da `CF404`.
  - `sync_commit_event`:
    - `insert` crea con `created_by` del Editor y no duplica si ya existe el `external_id`.
    - `update` cambia los campos, el color, la categoría y el calendario dentro de la misma conexión.
    - `delete` y `gone` borran.
    - Repite las comprobaciones de rol.
  - `sync_update_calendar` cambia el nombre solo para el propietario.
  - `sync_attach_created` crea un calendario traído `owner`, y el número 21 da `CF429`.
  - `sync_attach_uploaded`:
    - Convierte un calendario propio y normal, con sus miembros, categorías y colores intactos, y fija los `external_id` del mapa.
    - Rechaza uno sin propietario, uno ya traído, uno ajeno o una conexión ajena, y el número 21.
  - Un `insert` o `update` directo con RLS sobre un calendario traído sigue fallando.

  Migración `sync_write_functions`.
  Hecho cuando: `npm run test:db -- sync-write sync-readonly` en verde. Cubre: RF-6, RF-7, RF-10, RF-11, RF-12, RF-16, RF-19, RF-20, RF-25, RF-29, RF-31, RF-32, RF-33, RF-34, RF-36, RF-38 | Módulo: sync_write_functions

- [x] T4 Hacer que la actualización horaria respete el último cambio y los eventos solo de CaFam
  Pasos: test primero, ampliando `tests/integration/sync-worker.test.ts`. Comprueba:
  - Con `p_read_at` anterior al `updated_at` de un evento cambiado en CaFam, `sync_apply_events` no lo modifica ni lo borra. Con `p_read_at` posterior, aplica lo de Google.
  - Un evento recién creado con `sync_commit_event` no se borra aunque no llegue en esa lectura.
  - Los eventos con `external_id` nulo no se borran.
  - Nunca cambia `color` ni `category_id`.
  - Guarda `google_access` de `p_access`.
  - Las llamadas con los argumentos de la 007 siguen funcionando.

  Después, `run-sync.ts` pasa `p_read_at` (la hora antes de leer) y `p_access`, con su test en `tests/unit/run-sync.test.ts`. Migración `sync_apply_events_v2`.
  Hecho cuando: `npm run test:db -- sync-worker` y `npm test -- run-sync` en verde. Cubre: RF-8, RF-16, RF-27, RF-28, RF-42 | Módulo: sync_apply_events_v2, run-sync

- [x] T5 Implementar la lógica pura: permisos, cuerpos para Google, errores, destinos y plan de subida
  Pasos: test primero en `tests/unit/sync-write-core.test.ts`. Comprueba:
  - `missingScopes` detecta cada permiso que falta.
  - `toGoogleEvent`: un evento con hora va en `dateTime` UTC; uno de día completo y uno de varios días van en `date` con fin exclusivo; nunca lleva color ni categoría.
  - `toGooglePatch`:
    - Sin cambios devuelve un objeto vacío.
    - Si solo cambia el título, manda solo el título (la descripción recortada no se toca).
    - Al cambiar entre día completo y con hora, manda inicio y fin.
  - `write-errors`: un texto en español por tipo, sin el mensaje de Google.
  - `canWriteEvents`, `moveTargets` y `readOnlyReason` en todos los casos de RF-6 a RF-9 y RF-20.
  - `upload-plan` con eventos dentro y fuera de la ventana y con más de 2.000 da los dos números de RF-43.

  Hecho cuando: `npm test -- sync-write-core read-only` en verde. Cubre: RF-1, RF-5, RF-6, RF-7, RF-8, RF-9, RF-13, RF-14, RF-15, RF-20, RF-22, RF-23, RF-24, RF-25, RF-26, RF-35, RF-42, RF-43 | Módulo: scopes, google-payload, write-errors, read-only, upload-plan

### Iteración 2 — Google, motor de escritura y eventos

- [x] T6 Ampliar el cliente de Google con la escritura
  Pasos: test primero, ampliando `tests/unit/provider-google.test.ts` con `fetch` simulado. Comprueba:
  - La URL de autorización lleva exactamente los permisos de D1.
  - `exchangeCode` devuelve `scope`.
  - `listCalendars` y `listEvents` devuelven `accessRole`.
  - `insertEvent`, `patchEvent`, `moveEvent`, `deleteEvent`, `insertCalendar`, `patchCalendar` (solo `summary`) y `deleteCalendar` usan el método, la URL y el cuerpo correctos, sin `If-Match`.
  - Clasificación de errores: 401 e `invalid_grant` → `revoked`; 404 y 410 → `missing`; 403 o 429 por límite de uso → `transient`; el resto de 403 y 400 → `rejected`; 5xx y sin respuesta → `transient`.

  Hecho cuando: `npm test -- provider-google` en verde. Cubre: RF-1, RF-8, RF-10, RF-11, RF-12, RF-13, RF-15, RF-17, RF-19, RF-22, RF-23, RF-24, RF-29, RF-31, RF-32, RF-34 | Módulo: providers/google

- [x] T7 Implementar el motor de escritura de eventos
  Pasos: test primero en `tests/unit/write-event.test.ts`, con dependencias inyectadas como en `run-sync`. Comprueba:
  - Crear, cambiar y borrar llaman primero a Google y después a `sync_commit_event`; si Google falla, no se llama a `sync_commit_event` (RF-21).
  - Cambiar y mover hace `PATCH` y luego `move` (D7).
  - Un 404 o 410 llama a `sync_commit_event('gone')` y devuelve `gone`.
  - `revoked` llama a `sync_fail('revoked')`.
  - Superar el plazo común de 9 s da `transient`.
  - Un evento sin `external_id` se escribe solo en CaFam (D9).
  - Un token renovado se guarda antes de usarlo.

  `engine.ts` añade `writeEngineDeps()` con el cliente de la sesión del usuario.
  Hecho cuando: `npm test -- write-event` en verde. Cubre: RF-10, RF-11, RF-12, RF-14, RF-17, RF-19, RF-21, RF-22, RF-23, RF-24, RF-25, RF-27, requisito de tiempo de respuesta | Módulo: write-event, engine

- [x] T8 Escribir eventos en calendarios traídos desde las acciones y la interfaz
  Pasos: test primero, ampliando los tests de las acciones de evento y de `event-form`, `quick-create` y el detalle. Comprueba:
  - `createEvent`, `updateEvent` y `deleteEvent` usan el motor cuando el origen o el destino es traído y el camino de siempre si no.
  - Un error devuelve `formError` en español y `values`.
  - `done: "gone"` muestra "Este evento se había borrado en Google".
  - Los avisos de RF-18 son los de siempre.
  - Los calendarios traídos con escritura aparecen como destino al crear, duplicar, en la ventana rápida y al arrastrar.
  - Al editar, el selector solo ofrece `moveTargets`.
  - El detalle muestra Editar, Duplicar y Borrar según `canWriteEvents` y, si no se puede escribir, el motivo.

  `getMyCalendars`/`getCalendar` leen `can_write`, `connection_id` y `google_access`.
  Hecho cuando: `npm test -- event-actions event-form quick-create event-panel` en verde, capturas de P9 del detalle y del formulario de un evento traído, y prueba manual en dev con una cuenta de prueba: crear, cambiar, mover y borrar se ven en Google. Cubre: RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-12, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26 | Módulo: events/actions, load-event, load-new-event, calendar/page, event-form, event-panel, queries

- [x] T9 Pedir los permisos nuevos y avisar de las cuentas de solo lectura
  Pasos: test primero, ampliando `tests/unit/oauth-routes.test.ts` y con `tests/unit/reconnect-notice.test.tsx`. Comprueba:
  - `callback` llama a `connect_account` con `p_can_write` verdadero solo con todos los permisos de D1. Si falta alguno, redirige a `/dashboard/connections/<id>?scope=missing`.
  - El aviso aparece al propietario en "Mis calendarios" y en la ficha, para cuentas con `can_write = false`, con "Volver a conectar". Con `?scope=missing` nombra el permiso que falta.
  - La ficha marca "Solo lectura en Google" en los calendarios con `google_access = 'reader'`.

  Hecho cuando: `npm test -- oauth-routes reconnect-notice connection-page` en verde, capturas de P9 de "Mis calendarios" y de la ficha con el aviso, y prueba manual en dev: volver a conectar una cuenta de la 007 conserva sus calendarios y permite escribir. Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-8 | Módulo: oauth/callback, reconnect-notice, ficha de la cuenta, calendar-list

- [x] T10 Renombrar calendarios traídos y crear calendarios en Google
  Pasos: test primero, ampliando los tests de `calendars/actions` y `connections/actions` y el de la ficha de la cuenta. Comprueba:
  - `updateCalendar` sobre un calendario traído con el nombre cambiado llama a `patchCalendar` y después a `sync_update_calendar`. Si Google falla, no cambia nada y muestra el mensaje de RF-22 a RF-24. Sin cambio de nombre, el color y la descripción no van a Google.
  - `createGoogleCalendar` valida el nombre, falla antes de llamar a Google si ya hay 20, crea el calendario y lo trae, y si `sync_attach_created` falla borra el creado en Google.

  Hecho cuando: `npm test -- calendar-actions connection-actions connection-page` en verde, capturas de P9 del formulario nuevo, y prueba manual en dev: el nombre nuevo y el calendario creado se ven en Google. Cubre: RF-29, RF-30, RF-31, RF-32, RF-33 | Módulo: calendars/actions, connections/actions, ficha de la cuenta

### Iteración 3 — Subir calendarios, privacidad y cierre

- [x] T11 Subir un calendario de CaFam a Google
  Pasos: test primero en `tests/unit/upload-calendar.test.ts` (motor con dependencias inyectadas) y `tests/unit/upload-page.test.tsx`. Comprueba:
  - El motor crea el calendario y copia solo los eventos del plan de subida, de cuatro en cuatro y con reintento ante el límite de uso. Si cualquier fallo ocurre, borra el calendario de Google y no llama a `sync_attach_uploaded`.
  - La página muestra los dos números de RF-43 y solo deja elegir cuentas propias con escritura.
  - La página da 404 a quien no es propietario, y también para un calendario sin propietario o ya traído.
  - El enlace "Subir a Google" sale solo cuando se cumple RF-38.

  `maxDuration` según la T1.
  Hecho cuando: `npm test -- upload-calendar upload-page calendar-list` en verde, capturas de P9 de `/upload`, y prueba manual en dev: el calendario subido se ve en Google con sus eventos del rango, los de fuera siguen en CaFam y la siguiente actualización no duplica ni borra nada. Cubre: RF-33, RF-34, RF-35, RF-36, RF-37, RF-38, RF-42, RF-43 | Módulo: upload-calendar, calendars/[id]/upload, calendar-list

- [x] T12 Publicar la política de privacidad y enlazarla
  Pasos: test primero en `tests/unit/privacy-page.test.tsx` y ampliando `route-access.test.ts`. Comprueba:
  - `/privacy` se abre sin sesión.
  - La página explica en español qué datos de Google se leen y se escriben, para qué, dónde se guardan, con quién se comparten, y cómo retirar el permiso y borrar los datos.
  - La portada y `provider-notice` la enlazan.
  - `provider-notice` ya no dice que la app está en "Prueba", y explica el aviso de "aplicación no verificada" y el permiso de escritura (R7).

  Hecho cuando: `npm test -- privacy-page route-access provider-notice home-page` en verde y capturas de P9 de `/privacy` y del aviso previo. Cubre: RF-39, RF-40, RF-41 | Módulo: privacy, route-access, portada, provider-notice
  Evidencia (2026-10-29): `privacy-page`, `connection-list` y `route-access` en verde; P8 completa en verde; capturas de `/privacy` a 390, 768 y 1440 px sin sesión (acento rojo). Falta la captura del aviso previo con sesión, junto con las de T8–T11.

- [x] T13 Vigilar secretos, revisar el alcance y preparar producción
  Pasos:
  - `no-secrets` sigue en verde, y un test nuevo asegura que ningún componente de cliente importa `write-event`, `engine` ni `providers/google`.
  - Revisar el diff de la rama: ningún token llega al navegador.
  - Checklist de "Fuera de alcance" de la spec contra el código: no se borran calendarios en Google salvo la compensación de D14 y D15, no hay series, invitados, cola de cambios ni envío de color o descripción.
  - Actualizar los pasos de producción del plan si la T1 cambió algo, y `AGENTS.md` (estado, rutas, funciones y trampas nuevas).

  Hecho cuando: verificación completa de P8 (incluido `npm run test:db`) en verde, con la salida reportada, y checklist de "Fuera de alcance" anotado en este archivo. Cubre: requisito de privacidad y seguridad, Fuera de alcance | Módulo: validación
  Evidencia (2026-10-29): typecheck, lint, format:check, `npm test` (145 archivos, 1.278 tests) y build en verde; `npm run test:db -- --no-file-parallelism` 33 archivos, 323 tests en verde.
  Checklist de "Fuera de alcance" (2026-10-29, revisado contra el código):
  - [x] Borrar calendarios en Google: `deleteCalendar` solo se llama en la compensación de `upload-calendar.ts` (D14) y de `write-calendar.ts` (D15). Desmarcar y desconectar no llaman a Google salvo para revocar el permiso.
  - [x] Mover entre cuentas o entre traído y normal: `moveTargets` solo ofrece calendarios de la misma conexión, y `sync_write_context` da `22023` si se mezclan.
  - [x] Color y descripción del calendario, color y categoría del evento: `google-payload.ts` solo envía título, descripción, lugar y horas del evento; `insertCalendar` y `patchCalendar` solo `summary` (y la zona horaria al crear).
  - [x] Series: no se envía `recurrence`; las repeticiones se tocan una a una por su id.
  - [x] Invitados, recordatorios, videollamadas y adjuntos: no se envían, y el `PATCH` solo lleva lo que cambió, así que Google los conserva.
  - [x] Cola de cambios: no existe; si Google rechaza, no se guarda en CaFam (`writeEvent`).
  - [x] Juntar calendarios traídos: sigue bloqueado (`canMerge` y `merge_calendars`).
  - [x] Sin servicios de pago, Microsoft ni otros proveedores; sin dependencias nuevas.
  - [x] Elegir por cuenta si escribe: no hay opción; `can_write` sale de los permisos concedidos.
  - [x] Secretos: `no-secrets` en verde, con un test nuevo que impide importar el motor de escritura desde un componente de cliente. Ningún token sale de `providers/google.ts`, el callback y el motor.

- [ ] T14 Validar en producción, publicar la aplicación de Google y cerrar
  Pasos (el usuario ejecuta los pasos de producción del plan; el agente le prepara los comandos exactos):
  - Migraciones, despliegue, publicar la aplicación y volver a conectar las cuentas.
  - Demo de los criterios de finalización de la spec con una cuenta real:
    - Una cuenta fuera de la lista de pruebas conecta.
    - Crear, cambiar, mover y borrar eventos, y cambiar una repetición.
    - Un Editor cambia un evento.
    - Renombrar un calendario, crear otro en Google y subir uno de CaFam.
    - Un cambio rechazado que no se guarda.
  - Tabla de trazabilidad de abajo con la evidencia de cada RF.

  Hecho cuando: los criterios de finalización de la spec quedan marcados con su evidencia y el usuario aprueba cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T5, T6, T9
- RF-2 -> T2, T9
- RF-3 -> T9
- RF-4 -> T2, T9
- RF-5 -> T2, T5, T9
- RF-6 -> T3, T5, T8
- RF-7 -> T3, T5, T8
- RF-8 -> T2, T4, T5, T6, T8, T9
- RF-9 -> T5, T8
- RF-10 -> T3, T6, T7, T8
- RF-11 -> T3, T6, T7, T8
- RF-12 -> T3, T6, T7, T8
- RF-13 -> T5, T6
- RF-14 -> T5, T7
- RF-15 -> T5, T6
- RF-16 -> T3, T4
- RF-17 -> T1, T6, T7
- RF-18 -> T8
- RF-19 -> T3, T6, T7, T8
- RF-20 -> T3, T5, T8
- RF-21 -> T7, T8
- RF-22 -> T5, T6, T7, T8
- RF-23 -> T5, T6, T7, T8
- RF-24 -> T5, T6, T7, T8
- RF-25 -> T3, T5, T7, T8
- RF-26 -> T5, T8
- RF-27 -> T4, T7
- RF-28 -> T4
- RF-29 -> T2, T3, T6, T10
- RF-30 -> T10
- RF-31 -> T3, T6, T10
- RF-32 -> T3, T6, T10
- RF-33 -> T3, T10, T11
- RF-34 -> T3, T6, T11
- RF-35 -> T1, T5, T11
- RF-36 -> T3, T11
- RF-37 -> T11
- RF-38 -> T3, T11
- RF-39 -> T12
- RF-40 -> T12
- RF-41 -> T1, T12, T14
- RF-42 -> T4, T5, T11
- RF-43 -> T5, T11

## Evidencia de cierre (2026-10-29)

Criterios de finalización de la spec:

- [x] Todos los RF con test en verde y P8 completa: typecheck, lint, format:check, `npm test` (145 archivos, 1.279 tests), build y `npm run test:db -- --no-file-parallelism` (33 archivos, 323 tests). Tests por tarea:
  - T2 `sync-write-schema`
  - T3 `sync-write`
  - T4 `sync-worker`, `run-sync` y `provider-google`
  - T5 `sync-write-core`
  - T6 `provider-google`
  - T7 `write-event`
  - T8 `event-actions` y `synced-calendar-ui`
  - T9 `oauth-routes`, `reconnect-notice` y `connection-*`
  - T10 `write-calendar` y `connection-actions`
  - T11 `upload-calendar` y `upload-page`
  - T12 `privacy-page` y `connection-list`
  - T13 `no-secrets`
- [x] Aplicación de Google publicada sin verificar. Una cuenta fuera de la lista de pruebas conecta pasando por el aviso de "aplicación no verificada" (el usuario, en producción).
- [x] Demo en producción con una cuenta real (el usuario, 2026-10-29): volver a conectar una cuenta de la 007; crear, cambiar, mover y borrar eventos y verlos en Google; cambiar una repetición; un Editor cambia un evento; renombrar un calendario; crear uno en Google; subir uno de CaFam; y un cambio rechazado que no se guarda. Todo correcto.
- [x] Revisión visual (P9): `/privacy` sin sesión a 390, 768 y 1440 px. Además, 42 capturas en dev, con un usuario de prueba y conexiones sembradas (ya borrado): aviso previo, ficha con escritura, ficha de solo lectura, ficha con `?missing=`, "Mis calendarios" con el aviso y "Subir a Google", `/upload` y detalle de un evento traído, a 390, 768 y 1440 px con acento rojo y amarillo. Encontró un fallo de concordancia en `/upload` ("1 evento … están fuera"), ya corregido y con test.
- [x] `no-secrets` en verde y diff revisado: ninguna autorización de Google llega al navegador (T13).

## Dudas abiertas

- Ninguna que bloquee la T1. Si la T1 cambia algo del plan (duración de la subida, requisitos para publicar), se enmiendan el plan y estas tareas antes de la T2.
