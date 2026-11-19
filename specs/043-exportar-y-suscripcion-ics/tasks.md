# Tasks 043 — Exportar a `.ics` y suscripción de solo lectura

Spec: `specs/043-exportar-y-suscripcion-ics/spec.md`. Plan: `specs/043-exportar-y-suscripcion-ics/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2 y T3.

## Tareas

- [x] T1 Escritura del `.ics`
  Hecho cuando: `npm test -- write-ics ics-fold vtimezone` en verde.
  - Escapes (`,` `;` `\` saltos), plegado a 75 octetos sin partir UTF-8, día completo, varios días, serie con `RRULE`/`TZID`/`EXDATE` y excepción con `RECURRENCE-ID`.
  - Ida y vuelta con `parseIcs` (004) en 20 eventos variados.

  Cubre: RF-3 a RF-6, RNF-1 | Evidencia: `npm test -- write-ics ics-fold vtimezone` 3 archivos, 13 tests en verde (2026-11-19)
- [x] T2 Exportar con sesión
  Hecho cuando: `npm test -- ics-export-route` y `npm run test:db -- ics-export` en verde.
  - Un calendario (Lector incluido), los visibles con `CATEGORIES`, un ajeno → 404, sin sesión → 401, 2.000 eventos en menos de 1 s.

  Cubre: RF-1, RF-2, RF-5, RNF-2 | Evidencia: `npm test -- ics-export-route` 4 tests y `npm run test:db -- ics-export` 4 tests en verde (2.000 eventos por debajo de 1 s) (2026-11-19)
- [x] T3 Enlace de suscripción
  Hecho cuando: `npm run test:db -- ics-feeds` y `npm test -- ics-feed-route` en verde.
  - Migración, `db:push`, `db:types`. Solo el propietario crea y desactiva; un Editor → `CF404`; el hash no se lee; regenerar invalida; borrar o juntar el calendario lo invalida; 61.ª petición en una hora → 429.
  - La ruta pública con cabeceras y 404 sin cuerpo.

  Cubre: RF-7 a RF-11, RNF-3 | Evidencia: migración `ics_feeds` aplicada en dev; `npm run test:db -- ics-feeds` 5 tests y `npm test -- ics-feed-route` 3 tests en verde (2026-11-19)
- [x] T4 Interfaz y privacidad
  Hecho cuando: `npm test -- ics-feed-panel calendar-list calendar-filters` en verde y capturas a 390 y 1440 px en claro y oscuro en `capturas/`; prueba manual de suscripción desde un `.ics` servido por `next start` abierto en el navegador.

  Cubre: RF-1, RF-2, RF-7, RF-8, RF-12, RF-13 | Evidencia: `npm test -- ics-feed-panel calendar-list calendar-filters share-actions` 48 tests en verde; `scripts/screenshots-043.mjs` con `next start`: capturas en `capturas/`, la suscripción servida responde 200 con `text/calendar`, `private, max-age=900` y `noindex`, un token falso 404 sin cuerpo y la descarga con sesión `attachment; filename="Mi calendario.ics"` (2026-11-19)
- [ ] T5 Cierre
  Hecho cuando: AGENTS.md (rutas públicas, base de datos), README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2, RF-5 | T2, T4 |
| RF-3, RF-4, RF-6 | T1 |
| RF-7 a RF-11 | T3, T4 |
| RF-12, RF-13 | T4 |
