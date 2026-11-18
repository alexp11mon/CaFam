# Tasks 036 — Venito crea y edita eventos

Spec: `specs/036-venito-crea-y-edita/spec.md`. Plan: `specs/036-venito-crea-y-edita/plan.md` (la spec la aprobó el usuario el 2026-11-17 y el plan y las tareas, de antemano, el mismo día).

> Estado: **en curso**.

Cada tarea se hace sola y con el test primero (rojo → verde). Se cierra con la verificación de P8 en verde y su salida reportada:
`npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, y además `npm run test:db` en T4 y T5. Sin migraciones ni dependencias nuevas.

## Tareas

- [x] T1 Intención de escribir y calendario por su nombre
  Hecho cuando: `npm test -- assistant-write-intent assistant-calendar-match` en verde.
  - `wantsWrite`: verbos de crear y cambiar, seguimiento tras una pregunta de Venito (como mucho 3 mensajes atrás) y nunca por texto de Venito o de lectura.
  - `isYes` e `isNo`.
  - `matchCalendar`: sin mayúsculas ni tildes, una parte del nombre, un correo, exacto antes que parcial, ambiguo, no encontrado, de solo lectura con su motivo, sin nombre con uno o varios escribibles, y ninguno escribible.

  Cubre: RF-18 a RF-23, RF-24a, RF-24b, RF-40, RF-45 | Módulo: write-intent, calendar-match (D2, D5)
  Evidencia (2026-11-18): `assistant-write-intent` (34) y `assistant-calendar-match` (10) en verde, primero en rojo (módulos inexistentes). El seguimiento acepta una pregunta de Venito con "?" en cualquier sitio, porque las preguntas del servidor acaban con las opciones ("¿En qué calendario…? Puedes elegir: …"). P8 en verde: typecheck (tras `next typegen`), lint 0 errores (1 aviso previo), format:check, `npm test` 290 archivos y 2.831 tests, build.
- [x] T2 Evento de referencia y horas resultantes
  Hecho cuando: `npm test -- assistant-event-pick assistant-write-times` en verde.
  - `pickEvent`: exacto antes que parcial, por día, el próximo que no ha terminado (también en curso y repeticiones), ambiguo el mismo día y no encontrado.
  - `resolveTimes`:
    - Anclas: "al acabar" y "antes de".
    - Horas fijas, duración de Ajustes y duración del evento al editar.
    - Errores: fin anterior al inicio con las dos horas, ancla de todo el día, falta la hora y falta la fecha.
    - Días completos y cambio de hora en Europe/Madrid.

  Cubre: RF-4 a RF-16, RF-26 | Módulo: event-pick, write-times
  Evidencia (2026-11-18): `assistant-event-pick` (9) y `assistant-write-times` (17) en verde, primero en rojo (módulos inexistentes). Añadido: sin fecha y sin ninguno por delante, `pickEvent` toma el último pasado, para que "cambia la cena" encuentre la de ayer (anotado en el plan, D14). P8 en verde: typecheck, lint 0 errores (1 aviso previo), format:check, `npm test` 292 archivos y 2.857 tests, build.
- [x] T3 Contratos: argumentos, herramientas, prompt, flujo y tarjetas
  Hecho cuando: `npm test -- assistant-write-schemas assistant-core assistant-stream assistant-suggestions` en verde.
  - Esquemas de `create_events` y `propose_changes` (1–3; 4 → error).
  - `WRITE_TOOL_DEFINITIONS`.
  - Prompt con y sin escritura: sin "No puedo crear", con la regla de borrar y los calendarios escribibles.
  - `describeAction`.
  - Línea `action`, `done.actions` y estados "Creando «…»…".
  - Sugerencia "Crear un evento".

  Cubre: RF-17, RF-31, RF-41, RF-46, RF-47 | Módulo: schemas, tool-definitions, prompt, actions, stream, suggestions
  Evidencia (2026-11-18): `assistant-write-schemas` (14) y los casos nuevos de `assistant-core` (5), `assistant-stream` (2) y `assistant-suggestions` en verde, primero en rojo. El chat solo cambia el tipo de línea (las acciones se pintan en la T7) y sus dos tests cuentan la sugerencia nueva. Las herramientas admiten `null` en cada campo (`["string","null"]`), porque Groq rechaza con `tool_use_failed` una llamada que no cumple el esquema. P8 en verde: typecheck, lint 0 errores (1 aviso previo), format:check, `npm test` 293 archivos y 2.876 tests, build.
- [x] T4 Crear eventos desde el asistente
  Hecho cuando: `npm test -- assistant-writes` (dependencias simuladas) y `npm run test:db -- assistant-writes` en verde.
  - Crea con hora fija y al acabar otro evento, en el calendario nombrado.
  - Como Lector da `read_only` con su motivo, y nada se crea.
  - Ambiguo y no encontrado.
  - 4 eventos dan `too_many` sin crear ninguno, y una segunda llamada que pase de 3 también.
  - Con la señal cancelada no se escribe.
  - En un calendario traído escribe primero en el proveedor (simulado) y su fallo se devuelve con `notice`.

  Cubre: RF-1 a RF-23, RF-39, RF-41, RF-42, RF-44 | Módulo: assistant-writes, tools (D1, D3)
  Evidencia (2026-11-18): `assistant-writes` (14, unitarios con dependencias simuladas) en verde, primero en rojo (módulo inexistente). `npm run test:db -- assistant proposed` en verde contra un Supabase local (4 archivos, 42 tests: `assistant-writes` 5 nuevos, más `assistant-tools`, `assistant` y `proposed-events` tras extraer `findEventsByTitle`/`toFound` de `search_events`). La semilla de la serie necesitó `BYDAY`: una regla semanal sin él no da repeticiones (la app siempre lo escribe). P8 en verde: typecheck, lint 0 errores (1 aviso previo), format:check, `npm test` 294 archivos y 2.890 tests, build.
- [x] T5 Preparar, confirmar y deshacer cambios
  Hecho cuando: `npm test -- assistant-write-actions` y `npm run test:db -- assistant-writes` en verde.
  - `proposeChanges` no escribe y devuelve antes y después (con la duración conservada al mover) y la pérdida de una serie.
  - Sin permiso, `forbidden`; un destino fuera de `moveTargets`, rechazado.
  - `confirmChange` aplica el cambio, y no lo aplica si cambió el `updated_at`.
  - Repetición con "Solo este evento" por defecto y "Todos" si se pide.
  - `undoAssistantAction` deshace una creación y un cambio, y no lo hace si el evento cambió entretanto.

  Cubre: RF-24 a RF-30, RF-33 a RF-37, RF-39 | Módulo: assistant-writes, write-actions (D4, D7, D8, D9)
  Evidencia (2026-11-18): `assistant-writes` (8 nuevos de `propose_changes`) y `assistant-write-actions` (5) en verde, primero en rojo. `npm run test:db -- assistant proposed` en verde contra Supabase local (4 archivos, 47 tests; `assistant-writes` con 5 nuevos): nada se escribe hasta confirmar, se aplica y se deshace, un cambio ajeno entre medias impide aplicarlo, una sola repetición de PIAE (excepción creada y deshecha), una creación se deshace salvo si alguien la tocó, y un Lector no puede confirmar. La lógica de confirmar y deshacer vive en `change-writes.ts` (sin `"use server"`) y las acciones en `write-actions.ts`; `seriesValues` de `quick-writes.ts` pasa a exportarse. Las series de prueba usan la regla canónica (`INTERVAL=1`): con otra, `planSeriesChange` cree que cambió la regla. P8 en verde: typecheck, lint 0 errores (1 aviso previo), format:check, `npm test` 295 archivos y 2.903 tests, build.
- [ ] T6 Bucle y ruta con escritura
  Hecho cuando: `npm test -- assistant-run assistant-route` en verde.
  - Sin intención no se ofrecen las herramientas de escritura; con ella, sí, y el prompt de escritura.
  - Una ronda con escritura va en serie.
  - El `notice` de un fallo llega a la respuesta.
  - La ruta emite líneas `action` en cuanto ocurren y `done.actions`, pasa la señal y cuenta la pregunta una vez.
  - Un comentario que pide crear no ofrece la escritura (la intención solo sale de mensajes del usuario).

  Cubre: RF-40, RF-42, RF-43, RF-44, RF-46 | Módulo: run, route (D2, D6, D12)
- [ ] T7 Tarjetas en el chat
  Hecho cuando: `npm test -- assistant-action-card assistant-chat-actions` en verde.
  - Tarjeta de evento creado con su referencia, "Abrir" y "Deshacer", y el estado "Deshecho".
  - Tarjeta de cambio con "Ahora" y "Quedará", "Confirmar" y "Cancelar", y los estados aplicado, cancelado y sustituido.
  - "sí" y "no" sin llamar a la API.
  - Otro texto cancela o sustituye.
  - Resumen de las tarjetas en el hilo enviado.
  - Al cancelar con acciones ya recibidas, se conservan.
  - `onChanged` tras escribir.
  - Etiquetas para lectores de pantalla y botones de 44 px.

  Cubre: RF-17, RF-24 a RF-24d, RF-32 a RF-38, RF-44, RF-45 | Módulo: action-card, assistant-chat, assistant-fab (D5, D10, D11, D12)
- [ ] T8 Privacidad
  Hecho cuando: `npm test -- privacy` en verde con la frase nueva de la sección del asistente. Cubre: RF-48 | Módulo: privacy
- [ ] T9 Evaluación de escritura
  Hecho cuando: `tests/assistant-eval/questions.ts` tiene al menos 12 peticiones de escritura con sus comprobaciones:
  - Crear con hora fija y relativa, y con el calendario por nombre o por correo.
  - Editar la hora, el día, el título y el calendario, y una repetición.
  - Preguntar el calendario y la hora.
  - Negarse a borrar.
  - Inyección en un comentario.

  `scripts/assistant-eval.ts` las siembra y comprueba las acciones y que nada indebido se escribe. `npm run typecheck` en verde. **La ejecución contra Groq la hace el usuario** (no hay `GROQ_API_KEY` en esta sesión). Cubre: RNF de calidad | Módulo: assistant-eval
- [ ] T10 Capturas, recorrido y documentación
  Hecho cuando:
  - Capturas de las dos tarjetas a 390, 768 y 1440 px en claro y oscuro en `specs/036-venito-crea-y-edita/capturas/`, con el chat simulado, sin Groq.
  - `AGENTS.md` y `README.md` al día.
  - P8 completa y `npm run test:db` entero en verde.

  Cubre: RNF de accesibilidad | Módulo: documentación
