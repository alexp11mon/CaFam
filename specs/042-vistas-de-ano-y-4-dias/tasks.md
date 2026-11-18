# Tasks 042 — Vistas de año y de 4 días

Spec: `specs/042-vistas-de-ano-y-4-dias/spec.md`. Plan: `specs/042-vistas-de-ano-y-4-dias/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: cerrada (2026-11-19), T1–T6. Paso de producción: la migración `views_year` a prod antes de desplegar (ver el plan).

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
- [x] T3 Vista 4 días
  Hecho cuando: `npm test -- four-day-view` en verde: crear, mover, tarjeta y "Ocupado" funcionan como en la semana.

  Cubre: RF-6, RF-7 | Evidencia: `npm test -- four-day-view` 3/3: con `view="4days"` el workspace pinta la rejilla de la semana (`WeekView`) con 4 columnas (viernes a lunes, fin de semana incluido), una capa de huecos por día para crear, el evento editable con su tirador (mover y redimensionar con `DraggableEvent`, que abre la tarjeta como en la semana) y los bloques "Ocupado". La página y el cliente piden los "Ocupado" también en 4 días; el esqueleto tiene 4 columnas. P8 en verde.
- [x] T4 Vista año
  Hecho cuando: `npm test -- year-view use-year-marks` en verde: 12 meses, columnas por anchura, puntos por calendario visible, hoy, pulsar día y mes, series expandidas.

  Cubre: RF-1 a RF-5 | Evidencia: `npm test -- year-view use-year-marks` 9/9: `YearView` pinta los 12 meses (L a D, solo los días de cada mes: 365 enlaces en 2026) en una rejilla de 1, 2, 3 y 4 columnas (`grid-cols-1 tab:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`), hasta 3 puntos con el color de los calendarios visibles (un calendario oculto no marca), hoy en círculo de acento con `aria-current`, un día abre la vista día y el nombre del mes la vista mes, y "Reintentar" si fallan las marcas. `useYearMarks` guarda los años leídos y precarga el siguiente en reposo. `lib/calendar/year.ts` (`yearMonths`, `mergeMarks`) puro. `loadYearMarks` (`year-actions.ts`) → `getYearMarks`: `calendar_day_marks` más las series expandidas con `expandRows` (`npm run test:db -- day-marks` 6/6: los lunes de la serie semanal salen marcados hasta diciembre). P8 en verde.
- [x] T5 Selector, vista recordada y sin conexión
  Hecho cuando: `npm test -- calendar-client calendar-heading offline-sources` en verde, capturas a 390, 768 y 1440 px en claro y oscuro y medida de RNF-1 en `tasks.md`.

  Cubre: RF-10, RF-11, RF-12, RF-13, RNF-1, RNF-2 | Evidencia: `npm test -- calendar-client calendar-heading offline-sources` en verde (más `year-view`, `calendar-workspace`): el selector del escritorio (`ViewToolbar`) tiene las 6 vistas con sus teclas (X, Y); en el móvil (`CalendarHeading`) quedan 4 pestañas y "Más vistas" abre 4 días y Año (se cierra al elegir, con Escape o al salir el foco, y dice la vista elegida), y la elección se guarda con `saveLastView`; el título del móvil en el año es el año. `CalendarClient` pinta el año sin leer eventos (`useEventWindow` no planea nada en el año) y 4 días con el fin de semana aunque esté oculto. Sin conexión, `offlineCalendarProps.loadYearMarks` saca las marcas de la copia; los meses del año fuera de la copia quedan atenuados con "Estas fechas no están disponibles sin conexión" y 4 días fuera de la copia muestra el aviso. Capturas en `capturas/` (`anio`, `cuatro-dias` y `mas-vistas` a 390, 768 y 1440 px, claro y oscuro; `scripts/screenshots-042.mjs`). **RNF-1** (Edge, CPU 4× con `Emulation.setCPUThrottlingRate`, de pulsar a pintar el año nuevo): 76, 65 y 78 ms (antes de usar un solo `Intl.DateTimeFormat` para las 365 etiquetas, 158 ms). P8 en verde.
- [x] T6 Cierre
  Hecho cuando: AGENTS.md (vistas, atajos, rutas), README y constitución (hoja de ruta y atajos de "Interacción del calendario") actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: AGENTS.md (estado, "Añadido por la spec 042", base de datos, rutas, atajos, estructura, fuera de alcance, "Cómo continuar" y última actualización), README (tabla, funciones, rutas, hoja de ruta y fuera de alcance) y constitución (hoja de ruta y atajos de "Interacción del calendario") actualizados; `python -m graphify update .` hecho; P8 en verde (typecheck, lint con el aviso previo de `event-form.tsx`, format:check, 3.635 tests y build).

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-5 | T2, T4 |
| RF-6 a RF-8 | T1, T3 |
| RF-9 | T1 |
| RF-10 a RF-13 | T5 |
