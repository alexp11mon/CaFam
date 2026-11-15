# Tasks 024 — Rendimiento en el iPhone

Spec: `specs/024-rendimiento/spec.md`. Plan: `specs/024-rendimiento/plan.md` (los dos aprobados de antemano por el usuario en el prompt de arranque, 2026-11-15).

> Estado: **en curso**.

Cada tarea se hace sola y con el test primero (rojo → verde), y se cierra con la verificación de P8 en verde y su salida reportada. `npm run test:db` en las que tocan el acceso a datos (T3, T9). Sin migraciones ni dependencias.

## Tareas

- [ ] T1 Arnés de medición y línea de base
  Hecho cuando: `scripts/perf/` tiene el proxy con latencia, el Groq simulado, `measure.mjs`, `paint.mjs` y un README, y `results/antes.json` está en el repositorio con las medidas de la spec. Cubre: CA-1 | Módulo: `scripts/perf`

- [ ] T2 Lógica pura de la ventana de eventos
  Hecho cuando: `npm test -- event-window` en verde: `serverWindow` (cubre mes anterior y siguiente y los 42 días de la agenda), `visibleDayRange`, `warmRange`, `planLoad` (cubierto, extender por un lado, por los dos, sustituir, tope de 124 días), `mergeWindow` (sin repetidos, gana lo nuevo), `trimWindow` (≤ 400 días alrededor de lo visible) y `eventsInRange`. Cubre: RF-1, RF-3, RF-4, RF-6 | Módulo: `event-window`

- [ ] T3 El servidor lee una ventana y el perfil una vez
  Hecho cuando: la página lee `getCalendarProfile`, la ventana y las categorías sin cascada; `loadCalendarWindow` y `loadBusy` validan fechas y tope de días; tests unitarios de las acciones y `test:db` en verde. Cubre: RF-1, RF-8, RF-9, RF-10 | Módulo: `page`, `window-actions`, `queries`, `load-range`

- [ ] T4 Navegación en el navegador
  Hecho cuando: `npm test -- calendar-nav calendar-client use-event-window` en verde: `go` cambia vista y fecha sin `router.push` y escribe la dirección; `popstate` las recupera; props nuevas del servidor sustituyen la ventana; un periodo sin cargar pide la acción una vez y marca `aria-busy`; en reposo se precarga el contiguo; una respuesta vieja se descarta. Los enlaces de las vistas usan `CalendarLink`. Cubre: RF-2, RF-3, RF-4, RF-5, RF-7, RF-11 | Módulo: `calendar-nav`, `calendar-client`, `use-event-window`, vistas

- [ ] T5 Deslizar sobre la rejilla y agenda sin repintar
  Hecho cuando: la rejilla lleva `touch-pan-y` (test de la clase) y los tramos de la agenda están memorizados (test: al llegar un tramo nuevo, los días ya pintados no se vuelven a renderizar). Cubre: RF-12, RF-13 | Módulo: `time-grid`, `agenda-view`

- [ ] T6 Menos JS al abrir
  Hecho cuando: el cliente de Supabase se importa de forma diferida en el tiempo real y las piezas de RF-15 con `lazy()`; los tests existentes siguen en verde y `measure.mjs` muestra la bajada. Cubre: RF-14, RF-15 | Módulo: `use-live-calendar`, `calendar-workspace`, `event-block`, `assistant-chat`

- [ ] T7 Protocolo de progreso del asistente
  Hecho cuando: `npm test -- assistant-stream assistant-run` en verde: `encodeLine`/`readLines` (líneas partidas entre trozos), `statusFor` por herramienta, `runAssistant` avisa de cada paso y ejecuta en paralelo las herramientas de una ronda conservando el orden de los resultados. Cubre: RF-16, RF-18 | Módulo: `stream`, `run`

- [ ] T8 Ruta en streaming y chat con progreso
  Hecho cuando: `npm test -- assistant-route assistant-chat` en verde: la ruta responde NDJSON con `status` y `done`, conserva 400/401/429 y manda `error` si falla después; `GET` responde 204; el chat pinta el progreso, lo anuncia, cancela y reintenta como antes; la página pinta el campo sin esperar datos. Cubre: RF-16, RF-17, RF-19, RF-20 | Módulo: `route`, `assistant-chat`, `assistant/page`

- [ ] T9 Medidas después, recorrido y cierre
  Hecho cuando: `results/despues.json` cumple RNF-1 a RNF-5, la tabla está en la spec, el recorrido de CA-4 está hecho y P8 con `test:db` en verde. Cubre: todos | Módulo: documentación

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
