# Tasks 042 — Vistas de año y de 4 días

Spec: `specs/042-vistas-de-ano-y-4-dias/spec.md`. Plan: `specs/042-vistas-de-ano-y-4-dias/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2.

## Tareas

- [x] T1 Rangos, navegación, títulos y atajos
  Hecho cuando: `npm test -- ranges format event-window shortcuts calendar-year` en verde.
  - `year`: del 1 de enero al 31 de diciembre; navegación de un año (29 de febrero → 28).
  - `4days`: 4 días desde la fecha; navegación de 4 en 4; sin efecto de ocultar fines de semana.
  - Y y X en `SHORTCUTS`.

  Cubre: RF-4, RF-6, RF-8, RF-9, RF-12 | Evidencia: `npm test -- ranges format event-window shortcuts calendar-year` 96/96: `year` del 1 de enero al 31 de diciembre (365 o 366 días), navega de año en año (29 de febrero → 28) y su título es el año; `4days` son 4 días seguidos desde la fecha (fines de semana incluidos), navega de 4 en 4 y su título es "20 nov – 23 nov 2026"; `eventDays` hace que el año no lea eventos (solo marcas, RF-5) y `warmRange` precarga 4 días a cada lado; `parseViewParams` acepta las dos vistas en la URL y como guardada; Y y X en `SHORTCUTS`. P8 en verde.
- [x] T2 Marcas del año en la base de datos
  Hecho cuando: `npm run test:db -- day-marks` en verde.
  - Migración, `db:push`, `db:types`. `calendar_day_marks` respeta RLS, da días distintos por calendario, días completos por fecha UTC y `22023` con más de 370 días; `last_view` acepta las nuevas.

  Cubre: RF-5, RF-11 | Evidencia: Migración `20261123100000_views_year.sql` aplicada en dev (`db:push`, `db:types`); `npm run test:db -- day-marks profile-last-view` 10/10: `calendar_day_marks` da (día, calendario) distintos con hora en la zona del perfil (23:30 UTC es el día siguiente en Madrid) y días completos por fecha UTC con fin exclusivo, recorta un evento largo a los días pedidos, no cuenta las series (las expande la app), respeta RLS (el Lector ve sus calendarios, un ajeno nada, `anon` no puede llamarla) y da `22023` con más de 370 días o un rango al revés; `last_view` acepta `year` y `4days` y rechaza otros (23514). `test:db` completo 636/636; P8 en verde.
- [ ] T3 Vista 4 días
  Hecho cuando: `npm test -- four-day-view` en verde: crear, mover, tarjeta y "Ocupado" funcionan como en la semana.

  Cubre: RF-6, RF-7 | Evidencia: —
- [ ] T4 Vista año
  Hecho cuando: `npm test -- year-view use-year-marks` en verde: 12 meses, columnas por anchura, puntos por calendario visible, hoy, pulsar día y mes, series expandidas.

  Cubre: RF-1 a RF-5 | Evidencia: —
- [ ] T5 Selector, vista recordada y sin conexión
  Hecho cuando: `npm test -- calendar-client calendar-heading offline-sources` en verde, capturas a 390, 768 y 1440 px en claro y oscuro y medida de RNF-1 en `tasks.md`.

  Cubre: RF-10, RF-11, RF-12, RF-13, RNF-1, RNF-2 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md (vistas, atajos, rutas), README y constitución (hoja de ruta y atajos de "Interacción del calendario") actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-5 | T2, T4 |
| RF-6 a RF-8 | T1, T3 |
| RF-9 | T1 |
| RF-10 a RF-13 | T5 |
