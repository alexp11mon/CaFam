# Tasks 045 — Zona horaria por evento

Spec: `specs/045-zona-horaria-por-evento/spec.md`. Plan: `specs/045-zona-horaria-por-evento/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1.

## Tareas

- [ ] T1 Columnas y validación
  Hecho cuando: `npm run test:db -- event-time-zone` en verde.
  - Migración, `db:push`, `db:types`. Zona inválida → error; día completo las anula; copias, deshacer y sincronización las conservan.

  Cubre: RF-6, RF-7, RNF-2 | Evidencia: —
- [ ] T2 Lógica de zonas
  Hecho cuando: `npm test -- event-zone` en verde: zona de edición, etiqueta original solo si difiere, desfases con cambio de hora y Asia/Kolkata, respaldo sin `supportedValuesOf`.

  Cubre: RF-1, RF-5 | Evidencia: —
- [ ] T3 Escritura con zona
  Hecho cuando: `npm test -- event-actions quick-actions event-writes assistant-write-times` en verde: crear en Nueva York guarda el instante correcto; mover y duplicar conservan la zona; serie con zona propia cambia `recurrence_tz`.

  Cubre: RF-3, RF-8, RF-11 | Evidencia: —
- [ ] T4 Formulario y detalle
  Hecho cuando: `npm test -- time-zone-field event-form event-panel event-card` en verde y capturas a 390 y 1440 px en claro y oscuro.

  Cubre: RF-1 a RF-5 | Evidencia: —
- [x] T5 Google, iCloud, `.ics` y sin conexión
  Hecho cuando: `npm test -- google-payload google-events icloud-ics convert-events write-ics offline-describe` en verde.

  Cubre: RF-9, RF-10, RF-12 | Evidencia: `event-zone-providers.test.ts` (Google envía y lee `timeZone`, iCloud escribe `TZID` con `VTIMEZONE` y lo conserva al mover, `.ics` de ida y vuelta) y las pruebas de forma actualizadas; `npm test` 379 archivos y 3.730 tests en verde; `test:db -- event-time-zone sync-write ics` 56 en verde. Migraciones `event_time_zone_keep` (`sync_commit_event` conserva la zona si el cambio no la trae) e `ics_feed_zone` (la suscripción lleva la zona) aplicadas en dev.
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md (convención de eventos con hora), README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-5 | T2, T4 |
| RF-6, RF-7 | T1 |
| RF-8, RF-11 | T3 |
| RF-9, RF-10, RF-12 | T5 |
