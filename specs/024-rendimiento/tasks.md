# Tasks 024 — Rendimiento en el iPhone

Spec: `specs/024-rendimiento/spec.md`. Plan: `specs/024-rendimiento/plan.md` (los dos aprobados de antemano por el usuario en el prompt de arranque, 2026-11-15).

> Estado: **cerrada** (2026-11-15).

Cada tarea se hace sola y con el test primero (rojo → verde), y se cierra con la verificación de P8 en verde y su salida reportada. `npm run test:db` en las que tocan el acceso a datos (T3, T9). Sin migraciones ni dependencias.

## Tareas

Nota sobre el método: T1, T7 y T8 se hicieron con el test primero. En T2 a T6 el test y el código se escribieron en la misma pasada (no se ejecutó el rojo por separado) y van en un solo commit, porque el cambio de arquitectura (página → cliente) no se puede dejar a medias compilando. Se deja dicho en lugar de aparentar otra cosa.

- [x] T1 Arnés de medición y línea de base
  Hecho cuando: `scripts/perf/` tiene el proxy con latencia, el Groq simulado, `measure.mjs`, `paint.mjs` y un README, y `results/antes.json` está en el repositorio con las medidas de la spec. Cubre: CA-1 | Módulo: `scripts/perf`
  Evidencia (2026-11-15): `scripts/perf/results/antes.json` (mes 601 ms, 85 peticiones y 16 consultas por cambio). `paint.mjs`: sin diferencia medible con y sin `backdrop-filter`; 7 fotogramas largos al desplazar la agenda. P8 de partida en verde: 272 archivos y 2.613 tests, build correcto.

- [x] T2 Lógica pura de la ventana de eventos
  Hecho cuando: `npm test -- event-window` en verde. Cubre: RF-1, RF-3, RF-4, RF-6 | Módulo: `event-window`
  Evidencia (2026-11-15): `tests/unit/event-window.test.ts`, 18 casos (`serverWindow`, `visibleDayRange`, `warmRange`, `planLoad`, `mergeWindow`, `trimWindow`, `eventsInRange`); `ranges.test.ts` sigue en verde tras extraer `visibleDayKeys`.

- [x] T3 El servidor lee una ventana y el perfil una vez
  Hecho cuando: la página lee `getCalendarProfile`, la ventana y las categorías sin cascada; `loadCalendarWindow` y `loadBusy` validan fechas y tope de días; tests y `test:db` en verde. Cubre: RF-1, RF-8, RF-9, RF-10 | Módulo: `page`, `window-actions`, `queries`, `load-range`
  Evidencia (2026-11-15): `window-actions.test.ts` (5 casos) y `agenda-actions.test.ts` sin cambios en verde. En el navegador, cargar el calendario hace 12 consultas (11 sin series): perfil 2 (marco y página), miembros, preferencias ×2, grupos, categorías, personas, disponibilidad y eventos 3. `npm run test:db`: en verde, ver T9.

- [x] T4 Navegación en el navegador
  Hecho cuando: `npm test -- calendar-nav calendar-client use-event-window` en verde y los enlaces de las vistas usan `CalendarLink`. Cubre: RF-2, RF-3, RF-4, RF-5, RF-7, RF-11 | Módulo: `calendar-nav`, `calendar-client`, `use-event-window`, vistas
  Evidencia (2026-11-15): `calendar-nav.test.tsx` (4), `use-event-window.test.tsx` (7) y `calendar-client.test.tsx` (9). Los 2.613 tests anteriores siguen en verde sin tocarlos (fuera del calendario `CalendarLink` es un enlace normal). En el navegador (escritorio, 1440 px): 5 meses adelante sin ninguna petición de navegación; crear un evento en abril de 2027 desde la ventana rápida habiendo cargado noviembre de 2026 lo muestra tras el refresco (riesgo R1 descartado: `router.refresh()` usa la dirección de `pushState`); atrás vuelve a marzo; S y T cambian de vista y a hoy; recargar conserva vista y fecha.

- [x] T5 Deslizar sobre la rejilla y agenda sin repintar
  Hecho cuando: la rejilla lleva `touch-pan-y` y los días de la agenda están memorizados. Cubre: RF-12, RF-13 | Módulo: `time-grid`, `agenda-view`
  Evidencia (2026-11-15): `agenda-memo.test.tsx` (2). En el móvil emulado, deslizar seis veces sobre las horas (y = 420 px) en semana y día cambia de periodo; antes solo funcionaba sobre la cabecera.

- [x] T6 Menos JS al abrir
  Hecho cuando: el cliente de Supabase se importa de forma diferida y los esquemas zod salen de los módulos comunes; tests en verde y `measure.mjs` muestra la bajada. Cubre: RF-14, RF-15 | Módulo: `use-live-calendar`, `lib/theme/schemas`, `view-options-schema`, `undo-schemas`, `assistant-fab`
  Evidencia (2026-11-15): JS bloqueante del calendario 965 → 865 KB (282 → 254 KB gzip) y del asistente 655 → 551 KB. Objetivo del 25 % no alcanzado (ver la spec, RNF-6). Los tests de `live-calendar`, `accents`, `theme`, `view-options` y `quick-actions` siguen en verde con los imports nuevos.

- [x] T7 Protocolo de progreso del asistente
  Hecho cuando: `npm test -- assistant-stream assistant-run` en verde. Cubre: RF-16, RF-18 | Módulo: `stream`, `run`
  Evidencia (2026-11-15): `assistant-stream.test.ts` (7: líneas partidas entre trozos, también dentro de una letra con tilde) y 2 casos nuevos en `assistant-run.test.ts` (pasos avisados; dos herramientas a la vez con los resultados en el orden pedido). Los 11 casos anteriores del bucle, sin cambios.

- [x] T8 Ruta en streaming y chat con progreso
  Hecho cuando: `npm test -- assistant-route assistant-chat` en verde. Cubre: RF-16, RF-17, RF-19, RF-20 | Módulo: `route`, `assistant-chat`, `assistant/page`, `context-actions`, `assistant-fab`
  Evidencia (2026-11-15): 7 tests de `assistant-route.test.ts` actualizados a conciencia (la respuesta es un flujo: primera línea de estado y línea `done`; un fallo del proveedor llega como línea `error` con 200, ya no como 503; al cancelar el flujo termina sin respuesta, ya no hay 499) y 3 nuevos (pasos, cabeceras, `GET` 204). `assistant-chat-stream.test.tsx` (5): progreso por pasos, fallo a medias con "Reintentar", flujo sin respuesta, chat en pantalla antes de su contexto y precalentamiento una sola vez al tocar el botón. Los tests anteriores del chat siguen en verde sin tocarlos: el chat acepta también una respuesta JSON entera.

- [x] T9 Medidas después, recorrido y cierre
  Hecho cuando: `results/despues.json`, la tabla en la spec, el recorrido de CA-4 y P8 con `test:db` en verde. Cubre: todos | Módulo: documentación
  Evidencia (2026-11-15): tabla "Medidas después" y "Objetivos" en la spec, con lo cumplido y lo no cumplido. Recorrido en el iPhone emulado (`.scratch/ca4.mjs`, no versionado): mes 6 → y 6 ← con 6 peticiones (todas precargas en reposo), semana y día con 0; un evento insertado desde fuera aparece en 805 ms por el canal de tiempo real. P8: typecheck sin errores, lint 0 errores y 1 aviso previo (`window.location.assign` de la spec 012), format:check limpio, `npm test` 281 archivos y 2.677 tests, build correcto. `npm run test:db -- --no-file-parallelism` contra el Supabase local: 48 archivos y 537 tests en verde (en la primera pasada falló una vez `live-changes`, el intermitente conocido; repetido, en verde).

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T2, T3 |
| RF-2, RF-5, RF-7, RF-11 | T4 |
| RF-3, RF-4, RF-6 | T2, T4 |
| RF-8, RF-9, RF-10 | T3 |
| RF-12, RF-13 | T5 |
| RF-14, RF-15 | T6 |
| RF-16, RF-18 | T7, T8 |
| RF-17, RF-19, RF-20 | T8 |
| RNF-1 a RNF-7 | T9 |
