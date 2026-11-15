# Tasks 026 — Calendario móvil primero

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **en curso**.

## Tareas

- [ ] T1 Barra del calendario
  Hecho cuando: `npm test -- calendar-dock` en verde: vistas con la actual marcada, cierre con Escape y al elegir, anterior/siguiente fuera de la agenda, "Hoy" con la fecha, "Calendarios" abre la hoja y recupera el foco, `data-has-dock`. Cubre: RF-1, RF-2, RF-3, RF-4, RF-7

- [ ] T2 Cabecera, hoja y altos
  Hecho cuando: la cabecera queda con mes y avatar, la hoja solo con filtros, y las vistas miden el alto libre; tests de `top-bar`, `calendar-workspace` y de los altos en verde. Cubre: RF-4, RF-5, RF-6, RF-9

- [ ] T3 Estado vacío y "Reintentar"
  Hecho cuando: `npm test -- use-event-window calendar-client` en verde con `retry`. Cubre: RF-8

- [ ] T4 Capturas, recorrido, medida y cierre
  Hecho cuando: capturas de CA-2, recorrido de CA-3, `measure.mjs` sin regresión y P8 en verde. Cubre: CA-1, CA-2, CA-3, RNF-1

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1, RF-2, RF-3, RF-7 | T1 |
| RF-4 | T1, T2 |
| RF-5, RF-6, RF-9 | T2 |
| RF-8 | T3 |
