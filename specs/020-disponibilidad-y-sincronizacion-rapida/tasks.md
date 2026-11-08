# Tasks 020 - Disponibilidad en el calendario y sincronización rápida

> Estado: **Borrador**, pendiente de aprobación.
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

- [ ] T4 Leer la disponibilidad y guardar las opciones (`queries.ts` y acciones)
  Pasos: `getBusyPeople()` y `getBusyBlocks(range, visibles)` en `lib/availability/queries.ts` (con `expandRows`); `setShareBusy` en `settings/actions.ts` y `setShowBusy` en `calendar/preferences-actions.ts`.
  Hecho cuando: `npm test -- availability-queries busy-actions` en verde (zod rechaza un id no válido, el upsert de `show_busy` no toca `position`, un error de la base de datos se traduce) y `npm run test:db -- busy-grid` sigue en verde. Cubre: RF-1, RF-4, RF-6, RF-7, RF-8, RF-18 | Módulo: `lib/availability/queries.ts`, acciones

- [ ] T5 Añadir la opción en Ajustes y en `/privacy`
  Pasos: `BusySetting` con `Switch` junto a `AvailabilitySetting`, con la explicación de RF-3; párrafo en la política de privacidad.
  Hecho cuando: `npm test -- busy-setting privacy` en verde (desactivada por defecto, cambiarla llama a `setShareBusy` y no a `setShareAvailability`, el texto nombra "Ocupado" y que solo lo ven quienes comparten calendario) y capturas de Ajustes a 390 y 1440 px. Cubre: RF-1, RF-2, RF-3 | Módulo: `BusySetting`, `/privacy`

- [ ] T6 Añadir la sección "Disponibilidad" a los filtros
  Hecho cuando: `npm test -- calendar-filters` en verde con: sin personas no hay sección; cada persona con su avatar y una casilla desmarcada por defecto; marcar llama a `setShowBusy(id, true)`; con 8 marcadas la novena casilla está deshabilitada con "Como mucho 8 personas a la vez"; todo con teclado. Capturas del panel y del cajón del móvil. Cubre: RF-5, RF-6, RF-17 | Módulo: `calendar-filters.tsx`

- [ ] T7 Pintar los bloques "Ocupado" en semana y día
  Pasos: `BusyBlock` (D6, token `bg-busy-hatch`), la página pide `getBusyBlocks` solo en semana y día y las vistas los colocan con `layoutTimedDay` y en la franja de día completo.
  Hecho cuando: `npm test -- busy-block week-view day-view month-view agenda-view design-tokens` en verde con: "Ocupado · Ana" con el tinte en `style` y sin relleno pastel; pulsarlo abre el globo con nombre y horas, sin enlace; sin `data-event-id`, sin arrastre, sin menú contextual ni teclas de evento; mes y agenda no los pintan. Capturas a 390, 768 y 1440 px, claro y oscuro, rojo y amarillo, con dos usuarios de prueba en dev. Cubre: RF-8, RF-9, RF-11, RF-14, RF-15, RF-16 | Módulo: `BusyBlock`, `time-grid.tsx`, vistas

### Iteración 2

- [ ] T8 Crear la migración `sync_fast` con sus tests de base de datos
  Pasos: columnas de `synced_calendars`, `sync_channels`, `sync_channel_stops` y su trigger, `sync_push`, `sync_store_channel`, `sync_mark_checked`, `sync_claim_stops`, `sync_done_stop`, los cambios en `sync_due_calendars`, `sync_claim_due`, `sync_trigger` y `connect_account`, y `sync-run-due` cada minuto; `db:push` y `db:types`.
  Hecho cuando: `npm run test:db -- sync-fast sync-worker` en verde con: due a los 15 min y no antes; con aviso, due a 1 min del último intento y no antes; un calendario en curso no se reclama; `sync_push` con token malo, canal desconocido o estado `sync` no marca nada y no da error; `sync_mark_checked` pone `last_synced_at`, reinicia fallos y conserva un aviso posterior al inicio; borrar el calendario, dejar de traerlo o renovar el canal encola la cancelación; reconectar borra los canales; ningún cliente lee `sync_channels`; el trabajo de cron es `* * * * *`. Cubre: RF-19, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-29, RF-30 | Módulo: migración `sync_fast`

- [ ] T9 Pedir la versión del calendario y saltarse la lectura si no cambió
  Pasos: `calendarVersion` en `providers/google.ts` e `icloud.ts`, `needsFullRead` y su uso en `syncOne`, constantes en `limits.ts`.
  Hecho cuando: `npm test -- google icloud run-sync` en verde con: misma versión, sin aviso y lectura completa de hace menos de 6 h → no se llama a `listEvents` y sí a `sync_mark_checked`; versión distinta, sin versión guardada, aviso o más de 6 h → lectura completa y versión guardada; la versión se pide antes de leer; un error al pedirla va a `sync_fail` con su tipo. Cubre: RF-23, RF-26, RF-27, RF-28, RF-29, RF-30 | Módulo: `providers`, `run-sync.ts`, `limits.ts`

- [ ] T10 Crear, renovar y cancelar los canales de Google
  Pasos: `lib/sync/channel.ts` (`newChannel`, `shouldRenew`), `watchCalendar` y `stopChannel` en `providers/google.ts`, la renovación en `syncOne` y la cola de cancelaciones en `runDue`.
  Hecho cuando: `npm test -- channel google run-sync` en verde con: sin canal o a menos de 24 h de caducar → `watch` y `sync_store_channel`; con más de 24 h no se toca; iCloud nunca crea canales; sin `SYNC_PUSH_URL` no se crean; la cola llama a `channels.stop` y a `sync_done_stop`, y un fallo de `stop` no tumba la pasada; el token no aparece en ningún registro. Cubre: RF-20, RF-22 | Módulo: `channel.ts`, `providers/google.ts`, `run-sync.ts`

- [ ] T11 Recibir los avisos en `/api/sync/google-push`
  Pasos: la ruta, `pushHeaders` en `channel.ts`, `SYNC_PUSH_URL` en `.env.example` y en la tabla de variables de `AGENTS.md`.
  Hecho cuando: `npm test -- google-push channel route-access` en verde (entorno node) con: aviso válido → `sync_push` con canal, token y estado y `200` sin cuerpo; sin cabeceras, token falso o error de la base de datos → también `200` sin cuerpo, y en los dos últimos casos con la misma respuesta que el válido; no lee el cuerpo; la ruta es pública en `getRouteAccess`. Cubre: RF-19, RF-21, RF-24 | Módulo: `google-push/route.ts`, `channel.ts`

- [ ] T12 Probar la sincronización rápida de punta a punta en dev
  Pasos: con la app en el puerto 3000 y una cuenta de Google e iCloud conectadas, simular un aviso con `curl` usando un canal sembrado; dejar correr las comprobaciones de 15 minutos.
  Hecho cuando: en la sección "Evidencia" consta: un aviso simulado lleva el cambio a CaFam en 2 minutos o menos; tres avisos en 30 s producen una sola lectura completa; una comprobación sin cambios no descarga eventos y actualiza "última actualización" en "Mis calendarios" y en la ficha; un cambio hecho en iCloud llega en 15 minutos o menos; dejar de traer un calendario de Google cancela su canal. Cubre: RF-19, RF-24, RF-26, RF-27, RF-28, RF-30 | Módulo: validación

- [ ] T13 Validar RF por RF, documentar y preparar producción
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

## Dudas abiertas

- Ninguna.
