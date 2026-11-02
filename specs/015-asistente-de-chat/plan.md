# Plan 015 — Asistente de chat

Spec de origen: `specs/015-asistente-de-chat/spec.md` (aprobada el 2026-10-29). Constitución: `docs/constitution.md` (enmienda 3: proveedor LLM gratuito sin tarjeta, llamado con `fetch` desde el servidor y sin SDK). Plan aprobado el 2026-11-02; D1 y R1 cambiados con aprobación del usuario el 2026-11-02 tras la comprobación de T1. Sin dependencias nuevas.

## Resumen de arquitectura

- **Proveedor:** Groq (API compatible con la de OpenAI, `https://api.groq.com/openai/v1/chat/completions`), con llamadas a herramientas. Lo llama solo el servidor con `fetch` y la clave `GROQ_API_KEY` (P4). El modelo **no ve la base de datos**: pide datos con tres herramientas de solo lectura y redacta la respuesta con lo que le devuelven.
- **Datos y permisos:** las herramientas se ejecutan en el servidor con la **sesión del usuario** (RLS, P3), reutilizando `getEventsInRange` y la expansión de repeticiones de la 013. La disponibilidad se calcula en TypeScript (lógica pura, RF-19). La de otra persona que lo ha consentido sale de una función `SECURITY DEFINER` que solo devuelve horas, nunca títulos ni lugares (RF-23).
- **Conversación:** vive solo en el estado del componente (RF-6). Cada pregunta envía el hilo a un Route Handler `POST /api/assistant`, que comprueba la cuota diaria, ejecuta el bucle modelo ↔ herramientas y devuelve el texto y los eventos citados. Cancelar aborta la petición (RF-4).

```
AssistantChat (cliente) ── POST /api/assistant {messages} ──▶ route.ts
   │  AbortController (Cancelar)                                │ requireActionUser, cuota (assistant_questions)
   │                                                            ▼
   │                                              runAssistant (bucle, máx. 3 rondas de herramientas)
   │                                                 │ prompt con hoy y la zona del perfil
   │                                                 ├─▶ provider.ts ── fetch ──▶ Groq
   │                                                 └─▶ tools.ts (sesión del usuario)
   │                                                       ├ list_events   → getEventsInRange (RLS)
   │                                                       ├ search_events → events ilike (RLS) + expandRows
   │                                                       └ find_free_time → assistant_people() + assistant_busy() + freeSlots()
   ◀── { answer, events[] } ─────────────── citas [e3] → eventos citados (ids solo en la respuesta al navegador)
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `assistant-schema` | `supabase/migrations/<ts>_assistant.sql` | `profiles.share_availability` (por defecto `false`); tabla `assistant_questions` con RLS (cuota); funciones `assistant_people()` y `assistant_busy(...)`; `pg_cron` que purga la cuota antigua | No guarda preguntas ni respuestas | RF-6, RF-15, RF-18, RF-20, RF-21, RF-22, RF-23, RF-27, RF-29 |
| `assistant-core` | `src/lib/assistant/limits.ts`, `schemas.ts`, `dates.ts`, `free-slots.ts`, `people-match.ts`, `serialize.ts`, `citations.ts`, `prompt.ts`, `error-messages.ts` | Lógica pura y testeada: límites, validación `zod` de la petición y de los argumentos de las herramientas, fechas en la zona del perfil, huecos libres, búsqueda de personas por nombre, lo que se envía al modelo (sin ids ni emails), citas `[eN]`, texto del prompt y mensajes en español | No toca la red ni la base de datos | RF-3, RF-7, RF-11, RF-13, RF-14, RF-16, RF-17, RF-17b, RF-18, RF-19, RF-24, RF-26, RF-28, RF-30, casos límite |
| `assistant-tools` | `src/lib/assistant/tools.ts` | Las tres herramientas, ejecutadas con el cliente de Supabase de la sesión: `list_events`, `search_events` y `find_free_time`. Devuelven datos ya reducidos por `serialize.ts` | No decide permisos (RLS y `assistant_busy`); no escribe | RF-8, RF-9, RF-10, RF-12, RF-14, RF-15, RF-16, RF-18, RF-19, RF-20, RF-22, RF-23, RF-24, RF-25, RF-31 |
| `assistant-provider` | `src/lib/assistant/provider.ts` | Única llamada a Groq: `chat(messages, tools, signal)` con plazo, temperatura 0 y el modelo principal; si responde 429, reintenta una vez con el de reserva (D1); convierte 401/403/429/5xx/red/plazo en `AssistantUnavailable`. Único archivo que lee `GROQ_API_KEY` | No conoce las herramientas ni los datos | RF-28, P4 |
| `assistant-run` | `src/lib/assistant/run.ts` | Bucle con dependencias inyectadas (como `run-sync`): arma el prompt, llama al proveedor, ejecuta las herramientas pedidas (como mucho 3 rondas), extrae las citas y devuelve `{ answer, events }` | No lee la sesión ni la cuota | RF-3, RF-5, RF-7, RF-11, RF-13, RF-26, RF-29 |
| `assistant-route` | `src/app/api/assistant/route.ts` | `POST` con sesión: valida la petición, comprueba la cuota del día (zona del perfil), llama a `runAssistant` con `request.signal`, anota la pregunta solo si hubo respuesta y devuelve JSON. `maxDuration` 30 | No guarda el hilo | RF-3, RF-4, RF-27, RF-28, RF-29 |
| `assistant-ui` | `src/app/dashboard/assistant/page.tsx`, `src/components/assistant/assistant-chat.tsx`, `message-item.tsx`, `cited-events.tsx`, `question-form.tsx`, `assistant-examples.tsx`; `lib/shell/nav.ts` y `components/shell/icons.tsx` (`AssistantIcon`) | Pantalla "Asistente" en el marco (barra lateral, barra inferior, hoja "Más" y cajón salen de `NAV_ITEMS`): aviso de privacidad, tres ejemplos, hilo en una región `role="log"`, "Pensando…" con "Cancelar", error con "Reintentar", lista de eventos citados que abren el detalle, "Nueva conversación" | No llama al proveedor ni guarda nada | RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-11, RF-27, RF-28, RF-33, accesibilidad |
| `availability-setting` | `src/components/settings/availability-setting.tsx`, `src/app/dashboard/settings/actions.ts` (`setShareAvailability`), `settings/page.tsx` | Casilla "Permitir que el asistente de otros consulte mi disponibilidad" en Ajustes, desactivada por defecto, con su explicación | — | RF-20, RF-21 |
| `privacy` | `src/app/privacy/page.tsx` | Sección "Asistente de chat": proveedor (Groq), qué recibe, para qué, que no entrena con los datos, retención y la disponibilidad consentida | — | RF-32, RF-33 |
| `validation` | `tests/assistant-eval/questions.ts`, `scripts/assistant-eval.ts` (`npm run eval:assistant`), capturas, prueba con dos usuarios | Conjunto de 30+ preguntas con respuesta esperada contra un usuario sembrado en dev y el proveedor real; capturas y prueba manual | No corre en `npm test` (red y cuota) | RNF de calidad, RF-12, RF-13, RF-26 |

## Modelo de datos

### `public.profiles` (columna nueva)

| Columna | Tipo | Notas |
|---------|------|-------|
| `share_availability` | `boolean not null default false` | RF-20, RF-21. La protegen las políticas de `profiles` (solo el propio). `visible_people()` y `calendar_members_with_names` no la exponen |

### `public.assistant_questions` (cuota diaria, RF-27)

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `bigint generated always as identity` PK | |
| `user_id` | `uuid not null default auth.uid() references profiles (id) on delete cascade` | Índice `(user_id, asked_at)` |
| `asked_at` | `timestamptz not null default now()` | |

- **Sin el texto de la pregunta** (RF-6: no hay historial).
- RLS: `select` y `insert` solo con `user_id = auth.uid()`; `grant insert (user_id)` para que nadie elija `asked_at`; sin `update` ni `delete` (borrar las propias filas saltaría la cuota).
- `pg_cron` `assistant-purge-questions` (04:30 UTC) borra las de más de 2 días; `assistant_scheduled_jobs()` es la ayuda de tests (solo `service_role`), como `trash_scheduled_jobs`.

### Funciones (`SECURITY DEFINER`, `search_path = ''`, solo `authenticated`)

- `assistant_people() returns table (user_id uuid, display_name text, shares_availability boolean)`: el llamante y las personas con las que comparte **al menos un calendario** con cualquier rol (RF-15). Sin email ni zona horaria.
- `assistant_busy(p_person_ids uuid[], p_from timestamptz, p_to timestamptz) returns table (person_id, id, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates, series_id, original_start)`: para cada persona de la lista que **comparte un calendario con el llamante y tiene `share_availability = true`**, las filas de `events` de los calendarios de los que es miembro que pueden solapar el periodo (sueltos, series y excepciones, con el mismo filtro que `getEventsInRange`). **Nunca** `title`, `location`, `description`, `calendar_id` ni `color` (RF-23). Las demás personas se ignoran en silencio. `22023` si el periodo supera 32 días (RF-24, con margen para las zonas horarias).

## Contratos e interfaces

### `POST /api/assistant`

```ts
// Petición (zod, schemas.ts)
type AssistantRequest = {
  messages: { role: "user" | "assistant"; content: string }[]; // 1..20; la última es "user" de 1 a 500 caracteres (RF-3); las del asistente, hasta 4.000
};
// Respuesta 200
type AssistantReply = {
  answer: string;                 // texto plano en español, sin las marcas [eN]
  events: CitedEvent[];           // RF-11
  remaining: number;              // preguntas que quedan hoy
};
type CitedEvent = { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean; calendarName: string; color: string };
// Errores: { error: string }
// 400 petición no válida · 401 sin sesión · 429 cuota agotada (RF-27) · 503 "El asistente no está disponible ahora mismo" (RF-28)
```

- `id` puede ser el de una repetición (`<uuid>_<fecha>`): el enlace es `/dashboard/events/<id>`, que abre la ventana de la 008 sobre el asistente (el slot `@modal` está en el marco).
- Solo cuenta para la cuota una pregunta con respuesta 200 (una caída del proveedor o una cancelación no la gastan).

### Herramientas que ve el modelo

Nombres y argumentos en inglés; descripciones en español. Fechas `YYYY-MM-DD` y horas `HH:MM` siempre en la zona del perfil (RF-7).

| Herramienta | Argumentos | Devuelve |
|-------------|-----------|----------|
| `list_events` | `from`, `to` (como mucho 62 días) | `{ total, truncated, events: ModelEvent[] }` con los 50 primeros (caso límite "muchos eventos") |
| `search_events` | `query` (2–100 caracteres) | Las 20 coincidencias más cercanas a hoy en título, lugar o descripción, desde 1 año atrás hasta 1 año adelante (RF-9) |
| `find_free_time` | `people: string[]` (nombres, sin el usuario), `from`, `to`, `ranges?: {start, end}[]` | `{ status: "ok", days: { date, free: {start,end}[] }[], withoutConsent: string[] }`, o `{ status: "ambiguous", name, options: string[] }`, `{ status: "not_found", name }`, `{ status: "too_long" }` (RF-14, RF-16, RF-22, RF-24) |

- `ModelEvent = { ref: "e1", date, start?, end?, allDay, title, calendar, location? }`. **Sin ids, emails ni nombres de cuentas** (RF-30). `ref` es un índice de la pregunta; `run.ts` guarda la tabla `ref → evento`.
- Una fecha imposible ("2026-02-31") o `from > to` devuelve `{ status: "invalid_date" }` y el modelo lo dice.
- No hay ninguna herramienta que escriba (RF-25).

### Prompt (`prompt.ts`)

Reglas fijas en español: responde siempre en español; solo sobre los eventos y la disponibilidad (si no, "Solo puedo ayudarte con tu calendario", RF-26); usa solo los datos de las herramientas y nunca inventes fechas, horas ni títulos (RF-13); si no hay datos, dilo (RF-12); cita cada evento con su `[eN]` (RF-11); "el día 5" sin mes es el próximo día 5; más de 50 eventos → resume y propone acotar; las franjas por defecto (RF-17) salvo que la pregunta dé horas (RF-17b); di qué personas no han dado permiso (RF-22). Lleva la fecha de hoy, el día de la semana, la zona del perfil y una tabla de los próximos 14 días con su día de la semana (RF-7).

## Flujo principal paso a paso

1. El usuario abre "Asistente" desde la barra lateral, la hoja "Más" o el cajón (RF-1). Ve una frase de privacidad con enlace a `/privacy` (RF-33) y tres ejemplos (RF-2).
2. Pulsa "¿Qué tardes tenemos libres Luis y yo la semana que viene?". El cliente valida 1–500 caracteres (RF-3), añade la pregunta al hilo y muestra "Pensando…" con "Cancelar" (RF-4).
3. `route.ts` comprueba la sesión, valida la petición, lee la zona del perfil y cuenta las preguntas de hoy en esa zona; con 30 devuelve 429 (RF-27).
4. `runAssistant` arma el prompt con la fecha de hoy (RF-7) y el hilo (RF-5) y llama a Groq. El modelo pide `find_free_time({ people: ["Luis"], from, to, ranges: [{16:00–21:00}] })`.
5. `tools.ts` resuelve "Luis" con `assistant_people()` (RF-15, RF-16). Junta los intervalos ocupados: los del usuario con `getEventsInRange` (todos sus calendarios, también los ocultos, RF-10); los de Luis con `assistant_busy` si consintió (RF-20), o solo con sus eventos que el usuario ya ve si no (RF-22). `freeSlots` calcula los huecos con el día completo ocupando el día (RF-18, RF-19) y devuelve solo horas (RF-23).
6. El modelo redacta la respuesta; `run.ts` quita las marcas `[eN]`, añade los eventos citados (RF-11) y descarta las referencias que no existen (RF-13).
7. `route.ts` anota la pregunta en `assistant_questions` y responde. El cliente añade la respuesta al hilo, la región `role="log"` la anuncia y el foco vuelve al campo (accesibilidad).
8. "¿Y el domingo?" envía todo el hilo (RF-5). "Nueva conversación" lo vacía; salir de la pantalla lo pierde (RF-6).
9. Si Groq falla, `route.ts` responde 503: el cliente muestra "El asistente no está disponible ahora mismo" y "Reintentar" con la misma pregunta (RF-28).

## Decisiones técnicas

- **D1: Groq como proveedor**, con `openai/gpt-oss-120b` como modelo principal y `qwen/qwen3.8-27b` de reserva (constante `ASSISTANT_MODELS`): si el principal responde 429, la misma llamada se repite una vez con el de reserva, que tiene su propio límite. Descartados `gpt-oss-20b` (en T1 generó una llamada a herramienta que no era JSON válido) y los Llama (Groq ya no los ofrece). La elección se confirma con el conjunto de preguntas de T12. Descartados Mistral (su capa gratuita "Experiment" pide consentir el entrenamiento, lo que obligaría a quitar los datos de Google, RF-31), Gemini (no usable en la UE con la capa gratuita, spec), OpenRouter (los modelos gratuitos cambian y algunos proveedores registran y entrenan) y Cloudflare Workers AI (exigiría otra cuenta y su cuota diaria en "neuronas" es más difícil de acotar). Motivo: capa gratuita sin tarjeta, llamadas a herramientas, API compatible con OpenAI llamable con `fetch`, respuestas rápidas (RNF de 10 s) y sus condiciones de servicio dicen que no entrena con los datos de los clientes y permiten activar la retención cero. Las condiciones y los límites reales se comprueban en la consola en T1 antes de escribir código. Cubre: RF-28, RF-31, RF-32, P1, P2.
- **D2: el modelo solo pide datos con herramientas y nunca calcula la disponibilidad.** Descartado meter todos los eventos del periodo en el prompt. Motivo: el servidor decide qué datos salen (RF-30) y con qué permisos (RF-29), y los huecos los calcula código testeado (RF-19). Cubre: RF-8, RF-9, RF-13, RF-14, RF-19, RF-25, RF-29, RF-30.
- **D3: Route Handler `POST /api/assistant` sin streaming.** Descartadas una Server Action (no se puede abortar desde el cliente ni pasar la señal a `fetch`) y la respuesta en streaming (más código para respuestas cortas que Groq devuelve en pocos segundos). Motivo: `AbortController` en el cliente corta la petición y `request.signal` corta la llamada a Groq. Cubre: RF-3, RF-4.
- **D4: el hilo vive en el estado del cliente y viaja entero en cada pregunta** (como mucho 20 mensajes). Descartado guardarlo en la base de datos. Motivo: RF-6 prohíbe el historial; el servidor no guarda nada salvo el contador. Cubre: RF-5, RF-6.
- **D5: las citas con referencias cortas `[eN]`.** Descartado enviar los ids de los eventos al modelo. Motivo: RF-30 prohíbe los identificadores internos; además, una referencia que no está en la tabla de la pregunta se descarta, así la lista nunca tiene un evento inventado. Cubre: RF-11, RF-13, RF-30.
- **D6: los eventos de una persona son los de los calendarios de los que es miembro.** El usuario: todos los que ve (RF-10). Otra persona con permiso: todos los suyos por `assistant_busy`. Sin permiso: solo los de los calendarios suyos que el usuario también ve. Descartado "solo los calendarios de los que es propietaria". Motivo: un evento de un calendario familiar compartido ocupa a toda la familia, y así coincide con lo que cada persona ve en su propio calendario. Cubre: RF-18, RF-20, RF-22.
- **D7: `assistant_busy` es `SECURITY DEFINER` y solo devuelve horas y campos de repetición.** Descartados una vista con RLS (no puede saltarse la RLS de `events` solo para algunas columnas) y expandir las series en SQL (no hay expansor de RRULE en Postgres; la 013 lo hace con `ical.js`). Motivo: el consentimiento y el calendario compartido se comprueban en la base de datos (P3) y TypeScript expande con `expandRows`. Cubre: RF-19, RF-20, RF-23, RF-29.
- **D8: huecos libres por franja y de al menos 30 minutos**, en la zona de quien pregunta. Descartado devolver cualquier hueco (aparecerían huecos de 5 minutos entre dos eventos). Motivo: la respuesta debe servir para proponer un plan (H3). Los eventos de día completo ocupan el día por su fecha UTC (convención de la 002) y los de varios días, cada día. Cubre: RF-14, RF-17, RF-17b, RF-18, caso límite de zona distinta.
- **D9: cuota con una fila por pregunta respondida en `assistant_questions`, contada desde las 00:00 de la zona del perfil.** Descartados un contador por día (una fila que actualizar y una función más) y contarla antes de responder (gastaría la cuota en las caídas del proveedor, RF-28). Motivo: RLS basta para insertar y contar, y sin `delete` no se puede saltar. Cubre: RF-27.
- **D10: la frase de privacidad se muestra siempre en la conversación vacía**, encima de los ejemplos. Descartado recordar si ya se vio (columna en `profiles` o `localStorage`). Motivo: cumple "la primera vez" sin estado y el usuario lo ve también en otros dispositivos. Cubre: RF-33.
- **D11: `search_events` con `ilike` sobre título, lugar y descripción con RLS**, en una ventana de un año atrás y uno adelante, y las series expandidas con `expandRows` para dar sus fechas. Descartada la búsqueda de texto completo de Postgres. Motivo: el volumen es familiar y `ilike` ignora mayúsculas; una columna `tsvector` sería una migración más para un caso que no la necesita. Los comodines `%` y `_` de la búsqueda se escapan. Cubre: RF-9, RF-10.
- **D12: constante `PROVIDER_TRAINS_ON_DATA = false` en `provider.ts`**; si fuera `true`, `tools.ts` quitaría los eventos de calendarios traídos de Google de lo que se envía. Descartado no prever nada. Motivo: RF-31 queda comprobado por un test y cambiar de proveedor no puede saltárselo. Cubre: RF-31.
- **D13: el texto de la respuesta se pinta como texto plano con saltos de línea** (`whitespace-pre-wrap`, nodos de texto). Descartado interpretar Markdown. Motivo: sin interpretar nada no hay inyección de HTML posible y no hace falta dependencia. Cubre: RF-3, seguridad.
- **D14: el conjunto de preguntas de prueba se ejecuta con un script aparte** (`npm run eval:assistant`) contra un usuario sembrado en dev y Groq real, y su resultado se registra como evidencia. Descartado meterlo en `npm test`. Motivo: necesita red, clave y cuota, y su resultado no es determinista. Las reglas que sí lo son (citas, serialización, huecos, cuota, permisos) tienen sus tests normales. Cubre: RNF de calidad.

## Trazabilidad RF → módulo

| RF | Módulos |
|----|---------|
| RF-1 | assistant-ui (`NAV_ITEMS`, página) |
| RF-2 | assistant-ui (`assistant-examples`) |
| RF-3 | assistant-core (`schemas`), assistant-route, assistant-ui |
| RF-4 | assistant-ui (`AbortController`), assistant-route (`request.signal`), assistant-provider |
| RF-5 | assistant-run (hilo), assistant-ui |
| RF-6 | assistant-ui (estado local, "Nueva conversación"), assistant-schema (sin texto guardado) |
| RF-7 | assistant-core (`dates`, `prompt`), assistant-tools |
| RF-8 | assistant-tools (`list_events`), assistant-core (`serialize`) |
| RF-9 | assistant-tools (`search_events`) |
| RF-10 | assistant-tools (`getEventsInRange` con RLS, sin preferencias de visibilidad) |
| RF-11 | assistant-core (`citations`), assistant-run, assistant-ui (`cited-events`) |
| RF-12 | assistant-core (`prompt`), assistant-tools (listas vacías), validation |
| RF-13 | assistant-core (`citations`, `prompt`), assistant-run, validation |
| RF-14 | assistant-tools (`find_free_time`), assistant-core (`free-slots`) |
| RF-15 | assistant-schema (`assistant_people`), assistant-core (`people-match`) |
| RF-16 | assistant-core (`people-match`), assistant-tools |
| RF-17 | assistant-core (`limits`, `free-slots`) |
| RF-17b | assistant-core (`schemas` de `ranges`, `free-slots`), assistant-core (`prompt`) |
| RF-18 | assistant-core (`free-slots`) |
| RF-19 | assistant-core (`free-slots`), assistant-schema (`assistant_busy`) |
| RF-20 | assistant-schema (`share_availability`, `assistant_busy`), availability-setting |
| RF-21 | assistant-schema (`default false`), availability-setting |
| RF-22 | assistant-tools (`withoutConsent`), assistant-core (`prompt`) |
| RF-23 | assistant-schema (`assistant_busy` sin títulos), assistant-tools (solo huecos) |
| RF-24 | assistant-core (`limits`), assistant-tools (`too_long`), assistant-schema (`22023`) |
| RF-25 | assistant-tools (sin herramientas de escritura) |
| RF-26 | assistant-core (`prompt`), validation |
| RF-27 | assistant-schema (`assistant_questions`), assistant-route, assistant-ui |
| RF-28 | assistant-provider (`AssistantUnavailable`), assistant-route (503), assistant-ui ("Reintentar") |
| RF-29 | assistant-schema, assistant-tools (sesión del usuario), assistant-run |
| RF-30 | assistant-core (`serialize`), assistant-run |
| RF-31 | assistant-provider (`PROVIDER_TRAINS_ON_DATA`), assistant-tools |
| RF-32 | privacy |
| RF-33 | assistant-ui (aviso), privacy |

## Riesgos y mitigaciones

- **R1: la capa gratuita de Groq es por organización, no por usuario** (T1, 2026-11-02): por modelo, 30 peticiones/min, 1.000/día, 8.000 tokens/min (7.000 de entrada) y 200.000 tokens/día. Una pregunta gasta unos 1.000–2.700 tokens, así que caben unas 100 al día por modelo, pero solo 3 o 4 por minuto en toda la cuenta. Mitigación: modelo de reserva con su propio límite (D1), como mucho 3 rondas de herramientas y prompt corto; un 429 de los dos modelos es RF-28 ("no está disponible ahora mismo") y no gasta cuota del usuario.
- **R2: el modelo inventa o se equivoca de fecha.** Mitigación: temperatura 0, tabla de los próximos 14 días en el prompt, fechas siempre resueltas por las herramientas, citas validadas (D5) y el conjunto de 30+ preguntas (D14) con el objetivo del 90 % y ningún evento inventado. Si no se alcanza, se ajusta el prompt o se cambia de modelo dentro de Groq, sin cambiar ningún RF.
- **R3: inyección de instrucciones** en la pregunta o en el título de un evento. Mitigación: el modelo no tiene herramientas de escritura ni acceso a datos que el servidor no le dé, y los permisos los imponen RLS y `assistant_busy` (RF-29). Un test comprueba que un hilo manipulado no cambia lo que devuelven las herramientas.
- **R4: `assistant_busy` devuelve ids de eventos que el llamante no puede leer** (los necesita `expandRows` para casar excepciones). Mitigación: sin título, lugar, descripción ni calendario, el id no permite leer nada (RLS de `events`); nunca se envía al modelo ni al navegador.
- **R5: tiempo de respuesta.** Mitigación: plazo de 8 s por llamada a Groq y 25 s en total, `maxDuration` 30, región `dub1`. El RNF de 10 s se mide en el conjunto de prueba.
- **R6: Activity conserva la pantalla oculta con una petición en marcha** (trampa de la 008). Mitigación: la limpieza del efecto aborta la petición pendiente; la conversación conservada al volver no contradice RF-6, porque nunca sale del navegador.
- **R7: Groq cambia sus condiciones o sus modelos.** Mitigación: modelo en una constante, proveedor aislado en `provider.ts` y `/privacy` lo declara; un cambio de proveedor exige revisar RF-31 y P1.

## Dudas abiertas

- Ninguna sobre el plan. T1 confirma en la consola de Groq lo que D1 da por supuesto (sin tarjeta, usable desde la UE, sin entrenamiento, retención cero activable y límites del modelo); si algo falla, se vuelve a este plan antes de seguir.
