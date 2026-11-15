# Tasks 027 — Venito y el chat del asistente

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **cerrada** (2026-11-15).

## Tareas

- [x] T1 Venito
  Evidencia (2026-11-15): `components/brand/venito.tsx` (un SVG con `mood`), tokens `seal*` en los dos temas (`VENITO` en `accents.ts`), gestos `venito-*` en `globals.css`. `tests/unit/venito.test.tsx`, 11 casos: seis expresiones distintas, decorativo o con nombre, solo tokens, valores iguales a `accents.ts` en claro y oscuro, solo `transform` y `opacity`, quieto con movimiento reducido. Cubre: RF-1

- [x] T2 Sugerencias
  Evidencia (2026-11-15): `lib/assistant/suggestions.ts` y `assistant-suggestions.test.ts` (4 casos). Cubre: RF-5

- [x] T3 Chat con aspecto de conversación
  Evidencia (2026-11-15): `assistant-chat.tsx` conserva estado y peticiones; pintado nuevo. `ImageAttach` se parte en botón, nota y miniaturas. `assistant-chat-look.test.tsx` (9 casos: cabecera con Venito "en línea", cierre desde el panel, burbujas con hora y la mía en el acento, "escribiendo…" con puntos y el paso real, sugerencias que cambian tras responder, rellenar en lugar de enviar, selector de imagen, 16 px y 44 px, avisos de actividad). De los tests anteriores del chat solo cambian dos, a conciencia: la lista se llama "Sugerencias" y tiene seis (antes "Ejemplos de preguntas", tres) y el saludo es de Venito; el resto (citas, cancelar, reintentar, cuota, imágenes, propuesta, flujo) pasa sin tocar. Cubre: RF-4, RF-5, RF-6, RF-8

- [x] T4 Botón de Venito y panel
  Evidencia (2026-11-15): `shell/assistant-fab.tsx` (botón con la cara de Venito y `<dialog>` del chat). `assistant-fab.test.tsx` reescrito, 8 casos: posición sobre las barras, fuera de la página del asistente, precalentamiento una vez, abre sin navegar y devuelve el foco, Escape y toque fuera, cierre deslizando la cabecera 80 px, la conversación sigue al reabrir, el botón dice "está respondiendo" y "ha respondido". Cubre: RF-2, RF-3

- [x] T5 Venito en estados vacíos, errores y sin conexión
  Evidencia (2026-11-15): `EmptyState` dibuja a Venito por defecto, `ErrorScreen` confundido y `/offline` dormido; 3 casos nuevos en `ui-base.test.tsx`. Cubre: RF-7

- [x] T6 Capturas, medida y cierre
  Evidencia (2026-11-15): 12 capturas en `specs/027-venito-y-asistente/capturas/` (botón, chat vacío, escribiendo y con respuesta y evento citado; 390 px claro y oscuro, 1440 px claro). Las seis expresiones se ven en el botón, la cabecera, el saludo y los estados; no se generó una lámina aparte. `measure.mjs` (`results/027.json`): abrir el chat 204 ms la primera vez y 148 ms las siguientes (antes 205–357 / 135–140 con navegación); mes 85 ms, semana 79 ms, día 50 ms; 12 consultas al cargar. El script de medida se corrigió: las animaciones en bucle de Venito no cuentan como "transición sin terminar" y la respuesta se busca en todo el documento (el chat ya no está en `main`). P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 285 archivos y 2.727 tests, build correcto. Sin `test:db` (no toca datos). No se ejecutaron `eval:assistant` ni `eval:schedule` (sin clave de Groq; prompt y herramientas sin cambios). Cubre: CA-1, CA-2, CA-3

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T1 |
| RF-5 | T2, T3 |
| RF-4, RF-6, RF-8 | T3 |
| RF-2, RF-3 | T4 |
| RF-7 | T5 |
