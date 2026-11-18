# Plan 036 — Venito crea y edita eventos

Spec de origen: `specs/036-venito-crea-y-edita/spec.md` (aprobada el 2026-11-17). Constitución: `docs/constitution.md`.

> Estado: **aprobado de antemano** por el usuario (2026-11-17: "prepara el plan y las tasks y sin que tenga que yo aprobar"). Sin migraciones ni dependencias nuevas.

## Resumen de arquitectura

Se amplía el bucle de herramientas de la 015 con **dos herramientas de escritura**, que solo se ofrecen al modelo cuando el último mensaje del usuario pide crear o cambiar algo (o responde a una pregunta de Venito dentro de esa petición):

- `create_events`: crea en el acto entre 1 y 3 eventos.
- `propose_changes`: prepara entre 1 y 3 cambios **sin escribir nada**.

El modelo solo nombra cosas: el título del evento de referencia, el nombre del calendario, las horas de pared. **Todo lo que decide qué se escribe lo calcula el servidor** con funciones puras y la sesión del usuario: qué evento es "PIAE", qué calendario es "alexponmon@gmail.com", las horas resultantes y los permisos.

Lo escrito o propuesto vuelve al navegador como **acciones** en el flujo NDJSON de la 024 (línea nueva `action`, en cuanto ocurre) y se pinta como una tarjeta en el hilo:

- **Evento creado**: con "Abrir" y "Deshacer".
- **Cambio pendiente**: con "Confirmar" y "Cancelar".

Confirmar, deshacer y cancelar son Server Actions que reutilizan las escrituras del formulario (`createSingle`, `updateSingle`, `changeOccurrence`, `deleteSingle`). Por tanto pasan por RLS y, en los traídos, primero por Google o iCloud.

```
AssistantChat ── hilo (+ resumen de tarjetas) ──▶ POST /api/assistant
   │  "sí"/"no" con un cambio pendiente: sin LLM ─┐      │ wantsWrite(hilo) → herramientas de escritura
   │                                              │      ▼
   │                                              │  runAssistant ── Groq ── create_events / propose_changes
   │                                              │      │   assistant-writes.ts (servidor, sesión):
   │                                              │      │   findTargets → pickEvent · matchCalendar · resolveTimes
   │                                              │      │   create: createSingle (proveedor primero)  propose: nada
   │◀── líneas status · action · done ────────────┼──────┘
ActionCard ── Deshacer / Confirmar / Cancelar ──▶ write-actions.ts ("use server")
   └── router.refresh() (en el marco) ─▶ el calendario se actualiza (RF-38)
```

## Módulos y responsabilidades

**Puros (`src/lib/assistant/`, testeados sin servidor)**

- `write-intent.ts`. Cubre: RF-40, RF-45, RF-24a, RF-24b.
  - `wantsWrite(thread)`: decide si se ofrecen las herramientas de escritura. Hace falta un verbo de crear o cambiar en el último mensaje del usuario, o en uno anterior de la misma petición si Venito ha estado preguntando entre medias (respuestas que acaban en "?", como mucho 3 mensajes atrás).
  - `isYes(text)` e `isNo(text)`: respuestas breves a un cambio pendiente.
- `calendar-match.ts`: `matchCalendar(name, calendars)`. No distingue mayúsculas ni tildes, acepta una parte del nombre o un correo y prefiere la coincidencia exacta. Responde `ok`, `ambiguous`, `not_found`, `read_only` (con el motivo de `readOnlyReason`), `need_calendar` (con opciones) o `no_writable`. Sin nombre y con un solo calendario escribible, ese. Cubre: RF-18 a RF-23.
- `event-pick.ts`: `pickEvent(candidates, {query, date, now, timeZone})`. Prefiere los títulos exactos a los que solo contienen la búsqueda. Con fecha, los de ese día; sin fecha, el primero que no ha terminado desde `now`. Varios el mismo día da `ambiguous`; ninguno, `not_found`. Cubre: RF-12 a RF-15, RF-24.
- `write-times.ts`: `resolveTimes(input, {base, after, before, timeZone, defaultMinutes})` calcula las horas de un evento nuevo o cambiado.
  - Ancla: `after` es el fin del evento de referencia y `before` su inicio. Un ancla de todo el día da `anchor_all_day`.
  - Lo que no se da: la duración de Ajustes al crear (RF-4) o la del evento al editar (RF-26).
  - Errores: `end_before_start` con las dos horas (RF-8), `need_time` (RF-5) y `need_date`.

  Devuelve instantes UTC; los de todo el día, de 00:00 a 00:00 UTC (spec 002 D6). Cubre: RF-4 a RF-11, RF-16, RF-26.
- `actions.ts`: tipos `AssistantAction` (`created`, `change`) y `ActionEvent` (lo que pinta la tarjeta), y `describeAction` (texto para lectores de pantalla y resumen que vuelve al modelo en el hilo). Cubre: RF-17, RF-32.
- `schemas.ts` (cambia): `createEventsArgsSchema` y `proposeChangesArgsSchema` (de 1 a 3 elementos, RF-41), más el esquema de una acción confirmada o deshecha.
- `tool-definitions.ts` (cambia): `WRITE_TOOL_DEFINITIONS`.
- `prompt.ts` (cambia): las reglas de escribir solo con `canWrite`, la regla de borrar (RF-31: buscar y citar), los calendarios escribibles por nombre y sin la frase "No puedo crear…".
- `stream.ts` (cambia): línea `{type: "action", action}`, `done.actions` y estados "Creando «…»…" y "Preparando el cambio…". Cubre: RF-46.
- `suggestions.ts` (cambia): sugerencia "Crear un evento" de tipo `fill`. Cubre: RF-47.

**Servidor**

- `app/dashboard/assistant/assistant-writes.ts` (nuevo, sin `"use server"`): `writeTools(ctx)` con `createEvents` y `proposeChanges`. Cubre: RF-1 a RF-30, RF-39 a RF-44.
  - Lee los calendarios una vez por pregunta (`getMyCalendars`) y la duración de Ajustes (`getViewOptions`).
  - Busca los eventos por título (`findByTitle`, la misma lectura de series de `search_events`) y aplica las funciones puras.
  - `createEvents` comprueba `signal.aborted` antes de cada escritura y escribe con `createSingle`.
  - `proposeChanges` lee el evento con `getEvent`, comprueba `canWriteEvents` y `moveTargets`, calcula la pérdida de una serie con `series_loss` y devuelve el cambio pendiente con el `updated_at` de la fila.
  - Lleva un contador de escrituras por pregunta (3 como mucho).
- `app/dashboard/assistant/write-actions.ts` (nuevo, `"use server"`): `confirmChange(change)`, `undoAssistantAction(token)` y `cancelChange()` (no escribe). Cubre: RF-24a, RF-24d, RF-29, RF-30, RF-33 a RF-37.
  - Validan con zod y la sesión, leen la zona del perfil y comparan `updated_at` antes de escribir (RF-24d, RF-36).
  - Escriben con `updateSingle` o `changeOccurrence` y deshacen con `deleteSingle` o devolviendo los valores anteriores.
- `lib/assistant/tools.ts` (cambia): `runTool` despacha `create_events` y `propose_changes` a `ctx.writes` si existe; si no, `unknown_tool`. Se extrae la lectura de coincidencias de `searchEvents` para reutilizarla al buscar por título.
- `lib/assistant/run.ts` (cambia): ofrece las herramientas de escritura según `wantsWrite`, pasa `canWrite` al prompt y deja de ejecutar en paralelo una ronda que escribe (ver D6).
- `app/api/assistant/route.ts` (cambia): monta `writeTools` con la sesión, emite cada acción como línea `action` y la repite en `done.actions`, y pasa `request.signal`. Sube `maxDuration` a 60 s solo si hace falta (ya está en 60).

**Navegador**

- `components/assistant/action-card.tsx` (nuevo). Cubre: RF-17, RF-24 a RF-24d, RF-32 a RF-37.
  - Tarjeta de un evento creado: título, fecha y horas, calendario con su color, la referencia "Al acabar PIAE · jue 19, 12:00–13:30", "Abrir" y "Deshacer". Estados `done`, `undone` y `failed`.
  - Tarjeta de un cambio: "Ahora" y "Quedará", la pérdida de la serie, "Confirmar" y "Cancelar". Estados `pending`, `applied`, `cancelled`, `superseded`, `undone` y `failed`.
- `components/assistant/assistant-chat.tsx` (cambia). Cubre: RF-24a a RF-24c, RF-38, RF-44, RF-45.
  - Guarda las acciones en cada mensaje.
  - "sí"/"no" con un cambio pendiente se resuelve sin LLM.
  - Otro texto sustituye o cancela el pendiente, según llegue o no un cambio nuevo.
  - Añade al contenido del mensaje de Venito un resumen de sus tarjetas, para que "muévelo a mañana" sepa de qué evento se habla.
  - Al cancelar, conserva las acciones ya recibidas.
  - Avisa con `onChanged` tras escribir.
- `components/shell/assistant-fab.tsx` (cambia): `onChanged={() => router.refresh()}`. Cubre: RF-38.
- `app/privacy/page.tsx` (cambia): Venito crea y cambia eventos a petición, con los permisos del usuario. Cubre: RF-48.

**Calidad**

- `tests/assistant-eval/questions.ts` y `scripts/assistant-eval.ts` (cambian): 12 peticiones de escritura que comprueban las acciones devueltas y que no se escriba nada indebido. Cubre: RNF de calidad.

## Modelo de datos

**Sin migraciones.** Nada nuevo se guarda: las tarjetas viven en la conversación, en memoria (como la propuesta de la 022). Estructuras:

- Argumentos de `create_events`: `{ events: [{ title, calendar|null, date|null, start|null, end|null, endDate|null, allDay|null, durationMinutes|null, after|null, before|null, anchorDate|null, location|null, description|null }] }` (1–3).
- Argumentos de `propose_changes`: `{ changes: [{ event, eventDate|null, scope|null ("this"|"following"|"all"), title?, date?, start?, end?, endDate?, allDay?, durationMinutes?, after?, before?, anchorDate?, location?, description?, calendar? }] }` (1–3). Un campo ausente o `null` no cambia.
- `ActionEvent { id, title, startsAt, endsAt, allDay, calendarName, color, location? }`.
- `AssistantAction`:
  - `{ kind: "created", key, event: ActionEvent, anchor?: {title, startsAt, endsAt}, undo: { kind: "uncreate", id, updatedAt } }`
  - `{ kind: "change", key, before: ActionEvent, after: ActionEvent, scope, loss?: {exceptions, images, comments}, change: PendingChange }`
- `PendingChange { id, scope, updatedAt, fields: { title, description, location, calendarId, startsAt, endsAt, allDay } }`: lo que `confirmChange` escribirá. Viene del navegador, así que se vuelve a validar y a comprobar con la sesión.
- Ficha de deshacer de un cambio: `{ kind: "unchange", id, updatedAt, before: fields, series: boolean }`. Solo existe con "Solo este evento" o en un suelto (D8).

## Contratos e interfaces

- `POST /api/assistant`: el mismo cuerpo de siempre. Líneas nuevas: `{type:"action", action}` y `done.actions?: AssistantAction[]`. Los códigos 400, 401 y 429 no cambian.
- `confirmChange(change: PendingChange) → { ok: true, action, undo? } | { ok: false, error }`.
- `undoAssistantAction(token) → { ok: true } | { ok: false, error }`.
- Respuestas de las herramientas al modelo, que solo ve referencias y nombres, nunca ids:
  - Crear: `{status:"created", ref, title, date, start, end, calendar}`.
  - Cambio preparado: `{status:"proposed", …}`.
  - Errores: `{status:"ambiguous_event", options}`, `"event_not_found"`, `"ambiguous_calendar"`, `"calendar_not_found"`, `"read_only"`, `"need_calendar"`, `"need_time"`, `"need_date"`, `"anchor_all_day"`, `"end_before_start"`, `"too_many"`, `"forbidden"` y `"failed"`.
  - `end_before_start`, `read_only`, `too_many`, `forbidden` y `failed` traen `notice`, que el servidor añade a la respuesta si el modelo lo omite (mecanismo de la 015).

## Flujo principal paso a paso

1. El usuario escribe "Crea un evento que se llame Comida Uni en el calendario de alexponmon@gmail.com que empiece justo cuando acabe PIAE y acabe a las 14:30".
2. `wantsWrite` ve "Crea": `runAssistant` ofrece las 4 herramientas de lectura y las 2 de escritura, con el prompt de escritura y los nombres de los calendarios escribibles.
3. El modelo llama a `create_events` con `{title: "Comida Uni", calendar: "alexponmon@gmail.com", after: "PIAE", end: "14:30"}`.
4. El servidor:
   - `matchCalendar` encuentra el calendario de Google.
   - `findByTitle("PIAE")` + `pickEvent` dan el próximo PIAE que no ha terminado.
   - `resolveTimes` da de 13:30 a 14:30 de ese día.
   - `createSingle` escribe en Google y después en CaFam.
   - Emite la línea `action` y responde `{status:"created", ref:"e1", …}` al modelo.
5. El modelo responde "He creado Comida Uni el jueves 19 de 13:30 a 14:30, al acabar PIAE [e1]".
6. La línea `done` lleva la respuesta, el evento citado y la acción. El chat pinta la tarjeta y llama a `onChanged`, y el calendario se refresca.
7. Si el usuario pulsa "Deshacer", `undoAssistantAction({kind:"uncreate"})` comprueba que el evento sigue igual y lo borra (en Google primero).

Editar: el paso 3 es `propose_changes` y la tarjeta queda pendiente. "Confirmar" o "sí" llaman a `confirmChange`, que comprueba `updated_at` y escribe. Después la tarjeta pasa a "Cambio aplicado" con "Deshacer".

## Decisiones técnicas

- **D1 El servidor resuelve, el modelo nombra.** El modelo no recibe ids ni calcula horas relativas. Le pasa títulos y nombres al servidor, que decide con funciones puras y testeadas. Así RF-12 a RF-16 y RF-19 a RF-23 no dependen del modelo, y una búsqueda propia ahorra una ronda: "PIAE" no necesita un `search_events` previo.
- **D2 Herramientas de escritura solo con intención explícita** (`wantsWrite`). El texto de un evento, un comentario o una imagen nunca llega como mensaje del usuario, así que no puede activar la escritura (RF-40). Si el usuario no usa un verbo reconocible, el prompt de lectura le dice cómo pedirlo. La lista de verbos se prueba en unitarios y en el eval.
- **D3 Crear: un solo `create_events` por pregunta**, con un array de 1 a 3 (RF-41: con 4 o más da `too_many` y no crea ninguno). Las escrituras de la pregunta, entre creaciones y cambios, no pasan de 3. Una segunda llamada que lo superaría da `too_many`.
- **D4 Editar no escribe en el bucle.** `propose_changes` devuelve el cambio y la escritura la hace `confirmChange`, una Server Action que el usuario dispara. Así la confirmación (RF-24) no depende del modelo y no gasta cuota.
- **D5 "Sí" y "no" sin LLM.** Con un cambio pendiente, `isYes` o `isNo` sobre el texto confirman o cancelan en el navegador (RF-24a, RF-24b), sin cuota ni espera. Cualquier otro texto va al modelo. El pendiente queda "Sustituido" si llega un cambio nuevo y "Cancelado" si no (RF-24b, RF-24c).
- **D6 Rondas con escritura en serie.** Las de lectura siguen en paralelo (spec 024). Si una ronda tiene una herramienta de escritura, todas sus llamadas van en orden, para que el contador y el orden de las tarjetas sean deterministas.
- **D7 Comprobación de cambios con `updated_at`**, como el "Deshacer" de la 017 (D8 de la 017). Una repetición sin fila propia compara el `updated_at` de su serie.
- **D8 "Deshacer" en series.** Como en la 017 (D10), solo se deshace "Solo este evento" o un suelto. "Este y los siguientes" y "Todos" quedan sin "Deshacer", y la tarjeta lo dice ("Este cambio afecta a varios eventos y no se puede deshacer"). Es la única excepción a RF-33.
- **D9 Pérdida en series.** `proposeChanges` consulta `series_loss` al preparar y la tarjeta muestra lo que se perdería (RF-30). Confirmar manda `confirmLoss: true`, porque el usuario ya lo ha visto.
- **D10 Resumen de tarjetas en el hilo.** El servidor no guarda nada, así que el navegador añade al contenido del mensaje de Venito una línea por tarjeta ("[Creado: Comida Uni, jueves 19 de noviembre, 13:30–14:30, en alexponmon@gmail.com]") al enviar el hilo. Así "muévelo a mañana" y las correcciones de un cambio pendiente funcionan (RF-45, RF-24c). Esas líneas son de Venito, no del usuario: no activan `wantsWrite`.
- **D11 Refresco del calendario** con `router.refresh()` desde el marco (`onChanged`), porque lo escrito en una ruta API no revalida la vista del cliente y el tiempo real ignora los cambios propios. Confirmar y deshacer son Server Actions con `refresh()`, que refrescan por sí mismas; `onChanged` se llama igualmente.
- **D12 Cancelar.** La ruta comprueba `request.signal` antes de cada escritura (RF-44). Las líneas `action` llegan según se escriben, así que al cancelar el chat conserva las acciones recibidas en un mensaje "He parado. Esto ya estaba hecho:", en lugar de devolver la pregunta.
- **D14 Sin fecha y sin ninguno por delante** (añadida en la T2), `pickEvent` toma el último que ya pasó, para que "cambia el título de la cena" encuentre la de ayer. RF-14 sigue mandando cuando hay alguno por delante.
- **D13 Repeticiones como evento de referencia** y como evento a cambiar: se expanden con la misma lectura que `search_events` (un año atrás y uno adelante).

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1, RF-2, RF-7 | assistant-writes (`createEvents`), schemas |
| RF-3, RF-5 | prompt, write-times (`need_time`) |
| RF-4, RF-6, RF-8 | write-times |
| RF-9, RF-10, RF-11, RF-16 | write-times |
| RF-12 a RF-15 | event-pick, assistant-writes (`findByTitle`) |
| RF-17 | actions, action-card, assistant-writes |
| RF-18 a RF-23 | calendar-match, assistant-writes |
| RF-24 a RF-24d | assistant-writes (`proposeChanges`), write-actions (`confirmChange`), action-card, assistant-chat, write-intent |
| RF-25 a RF-28 | assistant-writes, write-times, read-only |
| RF-29, RF-30 | assistant-writes, write-actions (D8, D9) |
| RF-31 | prompt |
| RF-32 a RF-37 | action-card, write-actions (`undoAssistantAction`) |
| RF-38 | assistant-chat, assistant-fab (D11) |
| RF-39 | assistant-writes, write-actions (escrituras de `event-writes`) |
| RF-40 | write-intent, run, prompt (D2) |
| RF-41 | schemas, assistant-writes (D3) |
| RF-42 | assistant-writes (`notice`), run |
| RF-43 | ruta (sin cambios: cuenta la pregunta) |
| RF-44 | ruta, assistant-writes, assistant-chat (D12) |
| RF-45 | write-intent, assistant-chat (D10) |
| RF-46 | stream |
| RF-47 | suggestions |
| RF-48 | privacy |

## Riesgos y mitigaciones

- **R1 El modelo no llama a la herramienta, o mete los datos donde no van** (p. ej. "14:30" en `start`). Mitigación: descripciones cortas con un ejemplo, `requireTool` en la primera ronda como hasta ahora y el eval de escritura. El servidor rechaza combinaciones imposibles (`end_before_start`) en vez de adivinar.
- **R2 Cuota de Groq.** Las herramientas nuevas añaden unos 600 tokens por pregunta de escritura y nada a las de lectura (D2). El eval de escritura cuesta unos 25K tokens.
- **R3 Escritura indebida por inyección** (un comentario que dice "crea…"). Mitigación: D2, más el contador de 3 y la tarjeta con "Deshacer". El eval incluye un caso así.
- **R4 Un evento traído cambia entre la tarjeta y "Confirmar"** por la sincronización: D7 lo detecta y no se escribe.
- **R5 `wantsWrite` deja fuera una forma de pedirlo.** Se acepta: Venito responde cómo pedirlo y el usuario lo repite. La lista se amplía con lo que se vea en uso.

## Dudas abiertas

Ninguna. D8 deja sin "Deshacer" los cambios a varias repeticiones de una serie, coherente con la 017. Si el usuario lo quiere distinto, será otra spec.
