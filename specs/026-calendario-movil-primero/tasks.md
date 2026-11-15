# Tasks 026 — Calendario móvil primero

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **cerrada** (2026-11-15).

## Tareas

- [x] T1 Barra del calendario
  Evidencia (2026-11-15): `calendar-dock.tsx` y `tests/unit/calendar-dock.test.tsx` (7 casos: posición y objetivos de 44 px, cuatro vistas con la actual marcada y recuerdo de la elegida, cierre con Escape y al tocar fuera, anterior/siguiente en el navegador, "Hoy" con la fecha y sin flechas en la agenda, hoja de calendarios con devolución del foco, `data-has-dock`). Cubre: RF-1, RF-2, RF-3, RF-4, RF-7

- [x] T2 Cabecera, hoja y altos
  Evidencia (2026-11-15): la cabecera queda con el mes y el avatar (`top-bar.test.tsx` actualizado: "Hoy" ya no está arriba); la hoja "Calendarios" solo lleva filtros (`calendar-workspace.test.tsx`: caso reescrito, y el de "Hoy" usa lo que publica el calendario); utilidad `h-calendar` en mes, semana, día y esqueleto. En las capturas a 390 px la última fila del mes y las 23:00 de la semana quedan por encima de la barra. Cubre: RF-4, RF-5, RF-6, RF-9

- [x] T3 Estado vacío y "Reintentar"
  Evidencia (2026-11-15): `retry()` en `useEventWindow`; `calendar-client.test.tsx` comprueba que "Reintentar" vuelve a pedir el periodo; sin calendarios, `EmptyState` con "Crear calendario". Cubre: RF-8

- [x] T4 Capturas, recorrido, medida y cierre
  Evidencia (2026-11-15): 19 capturas en `specs/026-calendario-movil-primero/capturas/` (agenda, mes, semana y día a 390 px en claro y oscuro con Coral y Sol; la hoja de calendarios; mes a 768 y 1440 px). Recorrido en el iPhone emulado (`.scratch/ca3.mjs`, no versionado): cambiar a Semana desde la barra, semana siguiente y "Hoy", pasar a Día, ocultar "Mi calendario" desde la hoja (el evento desaparece) y volver a mostrarlo, tocar un hueco y crear "Desde el móvil" con la ventana rápida. `measure.mjs` (`results/026.json`): mes 99 ms, semana 78 ms, día 63 ms, 1/0/0 peticiones, 12 consultas: sin regresión. P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 282 archivos y 2.697 tests, build correcto. Sin `test:db`: no toca datos. Cubre: CA-1, CA-2, CA-3, RNF-1

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1, RF-2, RF-3, RF-7 | T1 |
| RF-4 | T1, T2 |
| RF-5, RF-6, RF-9 | T2 |
| RF-8 | T3 |
