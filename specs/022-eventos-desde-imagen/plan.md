# Plan 022 — Eventos desde una imagen en el asistente

Spec de origen: `specs/022-eventos-desde-imagen/spec.md` (aprobada el 2026-11-09). Constitución: `docs/constitution.md`.

> Estado: **aprobado** por el usuario (2026-11-09).

## Resumen de arquitectura

Se amplía el asistente de la 015 sin crear un backend nuevo. El navegador prepara las imágenes (como en la 012, sin metadatos) y las manda en la misma petición `POST /api/assistant`, solo en el mensaje en el que se adjuntan. El modelo no crea eventos: responde con un JSON de propuesta (`propose_events`, sin herramientas; ver D3), que valida y completa el servidor (calendario, duplicados, límite de 50). La ruta devuelve una **propuesta**, que el navegador pinta como lista editable. Solo al pulsar "Crear", una Server Action escribe los eventos uno a uno con la sesión del usuario, reutilizando el camino de `pasteEvent` (Google/iCloud primero si el calendario es traído).

```
AssistantChat ── imágenes (JPEG base64, ≤ 3) + hilo + propuesta vigente ──▶ POST /api/assistant
     ▲                                                                      │ runAssistant
     │ {answer, events, proposal?}                                          ▼
     │                                                     Groq (modelo con visión) ── propose_events(args)
     │                                                                      │
     │                                         proposal.ts: valida, calendario, ≤ 50, duplicados (RLS)
ProposalCard ── editar filas ── checkProposal (acción) ── duplicados de nuevo
     └── "Crear N eventos" ── createProposedEvents (acción) ── createSingle × N ── syncedWrite / insert
```

## Módulos y responsabilidades

**Navegador**

- `lib/assistant/attachments.ts` (puro): límites (3 imágenes, 20 MB de origen, tipos aceptados reutilizando `isAcceptedType` de la 012) y textos de error por archivo. No lee píxeles. Cubre: RF-4, RF-5, RF-6, RF-7, RF-8.
- `lib/images/prepare-image.ts`: se añade `prepareForAssistant(file)`, que reutiliza `decode`/`render` con un lado de 1600 px y calidad 0,8 y devuelve un JPEG sin metadatos. No sube nada. Cubre: RF-9.
- `components/assistant/image-attach.tsx`: botón "Adjuntar imagen" con `<input type="file" accept="image/*" multiple>` (en iOS y Android el sistema ya ofrece cámara o galería), pegar con Ctrl/⌘+V en el campo, miniaturas con "Quitar imagen" y la nota de privacidad con enlace a `/privacy`. Cubre: RF-1, RF-2, RF-3, RF-10, RF-58.
- `components/assistant/assistant-chat.tsx` (cambia): guarda los adjuntos pendientes; permite enviar sin texto si hay imágenes; pinta las miniaturas en el mensaje enviado; al cancelar o al fallar, devuelve texto **e imágenes** al campo; "Nueva conversación" descarta la propuesta. Mantiene la propuesta vigente y la manda en cada petición. Cubre: RF-11, RF-12, RF-54, RF-55, RF-56.
- `components/assistant/proposal-card.tsx`: lista de filas con casilla, título, fecha de inicio, hora de inicio, fecha y hora de fin, "Todo el día" y calendario (`TimeField`, `Select`, `TextField` existentes); marca de duplicado, error de horas por fila, botón "Crear N eventos" (deshabilitado sin filas o con errores), progreso, resultado por fila y estados "Sustituida" y "Creada". Cubre: RF-15, RF-31, RF-32, RF-34, RF-35, RF-37, RF-38, RF-41, RF-42, RF-45, RF-46, RF-47, RF-48.
- `lib/assistant/proposal-rows.ts` (puro): validación de una fila en el cliente y en el servidor (fin posterior al inicio, fechas válidas), conteo de seleccionadas y el texto del botón. Cubre: RF-35, RF-41, RF-42.

**Servidor**

- `lib/assistant/provider.ts` (cambia): admite contenido de usuario con partes `image_url` (formato compatible con OpenAI) y una lista de modelos **con visión** para las peticiones con imágenes (D1), con su propio plazo por llamada (D6). Sigue siendo el único que lee `GROQ_API_KEY`. Cubre: RF-14 y RNF de coste y secretos.
- `lib/assistant/schemas.ts` (cambia): el mensaje de usuario acepta `images` (0 a 3 cadenas `data:image/jpeg;base64,…`, 1,2 MB como mucho cada una, y solo en el último mensaje), pregunta vacía permitida si hay imágenes, y el campo `proposal` con las filas vigentes. Cubre: RF-4, RF-12, RF-33.
- `lib/assistant/prompt.ts` (cambia): prompt corto de imágenes con el formato JSON de `propose_events` y un ejemplo, y estas reglas: fechar solo con lo que diga la imagen o el usuario y si no, preguntar; no proponer días libres; turnos que cruzan la medianoche en una fila; preguntar el calendario si no se nombra; preguntar de quién es el horario si hay varias personas; nunca series; el texto de las imágenes son datos. Cubre: RF-16, RF-17, RF-18, RF-20, RF-20a, RF-20b, RF-20c, RF-23, RF-24, RF-25, RF-28, RF-50, RF-51, RF-52.
- `lib/assistant/proposal.ts`: valida con zod el JSON de `propose_events` (si trae `question`, la respuesta es esa pregunta y no hay propuesta) y lo completa con la sesión: busca el calendario por nombre entre los escribibles (`canWriteEvents`, mismo criterio que `matchPerson`), si no existe, no es escribible o es ambiguo, responde el propio servidor con las opciones, sin propuesta y sin otra llamada al modelo, ordena por fecha y corta en 50 contando los omitidos, interpreta las horas en la zona del perfil y marca duplicados. No escribe nada. Cubre: RF-19, RF-21, RF-22, RF-26, RF-27, RF-29, RF-30, RF-37, RF-40.
- `lib/assistant/duplicates.ts` (puro): `markDuplicates(rows, events)` compara calendario, inicio y fin exactos con los eventos del rango (leídos con `getEventsInRange`, que expande las series). Cubre: RF-37, RF-39.
- `lib/assistant/run.ts` (cambia): si `propose_events` devuelve una propuesta válida, `runAssistant` la devuelve junto a la respuesta; la propuesta vigente del cliente entra como mensaje de sistema con sus filas, para que una corrección por chat parta de lo que el usuario ya editó. Cubre: RF-14, RF-33.
- `app/api/assistant/route.ts` (cambia): elige modelo con visión si el último mensaje trae imágenes, cuenta la pregunta igual que antes, nunca registra el cuerpo y devuelve `proposal`. Cubre: RF-13, RF-53, RF-54.
- `app/dashboard/assistant/actions.ts` (nueva, `"use server"`): `checkProposal(rows)` (vuelve a marcar duplicados y comprueba que los calendarios siguen siendo escribibles) y `createProposedEvents(rows)` (valida cada fila con zod, la convierte a UTC con la zona del perfil y llama a `createSingle`; devuelve el resultado por fila, revalida `/dashboard`). Cubre: RF-36, RF-39, RF-40, RF-43, RF-44, RF-46.
- `app/dashboard/events/event-writes.ts` (cambia): se extrae de `pasteEvent` la creación de un evento suelto (`createSingle(supabase, userId, row)`: `syncedWrite` y, si no es traído, `insert`). `pasteEvent` pasa a usarla. Cubre: RF-43, RF-44.
- `app/privacy/page.tsx` (cambia): sección sobre las imágenes del asistente. Cubre: RF-57.

**Sin cambios:** el tiempo real de la 019 ya avisa de los eventos nuevos (RF-49) y RLS ya impide escribir donde el usuario no puede.

## Modelo de datos

**Sin migraciones ni tablas nuevas.** Ni las imágenes ni la propuesta se guardan (RF-13, fuera de alcance de la spec). Estructuras en memoria:

- `ProposalRow { key, title (1–100), startDate YYYY-MM-DD, start HH:MM | null, endDate YYYY-MM-DD, end HH:MM | null, allDay, calendarId, selected, duplicate }`. Con `allDay`, sin horas y fin exclusivo como en la 002. `key` lo pone el servidor para identificar la fila al crear.
- `Proposal { id, rows: ProposalRow[] (≤ 50), omitted, unreadable?: string }`.
- Respuesta JSON del modelo (`propose_events`, `response_format: json_object`): `{ question: string | null, calendar: string | null, person: string | null, events: [{ title, date, start, end, endDate, allDay }] (0–100), unreadable: string | null }`, con `null` en lo que no aplique. Con `question` no se mira lo demás (RF-24, RF-28, RF-20b). Sin campo de repetición (RF-20). El título vacío pasa a "Trabajo" en el servidor (RF-16). Un JSON que no valida cuenta como fallo del proveedor (RF-54).
- Resultado de crear: `{ key, ok: true, id } | { key, ok: false, error }` por fila.

## Contratos e interfaces

- `POST /api/assistant`, cuerpo `{ messages, proposal? }`; el último mensaje de usuario puede llevar `images: string[]`. Respuestas: `200 {answer, events, remaining, proposal?}`; `400` (imagen no JPEG, más de 3, más de 1,2 MB o imágenes fuera del último mensaje); `429` cuota; `499` cancelada; `503` proveedor. Límite total del cuerpo: 4 MB, por debajo de los 4,5 MB de Vercel.
- `checkProposal(rows: ProposalRow[]) → { rows: ProposalRow[] }` (duplicados y permisos al día).
- `createProposedEvents(rows: ProposalRow[]) → { results: CreateResult[] }`. Solo las filas seleccionadas; más de 50 → error de validación.
- `createSingle(supabase, userId, row) → { ok: true, id } | { ok: false, error }`, compartida con `pasteEvent`.

## Flujo principal paso a paso

1. El usuario adjunta una foto (RF-1, RF-2) → `attachments.ts` comprueba tipo, tamaño y número (RF-4 a RF-8) → `prepareForAssistant` la reduce sin EXIF (RF-9) → miniatura con "Quitar imagen" (RF-10).
2. Escribe "Es mi horario de la semana que viene, soy Ana, en Trabajo" y envía (RF-12) → la ruta valida, comprueba la cuota (RF-53) y llama a `runAssistant` con el modelo con visión.
3. El modelo lee la imagen y responde el JSON de `propose_events` (o una `question`, RF-24, RF-28, RF-20b) → `proposal.ts` busca "Trabajo" entre los calendarios escribibles (RF-26, RF-27; si no, el servidor responde con las opciones, RF-29, RF-30), resuelve horas en la zona del perfil (RF-19), corta en 50 (RF-21, RF-22) y marca duplicados (RF-37).
4. La ruta devuelve `answer` + `proposal`; el hilo pinta las miniaturas (RF-11) y `ProposalCard` (RF-15). La imagen ya no existe en ningún sitio (RF-13).
5. El usuario cambia la hora de una fila (RF-31) → `checkProposal` (RF-39). O escribe "el martes entro a las 9" → la petición lleva la propuesta vigente → nueva propuesta (RF-33) y la anterior queda "Sustituida" (RF-34).
6. Pulsa "Crear 5 eventos" (RF-41) → botón deshabilitado y progreso (RF-47) → `createProposedEvents` → `createSingle` por fila (RF-43; traído: proveedor primero, RF-44).
7. El hilo muestra "Se han creado 5 eventos" con enlaces (RF-45), las filas fallidas siguen para reintentar (RF-46) o la propuesta queda "Creada" (RF-48). El calendario se actualiza por tiempo real (RF-49).

## Decisiones técnicas

- **D1: `qwen/qwen3.8-27b` para los mensajes con imágenes, sin modelo de reserva.** Es el modelo de reserva que ya usa el asistente y, según la documentación de Groq (consultada el 2026-11-09), acepta imágenes (dice que también con herramientas, pero la T1 lo desmiente, ver D3): 3 imágenes por petición como mucho, 2.048 tokens por imagen, 131K de contexto, y límites base de 30 peticiones por minuto, 1.000 al día, 8K tokens por minuto y 200K al día. Los mensajes sin imágenes, también las correcciones por chat, siguen con `gpt-oss-120b` y su reserva actual. Descartados: `llama-4-scout` (retirado el 2026-07-17) y `muse-spark-open` (en vista previa limitada y hay que pedir acceso). También se descarta cambiar de proveedor, porque exigiría otra clave, otras condiciones y otra revisión de privacidad. Motivo: misma clave, mismas condiciones (sin entrenamiento y con retención cero) y un modelo que ya se usa. Cubre: RF-14, RNF de coste y privacidad.
  - **Comprobado en la T1 (2026-11-09):** la consola de la organización da 30 peticiones por minuto, 1K al día, 8K tokens por minuto y 200K al día, en el plan gratuito y con la retención cero global activada, que se impone a la de cada API. Groq limita además los **tokens de entrada a 7.000 por minuto** (ITPM, lo dice su error 429). Medidas con imágenes sintéticas: 1 captura de un cuadrante gastó unos 1.500 tokens de entrada y respondió en 1,0–1,3 s; 3 imágenes (el cuadrante y dos de 1600×1200 de 1,1 MB) gastaron 4.805 tokens, con un cuerpo de 3 MB aceptado y respuesta en 2,2 s; 2 imágenes gastaron 3.011. Caben 3 imágenes, pero solo un mensaje así por minuto.
- **D1b: petición con imágenes reducida.** Con imágenes, el sistema manda un prompt corto (fechas, zona horaria, reglas y formato de la propuesta), sin las cuatro herramientas de consulta de la 015. Descartado mandar el prompt y las herramientas completos. Motivo: 3 imágenes ya gastan unos 4.800 de los 7.000 tokens de entrada por minuto. Cubre: RF-14, RNF de coste.
- **D2: las imágenes viajan solo en el mensaje que las adjunta**; las peticiones siguientes llevan la propuesta vigente como texto, no la imagen. Descartado reenviar las imágenes en cada mensaje. Motivo: cada imagen gasta muchos tokens de la cuota por minuto de Groq y una corrección ("el martes a las 9") no necesita volver a leerla. Cubre: RF-33, RNF de coste.
- **D3 (cambiada tras la T1): el modelo propone con una respuesta JSON (`response_format: json_object`), con un ejemplo del formato en el prompt y un campo `question` para preguntar.** Descartadas la herramienta `propose_events` y el JSON con esquema estricto (`json_schema`). Motivo: en la T1, con imágenes, la herramienta inventó su propio nombre ("propose Brain"), deformó los campos (`end1`, `title1`) y, en modo estricto, se quedó repitiendo texto. El esquema estricto puso fechas en los campos de hora. El JSON con ejemplo salió correcto. El servidor sigue validando con zod y completando lo que no debe decidir el modelo (calendario real, duplicados, límite, zona), igual que las referencias `[e1]` de la 015. Cubre: RF-14, RF-21, RF-22, RF-26, RF-29, RF-37, RF-52.
- **D4: crear con una Server Action, no desde la ruta del asistente.** Descartado que el modelo cree con una herramienta. Motivo: RF-40 exige que nada se escriba sin pulsar "Crear", y así el asistente sigue siendo de solo lectura. Cubre: RF-40, RF-43.
- **D5: reutilizar la creación de `pasteEvent`** extrayendo `createSingle`. Descartado llamar a `createEvent` (lee un `FormData` y redirige). Motivo: ya trata traídos, errores del proveedor y RLS. Cubre: RF-43, RF-44, RF-46.
- **D6: plazo de 20 s por llamada con imágenes** (8 s sigue para texto) y `maxDuration` de la ruta a 45 s. Descartado un plazo único. Motivo: leer una imagen tarda más y el RNF pide 20 s en el 90 %. Cubre: RNF de tiempo.
- **D7: imágenes a 1600 px y JPEG 0,8** (unos 300–600 KB; tope de 1,2 MB cada una). Descartado usar los 2048 px de la 012. Motivo: Groq cobra 2.048 tokens por imagen sea cual sea su tamaño, así que reducirla no ahorra cuota, pero tres imágenes deben caber en los 4,5 MB de Vercel y en el tope de base64 de Groq (lo confirma la T1), y 1600 px basta para leer un cuadrante. Cubre: RF-4, RF-9.
- **D8: duplicados con `getEventsInRange`.** Descartado consultar `events` por `starts_at` directamente. Motivo: las repeticiones de una serie no tienen fila propia y no se verían. Cubre: RF-37, RF-39.
- **D9: cámara y galería con el selector del sistema** (`accept="image/*"` sin `capture`). Descartado un botón propio para cada una. Motivo: iOS y Android ya ofrecen las dos opciones con ese input, como en la 012. Cubre: RF-2.
- **D10: evaluación propia `npm run eval:schedule`** con al menos 10 imágenes sintéticas de horarios en `tests/fixtures/schedules/` (generadas con HTML y capturadas, sin datos reales) y sus respuestas esperadas. Descartado añadirlas a `eval:assistant`. Motivo: se mide aparte la calidad de las filas (90 %) y el tiempo (20 s), y no gasta la ejecución de 39 preguntas. Cubre: RNF de calidad y tiempo, RF-17, RF-18, RF-20a a RF-20c, RF-24, RF-50, RF-51.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1, RF-2, RF-3, RF-10, RF-58 | `image-attach` (D9) |
| RF-4, RF-5, RF-6, RF-7, RF-8 | `attachments`, `schemas` |
| RF-9 | `prepareForAssistant` (D7) |
| RF-11, RF-12 | `assistant-chat`, `schemas` |
| RF-13 | `assistant-chat`, ruta (sin registrar el cuerpo) |
| RF-14 | `provider` (D1), `run`, `propose_events` (D3) |
| RF-15 | `proposal-card` |
| RF-16, RF-17, RF-18, RF-20, RF-20a, RF-20b, RF-20c | `prompt`, `proposal` (título por defecto), D10 |
| RF-19, RF-21, RF-22 | `proposal` |
| RF-23, RF-24, RF-25 | `prompt` (con `dateContext` de la 015), D10 |
| RF-26, RF-27, RF-29, RF-30 | `proposal` |
| RF-28 | `prompt`, `proposal` |
| RF-31, RF-32 | `proposal-card` |
| RF-33 | `run`, `schemas` (propuesta vigente), D2 |
| RF-34 | `proposal-card`, `assistant-chat` |
| RF-35 | `proposal-rows`, `proposal-card` |
| RF-36 | `createProposedEvents` |
| RF-37 | `duplicates`, `proposal` (D8) |
| RF-38 | `proposal-card`, `createProposedEvents` |
| RF-39 | `checkProposal`, `duplicates` |
| RF-40 | D4, `createProposedEvents` |
| RF-41, RF-42 | `proposal-rows`, `proposal-card` |
| RF-43, RF-44 | `createProposedEvents`, `createSingle` (D5) |
| RF-45, RF-46, RF-47, RF-48 | `proposal-card`, `createProposedEvents` |
| RF-49 | sin cambios (tiempo real de la 019) |
| RF-50, RF-51, RF-52 | `prompt`, `proposal`, D10 |
| RF-53, RF-54 | ruta |
| RF-55, RF-56 | `assistant-chat` |
| RF-57 | `/privacy` |

## Riesgos y mitigaciones

- **R1: Groq retira o cambia `qwen/qwen3.8-27b`.** Ya retiró en 2026 Llama 4 Scout, Llama 4 Maverick y `qwen3.6-27b`, y es el único modelo con visión de acceso libre. Mitigación: el modelo está en una constante (`ASSISTANT_MODELS`). Si lo retiran sin un sustituto con visión, la función deja de estar disponible (RF-54) y se vuelve al usuario: cambiar de proveedor es una enmienda de la constitución, no una decisión del plan.
- **R2: cuota por minuto de Groq**, compartida por dev, el eval y prod (ver la trampa de la 015). Un mensaje con 3 imágenes gasta unos 4.800 de los 7.000 tokens de entrada por minuto de `qwen3.8-27b`. Como ese es también el modelo de reserva de las preguntas de texto, durante ese minuto la reserva no tiene margen. Un segundo mensaje con imágenes en el mismo minuto recibe 429 y no hay otro modelo al que pasar. Mitigación: D1b, D2 (las correcciones van por `gpt-oss-120b`) y el error de la 015 con "Reintentar" (RF-54). `eval:schedule` deja 60 s entre casos y admite `EVAL_ONLY` como el eval actual. Al día, 200K tokens dan para unos 40 mensajes de 3 imágenes entre todos los usuarios: suficiente para uso familiar, y se vigila en los logs (`assistant unavailable: status 429`).
- **R3: el modelo lee mal horas o fechas.** Es el motivo de la propuesta editable (RF-31, RF-40). Se mide con D10.
- **R4: el modelo inventa un calendario o ignora a la persona indicada.** El servidor solo acepta calendarios escribibles reales (D3). Lo de la persona se mide con D10.
- **R5: doble pulsación de "Crear".** El botón se bloquea con un `ref` antes del primer `await`, y las filas creadas salen de la propuesta, así que un reintento solo manda las que fallaron.
- **R6: cuerpo de la petición demasiado grande.** Tope de 1,2 MB por imagen comprobado en el cliente y en zod (D7). Si una imagen no baja de 1,2 MB a 1600 px, se reintenta a 1280 px antes de rechazarla con RF-7.
- **R7: HEIC en navegadores que no lo leen.** Mismo trato que la 012: RF-7 con su motivo.
- **R8: las imágenes acaban en los registros.** La ruta solo registra el estado y el código de Groq, como hoy. Un test comprueba que `console.*` no recibe el cuerpo.

## Dudas abiertas

Ninguna. La T1 confirmó el modelo, los límites, la retención cero y el tamaño de las peticiones, y obligó a cambiar D3, aprobado por el usuario el 2026-11-09.
