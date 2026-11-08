# Tasks 020 - Disponibilidad en el calendario y sincronización rápida

> Estado: **hechas** (T1–T13). Spec cerrada el 2026-11-09 con la aprobación del usuario.
> Spec: `specs/020-disponibilidad-y-sincronizacion-rapida/spec.md`, aprobada el 2026-11-08. Plan: `specs/020-disponibilidad-y-sincronizacion-rapida/plan.md`, aprobado el 2026-11-08.
> 13 tareas en dos iteraciones:
>
> - Iteración 1 (T1–T7): comprobación de los avisos de Google (T1) y disponibilidad en la rejilla (T2–T7).
> - Iteración 2 (T8–T13): sincronización rápida (T8–T12) y validación (T13).
>
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si la tarea toca esquema, RLS o datos, también `npm run test:db -- <filtro>`.
> - Si toca interfaz: capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo (P9).
> - Un commit por tarea, citándola, en la rama `020-disponibilidad-y-sincronizacion-rapida`.
>
> Sin dependencias nuevas (P6). Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario al cerrar.

## Tareas

### Iteración 1

- [x] T1 Comprobar si Google acepta avisos en la URL de producción (plan R1)
  Pasos: con una cuenta de Google conectada en dev, un script en el scratchpad (sin commit) pide `POST .../events/watch` con `address` = `https://calendario-familia-five.vercel.app/api/sync/google-push`, apunta la respuesta y cancela el canal con `channels.stop`. Si Google exige verificar el dominio, probar la etiqueta `meta` de Search Console; si tampoco, se deja `SYNC_PUSH_URL` vacía (T11) y RF-19 queda en 15 minutos, como se acordó.
  Hecho cuando: el resultado (aceptado, aceptado tras verificar o rechazado, con el código y el mensaje de Google y la caducidad que devuelve) está anotado en la sección "Evidencia" de este archivo. Cubre: RF-19, RF-20, RF-23 | Módulo: riesgo R1

- [x] T2 Crear la migración `busy_grid` con sus tests de base de datos
  Pasos: `profiles.share_busy`, `person_preferences.show_busy`, `busy_people()` y `grid_busy()` según el modelo de datos del plan (D2, D4, D5, D13); `db:push` y `db:types`.
  Hecho cuando: `npm run test:db -- busy-grid` en verde con: un usuario ajeno no recibe nada; una persona que no consiente no sale ni en `busy_people` ni en `grid_busy`; las columnas devueltas son solo `person_id`, `starts_at`, `ends_at`, `all_day`, `recurrence`, `recurrence_tz` y `exdates`; un evento que otro puso en un calendario compartido no cuenta y uno que ella creó sí (D13); las excepciones salen sueltas y su fecha original está en los `exdates` de la serie; periodo de 33 días → `22023`; con 9 personas marcadas devuelve 8; desmarcar o retirar el consentimiento deja de devolverla. Cubre: RF-1, RF-2, RF-4, RF-5, RF-7, RF-10, RF-17, RF-18 | Módulo: migración `busy_grid`

- [x] T3 Calcular los bloques "Ocupado" (`lib/availability/busy.ts`)
  Hecho cuando: `npm test -- busy` en verde con: 9–10 y 9:30–11 → un bloque 9:00–11:00; 9–10 y 10–11 → uno; un intervalo idéntico a un evento visible desaparece y otro a la vez no; día completo → `BusyDay` por fechas UTC; repeticiones expandidas cuentan una a una; dos personas no se juntan entre sí; horas en la zona de quien mira. Cubre: RF-10, RF-11, RF-12, RF-13 | Módulo: `lib/availability/busy.ts`

- [x] T4 Leer la disponibilidad y guardar las opciones (`queries.ts` y acciones)
  Pasos: `getBusyPeople()` y `getBusyBlocks(range, visibles)` en `lib/availability/queries.ts` (con `expandRows`); `setShareBusy` en `settings/actions.ts` y `setShowBusy` en `calendar/preferences-actions.ts`.
  Hecho cuando: `npm test -- availability-queries busy-actions` en verde (zod rechaza un id no válido, el upsert de `show_busy` no toca `position`, un error de la base de datos se traduce) y `npm run test:db -- busy-grid` sigue en verde. Cubre: RF-1, RF-4, RF-6, RF-7, RF-8, RF-18 | Módulo: `lib/availability/queries.ts`, acciones

- [x] T5 Añadir la opción en Ajustes y en `/privacy`
  Pasos: `BusySetting` con `Switch` junto a `AvailabilitySetting`, con la explicación de RF-3; párrafo en la política de privacidad.
  Hecho cuando: `npm test -- busy-setting privacy` en verde (desactivada por defecto, cambiarla llama a `setShareBusy` y no a `setShareAvailability`, el texto nombra "Ocupado" y que solo lo ven quienes comparten calendario) y capturas de Ajustes a 390 y 1440 px. Cubre: RF-1, RF-2, RF-3 | Módulo: `BusySetting`, `/privacy`

- [x] T6 Añadir la sección "Disponibilidad" a los filtros
  Hecho cuando: `npm test -- calendar-filters` en verde con: sin personas no hay sección; cada persona con su avatar y una casilla desmarcada por defecto; marcar llama a `setShowBusy(id, true)`; con 8 marcadas la novena casilla está deshabilitada con "Como mucho 8 personas a la vez"; todo con teclado. Capturas del panel y del cajón del móvil. Cubre: RF-5, RF-6, RF-17 | Módulo: `calendar-filters.tsx`

- [x] T7 Pintar los bloques "Ocupado" en semana y día
  Pasos: `BusyBlock` (D6, token `bg-busy-hatch`), la página pide `getBusyBlocks` solo en semana y día y las vistas los colocan con `layoutTimedDay` y en la franja de día completo.
  Hecho cuando: `npm test -- busy-block week-view day-view month-view agenda-view design-tokens` en verde con: "Ocupado · Ana" con el tinte en `style` y sin relleno pastel; pulsarlo abre el globo con nombre y horas, sin enlace; sin `data-event-id`, sin arrastre, sin menú contextual ni teclas de evento; mes y agenda no los pintan. Capturas a 390, 768 y 1440 px, claro y oscuro, rojo y amarillo, con dos usuarios de prueba en dev. Cubre: RF-8, RF-9, RF-11, RF-14, RF-15, RF-16 | Módulo: `BusyBlock`, `time-grid.tsx`, vistas

### Iteración 2

- [x] T8 Crear la migración `sync_fast` con sus tests de base de datos
  Pasos: columnas de `synced_calendars`, `sync_channels`, `sync_channel_stops` y su trigger, `sync_push`, `sync_store_channel`, `sync_mark_checked`, `sync_claim_stops`, `sync_done_stop`, los cambios en `sync_due_calendars`, `sync_claim_due`, `sync_trigger` y `connect_account`, y `sync-run-due` cada minuto; `db:push` y `db:types`.
  Hecho cuando: `npm run test:db -- sync-fast sync-worker` en verde con: due a los 15 min y no antes; con aviso, due a 1 min del último intento y no antes; un calendario en curso no se reclama; `sync_push` con token malo, canal desconocido o estado `sync` no marca nada y no da error; `sync_mark_checked` pone `last_synced_at`, reinicia fallos y conserva un aviso posterior al inicio; borrar el calendario, dejar de traerlo o renovar el canal encola la cancelación; reconectar borra los canales; ningún cliente lee `sync_channels`; el trabajo de cron es `* * * * *`. Cubre: RF-19, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-29, RF-30 | Módulo: migración `sync_fast`

- [x] T9 Pedir la versión del calendario y saltarse la lectura si no cambió
  Pasos: `calendarVersion` en `providers/google.ts` e `icloud.ts`, `needsFullRead` y su uso en `syncOne`, constantes en `limits.ts`.
  Hecho cuando: `npm test -- google icloud run-sync` en verde con: misma versión, sin aviso y lectura completa de hace menos de 6 h → no se llama a `listEvents` y sí a `sync_mark_checked`; versión distinta, sin versión guardada, aviso o más de 6 h → lectura completa y versión guardada; la versión se pide antes de leer; un error al pedirla va a `sync_fail` con su tipo. Cubre: RF-23, RF-26, RF-27, RF-28, RF-29, RF-30 | Módulo: `providers`, `run-sync.ts`, `limits.ts`

- [x] T10 Crear, renovar y cancelar los canales de Google
  Pasos: `lib/sync/channel.ts` (`newChannel`, `shouldRenew`), `watchCalendar` y `stopChannel` en `providers/google.ts`, la renovación en `syncOne` y la cola de cancelaciones en `runDue`.
  Hecho cuando: `npm test -- channel google run-sync` en verde con: sin canal o a menos de 24 h de caducar → `watch` y `sync_store_channel`; con más de 24 h no se toca; iCloud nunca crea canales; sin `SYNC_PUSH_URL` no se crean; la cola llama a `channels.stop` y a `sync_done_stop`, y un fallo de `stop` no tumba la pasada; el token no aparece en ningún registro. Cubre: RF-20, RF-22 | Módulo: `channel.ts`, `providers/google.ts`, `run-sync.ts`

- [x] T11 Recibir los avisos en `/api/sync/google-push`
  Pasos: la ruta, `pushHeaders` en `channel.ts`, `SYNC_PUSH_URL` en `.env.example` y en la tabla de variables de `AGENTS.md`.
  Hecho cuando: `npm test -- google-push channel route-access` en verde (entorno node) con: aviso válido → `sync_push` con canal, token y estado y `200` sin cuerpo; sin cabeceras, token falso o error de la base de datos → también `200` sin cuerpo, y en los dos últimos casos con la misma respuesta que el válido; no lee el cuerpo; la ruta es pública en `getRouteAccess`. Cubre: RF-19, RF-21, RF-24 | Módulo: `google-push/route.ts`, `channel.ts`

- [x] T12 Probar la sincronización rápida de punta a punta en dev
  Pasos: con la app en el puerto 3000 y una cuenta de Google e iCloud conectadas, simular un aviso con `curl` usando un canal sembrado; dejar correr las comprobaciones de 15 minutos.
  Hecho cuando: en la sección "Evidencia" consta: un aviso simulado lleva el cambio a CaFam en 2 minutos o menos; tres avisos en 30 s producen una sola lectura completa; una comprobación sin cambios no descarga eventos y actualiza "última actualización" en "Mis calendarios" y en la ficha; un cambio hecho en iCloud llega en 15 minutos o menos; dejar de traer un calendario de Google cancela su canal. Cubre: RF-19, RF-24, RF-26, RF-27, RF-28, RF-30 | Módulo: validación

- [x] T13 Validar RF por RF, documentar y preparar producción
  Pasos: tabla RF-1 a RF-30 con su test o comprobación; prueba con dos usuarios (inspeccionar la respuesta: solo persona, inicio y fin; al retirar el consentimiento los bloques desaparecen); verificación P8 completa con `test:db`; `AGENTS.md` al día; comandos exactos para el usuario (migraciones a prod, `SYNC_PUSH_URL` en Vercel, `git push` y merge).
  Hecho cuando: la tabla y la salida de la verificación están en "Evidencia" y el usuario ha hecho en producción la prueba de Google (2 minutos o menos, o 15 si T1 salió rechazado) y la del iPhone (15 minutos o menos), y aprueba cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T2, T4, T5
- RF-2 -> T2, T5
- RF-3 -> T5
- RF-4 -> T2, T4, T13
- RF-5 -> T2, T6
- RF-6 -> T4, T6
- RF-7 -> T2, T4
- RF-8 -> T4, T7
- RF-9 -> T7
- RF-10 -> T2, T3
- RF-11 -> T3, T7
- RF-12 -> T3
- RF-13 -> T3
- RF-14 -> T7
- RF-15 -> T7
- RF-16 -> T7
- RF-17 -> T2, T6
- RF-18 -> T2, T4
- RF-19 -> T1, T8, T11, T12, T13
- RF-20 -> T1, T10
- RF-21 -> T8, T11
- RF-22 -> T8, T10, T12
- RF-23 -> T1, T8, T9
- RF-24 -> T8, T11, T12
- RF-25 -> T8
- RF-26 -> T8, T9, T12, T13
- RF-27 -> T9, T12
- RF-28 -> T9, T12
- RF-29 -> T8, T9
- RF-30 -> T8, T9, T12

## Evidencia

### T1 (2026-11-08)

Script en el scratchpad (sin commit) con la cuenta de Google de dev (cliente `CaFam Local`), vuelta a conectar por el usuario porque su token había caducado (`invalid_grant`):

```
refresh: 200
watch: 200 {"kind":"api#channel","expiration":"2026-11-15T09:33:43.000Z","hasResourceId":true}
version: 200 {"updated":"2026-11-08T09:17:01.548Z"}
stop: 204
```

- Google **acepta** `https://calendario-familia-five.vercel.app/api/sync/google-push` sin verificar el dominio: RF-19 sigue en 2 minutos y no hace falta Search Console.
- Con `ttl` de 7 días devuelve una caducidad de exactamente 7 días (`CHANNEL_TTL_DAYS = 7` del plan sirve).
- `events?maxResults=1&fields=updated` responde con `updated` (la versión de D9).
- `channels.stop` responde `204`.
- No se comprobó que el aviso llegue: la ruta aún no existe en producción. Se comprueba en T13.

### T2 (2026-11-08)

- Migración `20261108100000_busy_grid` aplicada en dev; tipos regenerados.
- `npm run test:db -- busy-grid`: 10 de 10 en verde.
- `typecheck`, `lint` (0 errores; los 2 avisos ya existían), `format:check`, `npm test` (253 archivos, 2.417 tests) y `build` en verde.

### T3 (2026-11-08)

- `npm test -- busy.test`: 7 de 7 en verde (rojo antes: el módulo no existía).
- Los bloques guardan instantes UTC; la conversión a la zona de quien mira la hace la vista como con los eventos (se comprueba en T7).
- Verificación P8: typecheck, lint (0 errores), format:check, `npm test` (254 archivos, 2.424 tests) y build en verde.

### T4 (2026-11-08)

- `npm test -- settings-actions preferences-actions availability-queries`: en verde (rojo antes: `setShareBusy`, `setShowBusy` y el módulo no existían).
- `npm run test:db -- busy-grid`: 10 de 10.
- Verificación P8: typecheck, lint (0 errores), format:check, `npm test` (255 archivos, 2.433 tests) y build en verde.

### T5 (2026-11-08)

- `npm test -- busy-setting privacy-page availability-setting`: 11 de 11 (rojo antes: el componente y la sección no existían).
- `BusySetting` reutiliza el interruptor de `AvailabilitySetting` (que gana `label` y `description` opcionales) en una sección nueva "Disponibilidad" de Ajustes, antes de "Asistente".
- Capturas en `next start -p 3100` con usuarios sembrados en dev: Ajustes a 375 y 1440 px (tema oscuro): la opción y su explicación se leen enteras, separada del permiso del asistente.
- Verificación P8: typecheck, lint (0 errores), format:check, `npm test` (256 archivos, 2.436 tests; un fallo intermitente de `agenda-view` desapareció al repetir) y build en verde.

### T6 (2026-11-08)

- Componente propio `AvailabilityFilter` (`availability-filter.tsx`) que el workspace pinta bajo `CalendarFilters`, en el panel y en el cajón; test en `availability-filter.test.tsx` (4 de 4). Los tintes salen de `assignTints` sobre las personas de los filtros y las de la disponibilidad, compartidos con `CalendarFilters` (prop `tints`) y con los bloques de T7.
- `npm test -- calendar-filters calendar-workspace availability`: 43 de 43.
- En el navegador (`next start -p 3100`, usuarios sembrados en dev): la sección lista a Ana y Luis con su avatar; desmarcar a Luis se guarda y sigue desmarcado al recargar; en el cajón del móvil (375 px, oscuro) aparece tras "Calendarios".
- Verificación P8: typecheck, lint (0 errores), format:check, `npm test` (257 archivos, 2.440 tests) y build en verde.

### T7 (2026-11-08)

- `npm test -- busy-block week-view day-view time-grid design-tokens availability-queries`: en verde (rojo antes: `busy-block` no existía). `busy-block.tsx` entra en la lista de lo que flota de la guardia de diseño por su globo (`glass-float`).
- Cambio respecto a T4: `getBusyBlocks` pasa a `getBusyIntervals` y devuelve los intervalos expandidos; `busyBlocks` se aplica en el navegador con los eventos que dejan ver los filtros (`shown`), que es lo que pide D3 (un calendario oculto no cuenta como visto).
- En el navegador con usuarios sembrados en dev: Ana 07:00–13:00 y 13:00–14:00 UTC → un bloque "08:00 – 15:00" (RF-12); el "Dentista" que Ana creó en el calendario de Marta, que Marta ve, no sale como Ocupado (RF-13); la serie semanal sale el lunes 18:00–19:00 (hubo que corregir la regla sembrada: la app siempre escribe `BYDAY`); el viaje de Luis en la franja de día completo; pulsar un bloque abre la nota "Ana García / Ocupado de 09:30 a 11:00" sin abrir el alta rápida; mes y agenda no tienen bloques (0).
- Capturas: semana a 1440 px en claro con acento amarillo y día a 375 px en oscuro.
- Verificación P8: typecheck, lint (0 errores), format:check, `npm test` (258 archivos, 2.444 tests) y build en verde.

### T8 (2026-11-08)

- Migración `20261108110000_sync_fast` aplicada en dev (`npx supabase db push`) y tipos regenerados (`npm run db:types`).
- `npm run test:db -- sync-fast sync-worker`: 2 archivos, 46 tests en verde (22 de `sync-fast`: tablas fuera del alcance de los clientes, token solo en SHA-256, `sync_push` con canal o token falsos sin error ni efecto, 'sync' ignorado, vencimiento de 1 min con aviso y 15 min sin él, un calendario con fallos no se adelanta, `sync_mark_checked` sin cambios cuenta como actualización y conserva el aviso posterior, cola de paradas al sustituir o reconectar, `sync_trigger` despierta por paradas solas, se tiran las paradas de cuentas que no funcionan).
- `sync-worker` ajustado: `sync-run-due` cada minuto (`* * * * *`) y 'reciente' a 5 min.
- Decisión añadida: un calendario con fallos seguidos espera los 15 min aunque haya aviso, para no llamar a Google cada minuto mientras falla.
- P8: typecheck ok, lint 0 errores (2 avisos previos en `event-form.tsx` y `event-images.test.ts`), format ok, `npm test` 258 archivos y 2444 tests en verde, build ok.

### T9 (2026-11-08)

- `calendarVersion` en Google (`events?maxResults=1&fields=updated`, en `google.ts` y `google-session.ts`) e iCloud (`PROPFIND` de profundidad 0 a `cs:getctag`, directo al calendario sin descubrimiento); método nuevo de `ProviderSession`.
- `needsFullRead` (pura) en `run-sync.ts`: lee todo si la versión es nula o distinta, no hay versión guardada, hay aviso, nunca se leyó entera o hace más de `FULL_READ_HOURS` (6). `syncOne` pide la versión antes de leer; sin cambios llama a `sync_mark_checked` con `p_full: false` y devuelve un resumen a cero; tras una lectura completa, `sync_mark_checked` con `p_full: true`. Un fallo al pedir la versión va a `sync_fail` con su tipo. Constantes en `limits.ts`.
- La reclamación manual ("Actualizar ahora") no trae versión, así que siempre lee todo.
- `npm test -- google icloud run-sync`: 12 archivos, 157 tests en verde (misma versión sin aviso y lectura reciente → sin `listEvents` y con `sync_mark_checked`; versión distinta, sin versión guardada, aviso o más de 6 h → lectura completa y versión guardada; versión antes de leer; fallo de la versión → `sync_fail` con `missing`).
- P8: typecheck ok, lint 0 errores (2 avisos previos), format ok, `npm test` 258 archivos y 2463 tests en verde, build ok.

### T10 (2026-11-08)

- `lib/sync/channel.ts`: `newChannel` (id `randomUUID` y token de 32 bytes en base64url) y `shouldRenew` (sin canal o a menos de `CHANNEL_RENEW_HOURS`).
- `watchCalendar` (`POST .../events/watch` con `web_hook`, token y `ttl` de 7 días; la caducidad en ms pasa a ISO) y `stopChannel` (`POST /channels/stop`) en `providers/google.ts` y en la sesión de Google; métodos opcionales de `ProviderSession`, que iCloud no tiene.
- `syncOne` renueva el canal tras abrir la sesión si hay `pushUrl` (`SYNC_PUSH_URL`, leída en `engineDeps`), el proveedor tiene canales y la reclamación trae `channel_expires_at` (la manual no lo trae y no toca los canales); un fallo no tumba la actualización y se reintenta en la pasada siguiente. `runDue` procesa al final hasta 20 paradas con `sync_claim_stops`, llama a `stopChannel` y siempre a `sync_done_stop` (si `stop` falla, el canal caduca solo, R4).
- `npm test -- channel google run-sync`: 4 archivos, 93 tests en verde (sin canal o a menos de 24 h → `watch` y `sync_store_channel`; con más de 24 h no se toca; iCloud nunca; sin `SYNC_PUSH_URL` ni en la reclamación manual; la cola llama a `channels.stop` y a `sync_done_stop` aunque un `stop` falle; el token no aparece en ningún `console`).
- P8: typecheck ok, lint 0 errores (2 avisos previos), format ok, `npm test` 259 archivos y 2480 tests en verde, build ok.

### T11 (2026-11-08)

- Ruta `POST /api/sync/google-push`: lee solo las cabeceras con `pushHeaders` (`channel.ts`: `x-goog-channel-id`, `x-goog-channel-token` y `x-goog-resource-state`), llama a `sync_push` con el secreto y la clave publicable y responde siempre `200` sin cuerpo; un error de la base de datos o de red se traga.
- `/api/sync/run` ahora pasa `SYNC_PUSH_URL` al motor (`pushUrl`): sin eso los canales de la T10 nunca se crearían en producción.
- `SYNC_PUSH_URL` documentada en `.env.example` y en la tabla de variables de `AGENTS.md`.
- `npm test -- google-push channel route-access`: 3 archivos, 39 tests en verde (aviso válido → `sync_push` y `200` vacío sin leer el cuerpo; sin cabeceras, token falso, error y excepción de la base de datos → la misma respuesta; sin `CRON_SECRET` no llama; `/api/sync/google-push` es pública en `getRouteAccess`).
- P8: typecheck ok, lint 0 errores (2 avisos previos), format ok, `npm test` 260 archivos y 2489 tests en verde, build ok.

### T12 (2026-11-08)

- App compilada en el puerto 3100 con `SYNC_PUSH_URL` de producción; el cron se simula con `POST /api/sync/run` cada minuto (en dev `pg_cron` no llega a `localhost`). Cuenta de Google de dev con 4 calendarios (1 propio, 3 de solo lectura). Scripts en el scratchpad, sin commit; solo imprimen estados, horas y recuentos.
- Primera pasada (10:27:18): 4 calendarios leídos enteros, versión guardada y **4 canales reales creados en Google**, que caducan a los 7 días (2026-11-15).
- **Comprobación sin cambios** (10:45:42, más de 15 min después): los 3 calendarios sin cambios no descargaron eventos (`full_read_at` sigue en 10:27) y sí pusieron `last_synced_at` a 10:45:43, la columna que muestran "Mis calendarios" y la ficha de la cuenta; el calendario con un evento creado en Google a las 10:45:29 se leyó entero y lo trajo.
- **Aviso simulado** con un canal sembrado de token conocido: evento borrado en Google a las 10:45:56; avisos con `curl` a las 10:45:57, 10:46:12 y 10:46:27, más uno con token falso, todos `200` sin cuerpo. Pasada de las 10:46:29: 0 calendarios (menos de 1 min desde el último intento); pasada de las 10:47:31: 1 calendario y el evento ya no está en CaFam. **95 s** del cambio en Google a CaFam, y **una sola lectura completa** para los tres avisos.
- El canal real sustituido por el sembrado se canceló en esa misma pasada (cola de paradas vacía después).
- **Dejar de traer**: borrar la fila `synced_calendars` de un calendario (lo mismo que `detach_synced_calendars`) encoló su canal; la pasada siguiente lo canceló en Google (un segundo `channels.stop` del mismo canal responde `404`) y la cola quedó vacía. La fila se restauró después para no cambiar los datos de dev.
- Limpieza: evento de prueba borrado en Google, todos los canales de dev cancelados (`sync_channels` y la cola vacías) y la app reiniciada sin `SYNC_PUSH_URL`.
- **Pendiente: iCloud.** En dev no hay ninguna cuenta de iCloud conectada (hace falta la contraseña específica de app del usuario), así que "un cambio hecho en iCloud llega en 15 minutos o menos" se comprueba con la prueba del iPhone en producción de la T13. El camino de iCloud (`getctag`, comprobación cada 15 min) está cubierto por los tests de la T9.

### T13 (2026-11-08; cerrada el 2026-11-09)

**Validación RF por RF**

| RF | Test o comprobación |
|----|---------------------|
| RF-1 | `busy-setting.test.tsx` (opción en Ajustes, desactivada por defecto); `busy-grid.test.ts` (`share_busy` por defecto `false`) |
| RF-2 | `busy-grid.test.ts` (activar `share_busy` no toca `share_availability` ni al revés); `busy-setting.test.tsx` |
| RF-3 | `busy-setting.test.tsx` (texto explicativo); `privacy-page.test.tsx` (sección "Disponibilidad en el calendario") |
| RF-4 | Prueba con usuarios sembrados: al retirar el consentimiento la siguiente lectura de `grid_busy` ya no devuelve nada (todo el script, 2,6 s); `busy-grid.test.ts` |
| RF-5 | `busy-grid.test.ts` (`busy_people` solo con quien consiente y comparte calendario); `availability-filter.test.tsx` |
| RF-6 | `availability-filter.test.tsx` (marcar y desmarcar, todas desmarcadas al empezar) |
| RF-7 | `preferences-actions.test.ts` (`setShowBusy` guarda `person_preferences.show_busy`); `busy-grid.test.ts` (`shown`) |
| RF-8 | `busy-block.test.tsx` ("Ocupado · nombre" a su hora en la zona del lector); comprobación en el navegador de la T7 |
| RF-9 | `busy-block.test.tsx` (rayado, sin relleno pastel, borde del color del avatar) |
| RF-10 | `busy-grid.test.ts` (calendarios que el lector no ve y D13: propios y creados donde sigue siendo miembro); prueba con usuarios sembrados (solo persona, inicio, fin, día completo y regla) |
| RF-11 | `busy-block.test.tsx` (franja de día completo); `busy.test.ts` |
| RF-12 | `busy.test.ts` (solapados y contiguos en un solo bloque) |
| RF-13 | `busy.test.ts` (coincidencia exacta con un evento visible); comprobación en el navegador de la T7 (Dentista) |
| RF-14 | `busy-block.test.tsx` (nota con nombre y horas, sin enlace; Escape la cierra) |
| RF-15 | `busy-block.test.tsx` (sin `data-event-id`, enlace, arrastre ni menú) |
| RF-16 | Comprobación en el navegador de la T7 (0 bloques en mes y agenda); la página solo pide `grid_busy` en semana y día |
| RF-17 | `busy-grid.test.ts`; prueba con usuarios sembrados (al retirar el consentimiento, `busy_people` vacío) |
| RF-18 | `busy-grid.test.ts` y prueba con usuarios sembrados (34 días → `22023`) |
| RF-19 | T12: 95 s del cambio en Google a CaFam con un aviso simulado; `google-push-route.test.ts`; `sync-fast.test.ts` (vencimiento a 1 min); `sync-worker.test.ts` (cron cada minuto). Prueba con un aviso real en producción: correcta (usuario, 2026-11-09) |
| RF-20 | `run-sync.test.ts` (sin canal o a menos de 24 h → `watch`); `provider-google.test.ts`; T12 (4 canales reales creados, 7 días); `sync-fast.test.ts` (reconectar borra los canales) |
| RF-21 | `sync-fast.test.ts` (canal desconocido, token falso o estado `sync` no marcan nada); `google-push-route.test.ts` (misma respuesta); T12 (aviso con token falso) |
| RF-22 | `sync-fast.test.ts` (cola al sustituir o reconectar); `run-sync.test.ts` (la cola llama a `stop`); T12 (dejar de traer → canal cancelado en Google, segundo `stop` da `404`) |
| RF-23 | `sync-fast.test.ts` (sin aviso, vence a los 15 min); T12 (comprobación de los 15 min) |
| RF-24 | T12 (tres avisos en 30 s → una sola lectura); `sync-fast.test.ts` (aviso con intento hace 30 s no vence) |
| RF-25 | `sync-worker.test.ts` ("Actualizar ahora" sigue diciendo `too_soon` antes de 5 min); `sync-fast.test.ts` (los avisos no usan esa espera) |
| RF-26 | `sync-fast.test.ts` (15 min para cualquier proveedor); `provider-icloud-read.test.ts` (`getctag`). Prueba con iCloud en el iPhone en producción: correcta (usuario, 2026-11-09) |
| RF-27 | `run-sync.test.ts` (misma versión → sin `listEvents`); `provider-icloud-read.test.ts`; T12 con Google |
| RF-28 | `run-sync.test.ts` (versión distinta → lectura completa en la misma pasada) |
| RF-29 | `run-sync.test.ts` (fallo al pedir la versión → `sync_fail` con su tipo); `sync-fast.test.ts` (un calendario con fallos no se adelanta) |
| RF-30 | `sync-fast.test.ts` (`sync_mark_checked` pone `last_synced_at` en el calendario y en la conexión); T12 (la comprobación sin cambios actualizó `last_synced_at`) |

**Privacidad con dos usuarios** (usuarios `@cafam.test` sembrados, sesión real de cada uno): Marta recibe de `grid_busy` 7 filas de Ana y Luis con las claves `person_id, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates` (sin id, título, lugar, descripción ni calendario); `busy_people` solo da `id, display_name, shown`. Ana y Luis, que no han marcado a nadie, no reciben nada. Al retirar los dos el consentimiento, `busy_people` y `grid_busy` vuelven vacíos para todos en la lectura siguiente.

**Verificación P8 completa**

- typecheck ok, lint 0 errores (2 avisos previos en `event-form.tsx` y `event-images.test.ts`), format ok, `npm test` 260 archivos y 2489 tests en verde, build ok.
- `npm run test:db`: 31 archivos en verde a la primera; los otros 16 cayeron en sus `beforeAll` por `AuthApiError: Request rate limit reached` (trampa conocida del límite de Supabase Auth) y al repetirlos con `--no-file-parallelism` pasaron los 16 (103 tests). Los 38 usuarios de prueba que dejaron esas ejecuciones se borraron de dev.
- `AGENTS.md` al día: estado, sección "Añadido por la spec 020", base de datos, ruta, variable `SYNC_PUSH_URL`, patrón y dos trampas nuevas.

**Pasos de producción (los ejecuta el usuario, en este orden)**

1. Migraciones a prod (antes del despliegue; el código antiguo sigue funcionando con ellas):
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```
2. En Vercel → Settings → Environment Variables, solo en **Production**: `SYNC_PUSH_URL` = `https://calendario-familia-five.vercel.app/api/sync/google-push`.
3. Subir la rama e integrarla en `main` (despliega):
   ```
   git push origin 020-disponibilidad-y-sincronizacion-rapida
   git checkout main
   git merge --ff-only 020-disponibilidad-y-sincronizacion-rapida
   git push origin main
   ```
4. Pruebas en producción: esperar unos 15 minutos tras el despliegue (cada calendario crea su canal la primera vez que toca); cambiar un evento en Google Calendar y comprobar que llega a CaFam en 2 minutos o menos; cambiar uno en el Calendario del iPhone (iCloud) y comprobar que llega en 15 minutos o menos. Con eso, aprobar el cierre de la spec.

**Producción (2026-11-09)**: código desplegado (`origin/main` en `f8df45f`; `POST /api/sync/google-push` responde `200` en producción). El usuario confirma las migraciones `busy_grid` y `sync_fast` en prod, `SYNC_PUSH_URL` en Vercel (Production), la prueba de Google (2 minutos o menos) y la del iPhone (15 minutos o menos), todas correctas, y aprueba cerrar la spec.

## Dudas abiertas

- Ninguna.
