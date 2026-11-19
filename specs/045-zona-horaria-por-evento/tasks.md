# Tasks 045 — Zona horaria por evento

Spec: `specs/045-zona-horaria-por-evento/spec.md`. Plan: `specs/045-zona-horaria-por-evento/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: **cerrada** (2026-11-19), T1–T6.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1.

## Tareas

- [x] T1 Columnas y validación
  Hecho cuando: `npm run test:db -- event-time-zone` en verde.
  - Migración, `db:push`, `db:types`. Zona inválida → error; día completo las anula; copias, deshacer y sincronización las conservan.

  Cubre: RF-6, RF-7, RNF-2 | Evidencia: migración `20261126100000_event_time_zone` aplicada en dev (`db:push`, `db:types`); `test:db -- event-time-zone` 8 en verde (zonas válidas, `22023` con una inválida, día completo las anula, `copy_calendar_for_owner`, deshacer, `sync_apply_events` e `import_into_calendar` las conservan).
- [x] T2 Lógica de zonas
  Hecho cuando: `npm test -- event-zone` en verde: zona de edición, etiqueta original solo si difiere, desfases con cambio de hora y Asia/Kolkata, respaldo sin `supportedValuesOf`.

  Cubre: RF-1, RF-5 | Evidencia: `src/lib/calendar/event-zone.ts`; `npm test -- event-zone` 12 en verde (los recientes se validan con `Intl`, no con la lista: Node llama `Asia/Calcutta` a Kolkata).
- [x] T3 Escritura con zona
  Hecho cuando: `npm test -- event-actions quick-actions event-writes assistant-write-times` en verde: crear en Nueva York guarda el instante correcto; mover y duplicar conservan la zona; serie con zona propia cambia `recurrence_tz`.

  Cubre: RF-3, RF-8, RF-11 | Evidencia: `parseEventInput` convierte con la zona propia; `toRow` solo escribe las columnas si el cambio trae zona (mover, color y pegar la conservan); las series la guardan solo en `recurrence_tz`. Tests de `calendar-schemas`, `event-actions`, `series-actions` y `quick-actions` en verde.
- [x] T4 Formulario y detalle
  Hecho cuando: `npm test -- time-zone-field event-form event-panel event-card` en verde y capturas a 390 y 1440 px en claro y oscuro.

  Cubre: RF-1 a RF-5 | Evidencia: `TimeZoneField`, "Hora original" en el detalle y la tarjeta; `npm test -- time-zone-field event-form event-detail event-card` en verde; capturas en `capturas/` (`scripts/screenshots-045.mjs`, 390 y 1440 px, claro y oscuro).
- [x] T5 Google, iCloud, `.ics` y sin conexión
  Hecho cuando: `npm test -- google-payload google-events icloud-ics convert-events write-ics offline-describe` en verde.

  Cubre: RF-9, RF-10, RF-12 | Evidencia: `event-zone-providers.test.ts` (Google envía y lee `timeZone`, iCloud escribe `TZID` con `VTIMEZONE` y lo conserva al mover, `.ics` de ida y vuelta) y las pruebas de forma actualizadas; `npm test` 379 archivos y 3.730 tests en verde; `test:db -- event-time-zone sync-write ics` 56 en verde. Migraciones `event_time_zone_keep` (`sync_commit_event` conserva la zona si el cambio no la trae) e `ics_feed_zone` (la suscripción lleva la zona) aplicadas en dev.
- [x] T6 Cierre
  Hecho cuando: AGENTS.md (convención de eventos con hora), README y constitución actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: AGENTS.md (tabla, convención, migraciones, sección de la 045 y §12), README y constitución (convención de fechas) actualizados; graphify actualizado; P8: `typecheck`, `lint` (sin errores; el aviso previo de `event-form.tsx`), `format:check`, `npm test` 379 archivos y 3.730 tests y `build` en verde.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-5 | T2, T4 |
| RF-6, RF-7 | T1 |
| RF-8, RF-11 | T3 |
| RF-9, RF-10, RF-12 | T5 |
