# Tasks 022 — Eventos desde una imagen en el asistente

Spec: `specs/022-eventos-desde-imagen/spec.md`. Plan: `specs/022-eventos-desde-imagen/plan.md` (los dos aprobados el 2026-11-09).

> Estado: **aprobado** por el usuario (2026-11-09). Implementación sin empezar: el usuario avisará.

Cada tarea se hace sola y con el test primero (rojo → verde), y se cierra con la verificación de P8 en verde y su salida reportada:
`npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` en T7. Sin migraciones ni dependencias nuevas.

## Tareas

- [x] T1 Confirmar en la consola de Groq el modelo con visión y sus límites
  Hecho cuando: el plan (D1, D7) recoge los límites de la organización para `qwen/qwen3.8-27b` (RPM, RPD, TPM, TPD e ITPM), el tamaño de petición aceptado y que la retención cero cubre imágenes; además, una llamada de prueba desde dev con una imagen sintética responde 200 con una propuesta válida (con herramienta o, si falla, en JSON: D3). Si no se cumple, se para la spec y se avisa al usuario (R1). Cubre: RF-14 | Módulo: provider (D1)
  Evidencia (2026-11-09): consola de la organización (plan gratuito, retención cero global activada) con 30 RPM, 1K RPD, 8K TPM y 200K TPD, y además 7.000 tokens de entrada por minuto según el 429 de Groq. Pruebas desde dev con imágenes sintéticas: 1 cuadrante → 200 en 1,0–1,3 s con los 5 turnos de Ana correctos (sin libres, turno de noche hasta el día siguiente, sin los de Luis), 1.500 tokens; 2 imágenes → 3.011 tokens; 3 imágenes (3 MB de cuerpo) → 200 en 2,2 s, 4.805 tokens. La herramienta falló (nombre inventado, campos deformados, modo estricto atascado), y el JSON con esquema estricto también. `json_object` con ejemplo salió bien: D3 cambiada y aprobada por el usuario. Sin código: no aplica la verificación de P8.

- [x] T2 Validar adjuntos y preparar imágenes para el asistente
  Hecho cuando: `npm test -- attachments prepare-image` en verde: rechazo de la cuarta imagen, de tipos no aceptados, de archivos ilegibles y de más de 20 MB con su texto; salida JPEG de 1600 px como mucho, sin EXIF y por debajo de 1,2 MB (con el reintento a 1280 px de R6). Cubre: RF-4, RF-5, RF-6, RF-7, RF-8, RF-9 | Módulo: attachments, prepare-image
  Evidencia (2026-11-09): `assistant-attachments` (5) y `prepare-image` (8, 4 nuevos) en verde, primero en rojo. P8 en verde: typecheck, lint (0 errores, 2 avisos previos), format:check, `npm test` 261 archivos y 2.498 tests, build.

- [x] T3 Aceptar imágenes y propuesta en la petición y llamar al modelo con visión
  Hecho cuando: `npm test -- assistant-schemas assistant-provider` en verde: mensaje con 0 a 3 imágenes JPEG de 1,2 MB como mucho, solo en el último mensaje; pregunta vacía válida si hay imágenes; campo `proposal`; las partes `image_url` llegan a Groq con `qwen/qwen3.8-27b`, sin modelo de reserva y con plazo de 20 s; las peticiones sin imágenes no cambian. Cubre: RF-4, RF-12, RF-14, RF-33 | Módulo: schemas, provider (D1, D6)
  Evidencia (2026-11-09): `assistant-image-request` (6) y 3 casos nuevos en `assistant-provider` en verde, primero en rojo (`visionChat` con `qwen/qwen3.8-27b`, `json_object`, 20 s y sin reserva). P8 en verde: 262 archivos y 2.507 tests, build; lint sin el aviso nuevo (`question` sin usar, quitado).

- [x] T4 Validar filas de la propuesta y marcar duplicados
  Hecho cuando: `npm test -- proposal-rows duplicates` en verde: fin anterior o igual al inicio el mismo día es error, un turno que acaba al día siguiente es válido, conteo de seleccionadas y texto "Crear N eventos", y duplicado solo si coinciden el calendario, el inicio y el fin (también con una repetición de una serie). Cubre: RF-35, RF-37, RF-39, RF-41, RF-42 | Módulo: proposal-rows, duplicates
  Evidencia (2026-11-09): `assistant-proposal-rows` (13) en verde, primero en rojo. Las repeticiones de una serie cuentan como duplicado porque `markDuplicates` recibe los eventos de `getEventsInRange` (lo prueba la T7 contra dev). P8 en verde: 263 archivos y 2.520 tests, build.

- [x] T5 Validar y completar la propuesta JSON con la sesión del usuario
  Hecho cuando: `npm test -- assistant-proposal` en verde con dependencias simuladas: calendario por nombre solo entre los escribibles; respuesta del servidor con las opciones si no existe, no es escribible o es ambiguo; JSON con `question` → pregunta sin propuesta; JSON que no valida → fallo del proveedor; título vacío → "Trabajo"; horas en la zona del perfil (también con cambio de hora); orden por fecha, corte en 50 con el número de omitidos, y duplicados marcados y sin seleccionar. Cubre: RF-16, RF-19, RF-21, RF-22, RF-24, RF-26, RF-27, RF-28, RF-29, RF-30, RF-37, RF-54 | Módulo: proposal (D3, D8)
  Evidencia (2026-11-09): `assistant-proposal` (14) en verde, primero en rojo, más el caso de cambio de hora en `assistant-proposal-rows`. P8 en verde: 264 archivos y 2.535 tests, build.

- [x] T6 Devolver la propuesta desde el asistente
  Hecho cuando: `npm test -- assistant-run assistant-route assistant-prompt` en verde: con imágenes se envían el prompt corto con el formato JSON y `response_format: json_object`, sin herramientas (D1b, D3); la propuesta vigente entra como contexto; `runAssistant` devuelve `proposal`; la ruta cuenta la pregunta, da 503 o 499 como antes, tiene `maxDuration` 45 y no pasa el cuerpo a `console.*` (R8); el prompt contiene las reglas de fechas, días libres, medianoche, persona, calendario, sin series y texto como datos. Cubre: RF-13, RF-14, RF-17, RF-18, RF-20, RF-20a, RF-20b, RF-20c, RF-23, RF-24, RF-25, RF-28, RF-33, RF-50, RF-51, RF-52, RF-53, RF-54 | Módulo: prompt, run, ruta (D1b, D2, D3, D6)
  Evidencia (2026-11-09): `assistant-run-proposal` (8), 4 casos nuevos en `assistant-route` (45 s, propuesta, calendarios escribibles, corrección, 503 sin registrar imágenes) y `jsonChat` en `assistant-provider`, en verde y primero en rojo. Cambio anotado en D2: si la respuesta a un mensaje con imágenes es una pregunta, el navegador las vuelve a adjuntar al siguiente mensaje (lo hace la T8). P8 en verde: 265 archivos y 2.550 tests, build.

- [ ] T7 Crear los eventos propuestos con una Server Action
  Hecho cuando: `npm run test:db -- proposed-events` en verde: `createSingle` extraída de `pasteEvent` (sus tests siguen en verde); `createProposedEvents` crea solo las seleccionadas, cada una en su calendario, con la hora del perfil; un Lector o un calendario sin permiso da error en esa fila y conserva las demás; un duplicado seleccionado se crea; más de 50 filas se rechaza; `checkProposal` vuelve a marcar duplicados y permisos. La escritura en Google/iCloud se prueba en `npm test` con `syncedWrite` simulado. Cubre: RF-36, RF-38, RF-39, RF-40, RF-43, RF-44, RF-46 | Módulo: actions, event-writes (D4, D5)

- [ ] T8 Adjuntar imágenes en la pantalla del asistente
  Hecho cuando: `npm test -- image-attach assistant-chat` en verde: botón "Adjuntar imagen" con `accept="image/*"` y `multiple`, pegar con Ctrl/⌘+V, miniaturas con "Quitar imagen", nota con enlace a `/privacy`, envío sin texto, miniaturas en el mensaje enviado, "Cancelar" y el error devuelven texto e imágenes al campo, y "Nueva conversación" descarta la propuesta. Cubre: RF-1, RF-2, RF-3, RF-10, RF-11, RF-12, RF-54, RF-55, RF-56, RF-58 | Módulo: image-attach, assistant-chat (D9)

- [ ] T9 Pintar y editar la propuesta
  Hecho cuando: `npm test -- proposal-card` en verde: filas con casilla, título, fechas, horas, "Todo el día" y calendario, todas editables; duplicado marcado y sin seleccionar; error por fila con `aria-describedby`; "Crear N eventos" deshabilitado sin filas o con errores; bloqueo ante doble pulsación (R5); progreso; resultado con enlaces, filas fallidas para reintentar, y estados "Sustituida" y "Creada". Capturas a 390, 768 y 1440 px en los dos temas con el acento rojo y el amarillo. Cubre: RF-15, RF-31, RF-32, RF-34, RF-35, RF-38, RF-41, RF-42, RF-45, RF-46, RF-47, RF-48 | Módulo: proposal-card

- [ ] T10 Explicar las imágenes del asistente en `/privacy`
  Hecho cuando: `npm test -- privacy` en verde con la sección que dice que las imágenes se envían al proveedor para leerlas y que CaFam no las guarda. Cubre: RF-57 | Módulo: privacy

- [ ] T11 Medir la calidad con `npm run eval:schedule`
  Hecho cuando: al menos 10 horarios sintéticos (sin datos reales) en `tests/fixtures/schedules/` con sus respuestas esperadas, incluidos días libres, turno de noche, turno partido, horas de 12 h, cuadrante de varias personas (con persona, sin persona y con una que no aparece), imagen sin fechas e imagen sin horario; `npm run eval:schedule` informa del 90 % o más de filas con la fecha y las horas bien y del 90 % o más de respuestas en 20 s o menos, con 60 s entre casos y `EVAL_ONLY`. No corre en `npm test`. Cubre: RF-17, RF-18, RF-20a, RF-20b, RF-20c, RF-24, RF-50, RF-51 y los RNF de calidad y tiempo | Módulo: evaluación (D10)

- [ ] T12 Validar la spec RF por RF y probar a mano
  Hecho cuando: tabla RF-1 a RF-58 (con RF-20a a RF-20c) con el test o la prueba que cubre cada uno; prueba manual en dev con una foto desde el móvil (≤ 768 px) y una captura pegada en el escritorio, en un calendario normal y en uno traído de Google, con los eventos apareciendo en el calendario sin recargar (RF-49); comprobación de que nada de "Fuera de alcance" se ha implementado; y AGENTS.md actualizado. La prueba con el iPhone en producción queda para el usuario tras el merge. Cubre: todos | Módulo: validación

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1, RF-2, RF-3, RF-10, RF-11 | T8 |
| RF-4 | T2, T3 |
| RF-5, RF-6, RF-7, RF-8, RF-9 | T2 |
| RF-12 | T3, T8 |
| RF-13 | T6 |
| RF-14 | T1, T3, T6 |
| RF-15 | T9 |
| RF-16 | T5 |
| RF-17, RF-18, RF-20a, RF-20b, RF-20c, RF-24, RF-50, RF-51 | T6, T11 |
| RF-19, RF-21, RF-22, RF-26, RF-27, RF-29, RF-30 | T5 |
| RF-20, RF-23, RF-25, RF-28, RF-52, RF-53 | T6 |
| RF-31, RF-32, RF-34, RF-45, RF-47, RF-48 | T9 |
| RF-33 | T3, T6 |
| RF-35, RF-41, RF-42 | T4, T9 |
| RF-36, RF-40, RF-43, RF-44 | T7 |
| RF-37 | T4, T5 |
| RF-38, RF-46 | T7, T9 |
| RF-39 | T4, T7 |
| RF-49 | T12 |
| RF-54 | T6, T8 |
| RF-55, RF-56, RF-58 | T8 |
| RF-57 | T10 |

## Dudas abiertas

Ninguna. Si la T1 no confirma el modelo con visión, se para la spec (plan R1).
