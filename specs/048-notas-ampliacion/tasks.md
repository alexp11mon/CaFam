# Tasks 048 — Ampliación de Notas

Spec: `specs/048-notas-ampliacion/spec.md`. Plan: `specs/048-notas-ampliacion/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1, T4 y T5.

## Tareas

- [x] T1 Esquema
  Hecho cuando: `npm run test:db -- notes` en verde (028 y nuevos): fechas por elemento, `position` fraccionaria, `event_id` de otro calendario → error, borrar el evento desvincula, `calendar_tasks` con RLS.

  Cubre: RF-1, RF-5, RF-8, RF-11 | Evidencia: 2026-11-25, migración `20261129100000_notes_more` aplicada en dev y tipos regenerados; `npm run test:db -- notes` 22/22 (`notes-more`: fecha y hora por elemento, hora sin fecha rechazada, `position` fraccionaria, evento de otro calendario → `22023`, evento ajeno → `CF404`, borrar el evento desvincula, `calendar_tasks` con RLS y calendarios ocultos, `show_tasks` apagado); P8 completa (3.799 tests, build OK). La FK de `event_id` es simple con un trigger (`notes_event_rules`) en lugar de compuesta: compuesta con `on delete set null` vaciaría también `calendar_id`.
- [ ] T2 Fecha límite por elemento
  Hecho cuando: `npm test -- notes-due item-due-menu checklist` en verde y capturas a 390 px en claro y oscuro.

  Cubre: RF-1, RF-2 | Evidencia: —
- [ ] T3 Reordenar con ratón, dedo y teclado
  Hecho cuando: `npm test -- notes-order use-item-drag checklist` en verde: arrastre, mantener pulsado, Alt+flechas con anuncio, posición entre dos y renumerado.

  Cubre: RF-3 a RF-5, RNF-1 | Evidencia: —
- [ ] T4 Vencimientos en el calendario
  Hecho cuando: `npm test -- task-block calendar-filters week-view month-view agenda-view` y `npm run test:db -- calendar-tasks` en verde; capturas a 390 y 1440 px.

  Cubre: RF-6 a RF-8 | Evidencia: —
- [ ] T5 Notas de un evento
  Hecho cuando: `npm test -- event-notes note-form event-panel` y `npm run test:db -- notes-event` en verde (repetición materializada).

  Cubre: RF-9 a RF-11 | Evidencia: —
- [ ] T6 Notas desde Venito
  Hecho cuando: `npm test -- notes-match assistant-note-writes assistant-core` en verde y `EVAL_ONLY` con las 5 preguntas nuevas contra Groq (una ejecución).

  Cubre: RF-12 a RF-14, RNF-3 | Evidencia: —
- [ ] T7 Sin conexión
  Hecho cuando: `npm test -- offline-describe offline-flush offline-sw-sync` en verde con los casos nuevos en `offline-flush-cases.ts`.

  Cubre: RF-15 | Evidencia: —
- [ ] T8 Cierre
  Hecho cuando: AGENTS.md (§11 y sección de la spec), README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2 | T1, T2 |
| RF-3 a RF-5 | T1, T3 |
| RF-6 a RF-8 | T4 |
| RF-9 a RF-11 | T5 |
| RF-12 a RF-14 | T6 |
| RF-15 | T7 |
