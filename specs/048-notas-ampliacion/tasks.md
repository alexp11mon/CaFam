# Tasks 048 — Ampliación de Notas

Spec: `specs/048-notas-ampliacion/spec.md`. Plan: `specs/048-notas-ampliacion/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1, T4 y T5.

## Tareas

- [x] T1 Esquema
  Hecho cuando: `npm run test:db -- notes` en verde (028 y nuevos): fechas por elemento, `position` fraccionaria, `event_id` de otro calendario → error, borrar el evento desvincula, `calendar_tasks` con RLS.

  Cubre: RF-1, RF-5, RF-8, RF-11 | Evidencia: 2026-11-25, migración `20261129100000_notes_more` aplicada en dev y tipos regenerados; `npm run test:db -- notes` 22/22 (`notes-more`: fecha y hora por elemento, hora sin fecha rechazada, `position` fraccionaria, evento de otro calendario → `22023`, evento ajeno → `CF404`, borrar el evento desvincula, `calendar_tasks` con RLS y calendarios ocultos, `show_tasks` apagado); P8 completa (3.799 tests, build OK). La FK de `event_id` es simple con un trigger (`notes_event_rules`) en lugar de compuesta: compuesta con `on delete set null` vaciaría también `calendar_id`.
- [x] T2 Fecha límite por elemento
  Hecho cuando: `npm test -- notes-due item-due-menu checklist` en verde y capturas a 390 px en claro y oscuro.

  Cubre: RF-1, RF-2 | Evidencia: 2026-11-25, `npm test -- notes-due item-due-menu notes-ui offline-note-editor` 62/62; P8 completa (3.816 tests, build OK). Capturas a 390 px en claro y oscuro en `capturas/` (`lista-con-fechas`, `menu-fecha`, `tarjeta-proxima-fecha`); la captura mostró que la fecha estrechaba el texto y el menú se salía por la izquierda: la fecha va debajo del texto y el menú se ancla a la fila. Desviación: la fecha se pone desde el botón de calendario de cada elemento (Hoy, Mañana, Próxima semana, otra fecha y hora); el gesto de deslizar en el móvil no se ha hecho.
- [x] T3 Reordenar con ratón, dedo y teclado
  Hecho cuando: `npm test -- notes-order use-item-drag checklist` en verde: arrastre, mantener pulsado, Alt+flechas con anuncio, posición entre dos y renumerado.

  Cubre: RF-3 a RF-5, RNF-1 | Evidencia: 2026-11-25, `npm test -- notes-order use-item-drag notes-ui` en verde (`placeItem` escribe una fila entre dos y renumera sin hueco; arrastre con ratón al instante, dedo tras 300 ms, dedo rápido = desplazar; Alt+↑/↓ en el asa con "Movido a la posición 2 de 2"); P8 completa (3.823 tests, build OK). Prueba real en Edge (`next start`): arrastrar "Crema" al principio con ratón a 1440 px y manteniendo pulsado con el dedo (eventos táctiles CDP) a 390 px, el orden queda guardado; capturas `arrastrando-*`. El asa sustituye a los botones Subir/Bajar; el teclado sigue intercambiando con el vecino (dos filas).
- [x] T4 Vencimientos en el calendario
  Hecho cuando: `npm test -- task-block calendar-filters week-view month-view agenda-view` y `npm run test:db -- calendar-tasks` en verde; capturas a 390 y 1440 px.

  Cubre: RF-6 a RF-8 | Evidencia: 2026-11-25, `npm test -- task-block calendar-filters week-view month-view agenda-view` en verde (bloque con casilla y enlace a la nota, franja de día completo, pie de la celda del mes con "+N", día de la agenda, interruptor "Tareas con fecha" en los filtros); `npm run test:db -- calendar-tasks` 2/2 (interruptor propio, completar quita la tarea y Deshacer la devuelve, nadie ve las personales de otro); P8 completa (3.831 tests, build OK). Prueba real en Edge: marcar "Pan" en el calendario lo guarda hecho y "Deshacer" lo devuelve. Capturas `tareas-*` a 390 y 1440 px. Límite conocido: la agenda solo pinta días con eventos, así que una tarea en un día sin eventos solo se ve en semana, día y mes. Completar desde el calendario pasa por `updateItemOrQueue` (también sin conexión).
- [x] T5 Notas de un evento
  Hecho cuando: `npm test -- event-notes note-form event-panel` y `npm run test:db -- notes-event` en verde (repetición materializada).

  Cubre: RF-9 a RF-11 | Evidencia: 2026-11-25, `npm test -- event-notes notes-actions event-panel` en verde (sección "Notas" con progreso y "Añadir nota", formulario con "De: …" y el evento en un campo oculto, `createNote` vincula y materializa una repetición; si no puede, no escribe); `npm run test:db -- notes-event` 1/1 (la repetición materializada tiene su nota, la serie no; borrar la serie desvincula); P8 completa (3.835 tests, build OK). Prueba real en Edge: desde el detalle, "Añadir nota" crea "Qué llevar" compartida en el calendario del evento, la nota muestra "De: Cena con Ana · 10 dic" y el detalle la lista; capturas `nota-de-evento*`, `evento-con-notas-*`. La sección solo aparece con conexión, como los comentarios.
- [x] T6 Notas desde Venito
  Hecho cuando: `npm test -- notes-match assistant-note-writes assistant-core` en verde y `EVAL_ONLY` con las 5 preguntas nuevas contra Groq (una ejecución).

  Cubre: RF-12 a RF-14, RNF-3 | Evidencia: 2026-11-25, `npm test -- notes-match assistant-note-writes assistant-core assistant-action-card` en verde (`matchNote` sin tildes ni mayúsculas, ambigua o no encontrada; `create_notes` personal o compartida solo donde puede escribir, `add_note_items` al final de la lista, cuentan en los 3 cambios por mensaje; "Deshacer" quita solo los elementos añadidos o la nota creada si nadie la cambió; tarjeta "Añadido a la nota" con "Abrir" y "Deshacer"); `list_notes` de solo lectura; P8 completa (3.845 tests, build OK). Eval contra Groq con `EVAL_PART=notes` (5 preguntas nuevas en `tests/assistant-eval/note-questions.ts`): primera ejecución 4/5 (N5 sin respuesta por un timeout de Groq; N4 acertó pero dejaba ver un aviso interno, que se quitó); segunda ejecución solo de N4–N5 (`EVAL_ONLY=4-5`), 2/2; ninguna escritura indebida.
- [x] T7 Sin conexión
  Hecho cuando: `npm test -- offline-describe offline-flush offline-sw-sync` en verde con los casos nuevos en `offline-flush-cases.ts`.

  Cubre: RF-15 | Evidencia: 2026-11-25, `npx vitest run --project unit offline-describe offline-flush offline-sw-sync offline-schemas` 49/49 y P8 (3850 tests, build). Fechas, orden fraccionario y completar desde el calendario ya iban por la cola; `note.create` lleva `eventId` (repeticiones materializadas en el servidor) y un evento rechazado nunca se lleva la nota. Una hora sin fecha solo la rechaza la base de datos (23514), que conoce la fecha guardada.
- [x] T8 Cierre
  Hecho cuando: AGENTS.md (§11 y sección de la spec), README y constitución actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: 2026-11-25, AGENTS.md (tabla, migración `notes_more` pendiente en prod, §11), README y constitución; `python -m graphify update .`; P8 en verde (3850 tests, build).

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2 | T1, T2 |
| RF-3 a RF-5 | T1, T3 |
| RF-6 a RF-8 | T4 |
| RF-9 a RF-11 | T5 |
| RF-12 a RF-14 | T6 |
| RF-15 | T7 |
