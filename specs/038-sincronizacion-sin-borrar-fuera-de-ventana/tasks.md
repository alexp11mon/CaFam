# Tasks 038 — La sincronización no borra lo que queda fuera de la ventana

Spec: `specs/038-sincronizacion-sin-borrar-fuera-de-ventana/spec.md`. Plan: `specs/038-sincronizacion-sin-borrar-fuera-de-ventana/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero (rojo → verde). Se cierra con P8 en verde y su salida: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, y `npm run test:db` en T1.

## Tareas

- [ ] T1 `sync_apply_events` con ventana y conservados
  Hecho cuando: `npm run test:db -- sync-worker` en verde con los casos nuevos.
  - Migración `sync_apply_window` y `npm run db:push` + `npm run db:types`.
  - Tests nuevos en `tests/integration/sync-worker.test.ts`: un evento antes de la ventana, uno después, uno que cruza el borde (sí se borra si no viene), uno dentro (sí se borra), uno omitido en `p_keep` (no se borra), y sin `p_from` se borra como antes. El resumen no cuenta los conservados.
  - Un evento antiguo con imagen y comentario conserva ambos.

  Cubre: RF-1 a RF-5, RF-8 | Módulo: migración (D1, D2, D3, D5)
  Evidencia: —
- [ ] T2 El motor pasa la ventana y los omitidos
  Hecho cuando: `npm test -- run-sync limit-events` en verde.
  - `limitEvents` devuelve `omittedIds`.
  - `syncCalendars` llama a `sync_apply_events` con `p_from`, `p_to` (los mismos que `listEvents`) y `p_keep`.

  Cubre: RF-1, RF-3 | Módulo: limit-events, run-sync
  Evidencia: —
- [ ] T3 Nota de copia antigua en el detalle
  Hecho cuando: `npm test -- sync-window event-panel` en verde y capturas a 390 y 1440 px en claro y oscuro en `capturas/`.
  - `isOutsideWindow` (borde exacto incluido) y `staleCopyText` para Google e iCloud.
  - El detalle de un traído antiguo muestra la nota; uno reciente y uno normal, no.

  Cubre: RF-6, RF-7, RF-9 | Módulo: window, provider-labels, event-panel (D4)
  Evidencia: —
- [ ] T4 Cierre
  Hecho cuando: AGENTS.md (§2, "Añadido por la spec 038", base de datos y trampas), README (hoja de ruta y fuera de alcance) y "Diferido" de la 023 citan la 038; `python -m graphify update .`; P8 completa.

  Cubre: todos | Evidencia: —

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-5 | T1, T2 |
| RF-6, RF-7 | T3 |
| RF-8 | T1 |
| RF-9 | T3 (comprobación manual) |
