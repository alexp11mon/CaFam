# Plan 024 — Rendimiento en el iPhone

Spec: `specs/024-rendimiento/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-15).

## Resumen de arquitectura

Hoy la dirección (`?view=&date=`) es la entrada de un Server Component que lo relee todo en cada cambio. El cambio de fondo: **la página lee una ventana ancha una vez y el navegador es dueño del periodo visible**.

```
servidor (page.tsx)                         navegador
  perfil (1 consulta)                        CalendarClient
  calendarios, personas, preferencias…  ──▶    estado {view, date}  ◀── history.pushState / popstate
  getEventsInRange(ventana ≈ 100 días)         useEventWindow(ventana) ──▶ loadCalendarWindow (acción) si falta
                                                 │ eventos del periodo visible (memo)
                                                 ▼
                                               ViewToolbar + CalendarWorkspace (sin cambios de contrato)
```

- `router.refresh()` (tiempo real, foco, escrituras) vuelve a ejecutar la página con la dirección actual: llega una ventana nueva y el navegador sustituye la suya. Así la invalidación sigue siendo la de siempre y no hay caché que pueda quedarse vieja.
- El asistente pasa de una respuesta JSON al final a un flujo NDJSON con progreso.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `src/lib/calendar/event-window.ts` (nuevo, puro) | `serverWindow`, `visibleDayRange`, `warmRange`, `planLoad`, `mergeWindow`, `trimWindow`, `eventsInRange` |
| `src/lib/hooks/use-event-window.ts` (nuevo) | Estado de la ventana, carga en frío, precarga en reposo, descarte de respuestas viejas |
| `src/lib/calendar/load-range.ts` (nuevo, servidor) | `loadEventsBetween(from, to, maxDays)`: lo que compartían la agenda y la ventana |
| `src/app/dashboard/calendar/window-actions.ts` (nuevo) | `loadCalendarWindow(from, to)` (≤ 124 días) y `loadBusy(from, to)` (≤ 32 días) |
| `src/components/calendar/calendar-nav.tsx` (nuevo) | Contexto `CalendarNav`, `useCalendarGo()` y `CalendarLink` |
| `src/components/calendar/calendar-client.tsx` (nuevo) | Dueño de `{view, date}`, de la ventana y de los "Ocupado"; pinta barra y workspace |
| `src/app/dashboard/calendar/page.tsx` | Una lectura de perfil, ventana ancha, categorías en paralelo |
| `src/lib/calendar/queries.ts` | `getCalendarProfile` (zona, última vista y opciones en una consulta), `getMyCategories` |
| Vistas y barra (`view-toolbar`, `month-view`, `time-grid`, `mini-month`, `month-strip`, `agenda-view`, `calendar-workspace`, `use-calendar-shortcuts`) | `CalendarLink` / `useCalendarGo` en lugar de `Link` / `router.push` |
| `time-grid.tsx` | `touch-pan-y` en la rejilla (RF-12) |
| `agenda-view.tsx` | Tramos memorizados (RF-13) |
| `use-live-calendar.ts`, imágenes | Cliente de Supabase con `import()` |
| `calendar-workspace.tsx`, `event-block.tsx`, `assistant-chat.tsx` | `lazy()` para lo que no se ve al abrir |
| `src/lib/assistant/stream.ts` (nuevo, puro) | Líneas NDJSON: tipos, `encodeLine`, `readLines`, `statusFor(tool, args)` |
| `src/lib/assistant/run.ts` | `onStatus`, herramientas en paralelo |
| `src/app/api/assistant/route.ts` | Flujo NDJSON, lecturas en paralelo, `GET` de precalentamiento |
| `src/components/assistant/assistant-chat.tsx`, `app/dashboard/assistant/page.tsx` | Leer el flujo, mostrar el progreso, pintar sin esperar datos |
| `scripts/perf/` | Proxy con latencia, Groq simulado, `measure.mjs`, `paint.mjs`, resultados y README |

## Decisiones

- **D1 Ventana en el navegador con `pushState`, no caché de RSC.** Alternativas: (a) `router.prefetch` de los periodos contiguos: sigue siendo un RSC por periodo (16–20 consultas cada uno, tres por reposo) y Next no garantiza conservarlo; (b) `staleTimes` de la caché del router: serviría datos viejos tras un cambio ajeno. La ventana da cero peticiones dentro de ±1 periodo y la invalidación es la de siempre (props nuevas del servidor).
- **D2 Estado propio `{view, date}` y `window.history.pushState`.** Next integra `pushState` con su router (la dirección canónica cambia y `router.refresh()` usa la nueva). Se descarta `useSearchParams` porque obliga a un `<Suspense>` más con `cacheComponents` y porque los tipos de transición (`addTransitionType`) deben ir en la misma transición que el cambio de estado. `popstate` y las props nuevas del servidor vuelven a sincronizar el estado.
- **D3 Tamaño de la ventana: mes anterior a mes siguiente (unas 14 semanas).** Más ancho encarece la primera carga (series que expandir, carga útil); más estrecho deja la semana siguiente fuera. Con los 639 eventos de la siembra son unas 330 filas y ~35 KB comprimidos menos que las tres lecturas de antes juntas.
- **D4 Una sola ventana contigua.** Un salto que no toca la ventana la sustituye; uno contiguo la extiende. Alternativa descartada: varios tramos sueltos (más estados posibles, misma experiencia).
- **D5 Los "Ocupado" van aparte y perezosos.** `grid_busy` no admite más de 32 días y casi nadie tiene personas marcadas: no se paga por defecto.
- **D6 `CalendarLink` es un `<a>` normal** con `onClick` que navega en el cliente; fuera del calendario (o con Ctrl/⌘, clic central) es un enlace corriente a la misma dirección, con `prefetch={false}`. Así desaparecen las 85 precargas y se conservan `href`, `aria-current` y los tests por rol.
- **D7 Progreso por pasos (NDJSON), no texto palabra a palabra.** El texto del modelo pasa por `extractCitations` y por los avisos obligatorios del servidor antes de mostrarse; emitirlo a medias enseñaría referencias `[e1]` crudas y citas inventadas. El progreso real cumple "primera señal en menos de 1 s" sin tocar esas garantías ni el prompt (no hace falta repetir `eval:assistant`).
- **D8 Herramientas en paralelo dentro de una ronda**, con los resultados añadidos en el orden de las llamadas. Las referencias `[eN]` se asignan cuando cada herramienta serializa sus eventos, así que su numeración puede entrelazarse entre dos herramientas; son etiquetas opacas que el modelo solo copia, y `extractCitations` las resuelve igual.
- **D9 Agenda: memorizar tramos, no virtualizar.** Virtualizar exige alturas conocidas y rompe el ancla al cargar hacia arriba (spec 016). Memorizar cada tramo quita el repintado de lo ya pintado, que es lo medido. La spec 026 rediseña la agenda y puede revisarlo.
- **D10 El cristal no se toca aquí.** No se pudo medir su coste (H3); la spec 025 lo retira de las superficies grandes por diseño.
- **D11 El chat sigue siendo una ruta en esta spec**, con el campo pintado al instante y la ruta precargada desde el botón. La spec 027 lo convierte en un panel que se abre sin navegar.
- **D13 Un periodo nuevo se pinta sin View Transition** (añadida al medir). La transición de la spec 011 toma primero una captura del periodo viejo y eso retrasaba el nuevo unos 60 ms (127 ms sin ella frente a 185 ms con ella en el mes, CPU 4×). Ahora anterior, siguiente y deslizar actualizan el estado sin transición y la vista nueva entra con un deslizamiento corto de `translate` y `opacity` (56 px, `--motion-fast-in`), que respeta `prefers-reduced-motion` porque pasa por `play()`. Al soltar el dedo ya no se espera a una animación de salida de 120 ms. El cambio de vista y "Hoy" conservan su transición. Alternativa descartada: mantenerla y aceptar el retraso.
- **D14 La lista de eventos del periodo conserva su identidad** mientras no cambien sus eventos (`useStableList`, `useStableJson` para los puntos del mes, `memo` del workspace y `mergeWindow` conserva el objeto de un evento que vuelve igual). Sin eso, cada precarga repintaba el periodo visible.
- **D15 `loadCalendarWindow` no pregunta la zona horaria**: lee los días con 14 h de margen por cada lado y el navegador pinta solo lo que cae en el periodo. Una consulta menos en el camino de un salto lejano.
- **D12 Sin dependencias nuevas.** NDJSON se lee con `ReadableStream` y `TextDecoder`.

## Riesgos

- R1 `pushState` y `router.refresh()`: si Next no usara la dirección nueva al refrescar, un evento creado lejos de la fecha inicial no aparecería. Se comprueba en el navegador (CA-4); plan B: `router.replace` en reposo.
- R2 Activity conserva el calendario oculto con su estado: `popstate` solo se atiende con la ruta del calendario visible.
- R3 Carga útil de la primera página con calendarios muy llenos: `getEventsInRange` ya pagina; la ventana se puede estrechar en un único sitio (`serverWindow`).
- R4 Un proxy intermedio que no deje pasar el flujo a trozos: el chat funciona igual, solo que el progreso llega junto al final.

## Verificación

P8 completo y `test:db`; `scripts/perf/measure.mjs` antes y después; recorrido de CA-4.
