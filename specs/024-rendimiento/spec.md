# Spec 024 — Rendimiento en el iPhone

> Estado: **Cerrada** (2026-11-15). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15): spec, plan, tareas, implementación y cierre, sin aprobación entre fases. Límites: nada sobre producción, sin dependencias nuevas, coste cero. Es la primera de las seis specs del encargo de rediseño (024 rendimiento → 025 sistema de diseño y marca → 026 calendario → 027 Venito y asistente → 028 Notas → 029 resto de pantallas y cierre) y va primero para que el rediseño parta de una base rápida.

## Contexto y objetivo

Problema vivido por el usuario en el iPhone (Safari y PWA): (1) al deslizar entre meses, semanas y días tarda mucho en cargar; (2) abrir el asistente y enviar mensajes tarda. Objetivo: que mejore de forma clara y **medible**, y dejar la arquitectura de datos del calendario preparada para que el rediseño no lo empeore.

Método: medir primero, demostrar o descartar cada hipótesis con números y corregir la causa, no el síntoma.

## Cómo se mide

Guía reproducible en `scripts/perf/README.md`. Resumen:

- Playwright con Chromium, emulación de **iPhone 13**, **CPU 4× más lenta** (`Emulation.setCPUThrottlingRate`) y red tipo 4G (100 ms de latencia por petición, 9 Mbps de bajada, 2 Mbps de subida).
- La app compilada (`next start`) contra un Supabase local con las 60 migraciones, a través de `scripts/perf/latency-proxy.mjs`, que añade **30 ms a cada consulta** (el viaje Vercel → Supabase en la misma región) y las cuenta.
- Usuario sembrado con 3 calendarios, 633 eventos sueltos (3 al día durante 7 meses) y 6 series semanales.
- Groq sustituido por `scripts/perf/mock-groq.mjs` (900 ms fijos por llamada, dos llamadas por pregunta): mide lo que añade la app, no al proveedor.
- **Es una aproximación**: Chromium no es Safari, la CPU ralentizada no es un iPhone y el Supabase local no tiene la carga del real. La prueba definitiva la hace el usuario en su iPhone en producción. Esta sesión no tenía acceso a Supabase dev ni a Groq (ver "No probado").

## Medidas antes (2026-11-15, `scripts/perf/results/antes.json`)

| Medida | Mes | Semana | Día |
|--------|-----|--------|-----|
| Cambio de periodo: el periodo nuevo está en pantalla (mediana de 6) | 601 ms | 481 ms | 433 ms |
| Cambio de periodo: la transición ha terminado | 863 ms | 746 ms | 682 ms |
| Peticiones a la app por cambio | **85** | 23 | 5 |
| Consultas a Supabase por cambio | 16 | 20 | 20 |
| Tareas largas (> 50 ms) por cambio | 64 ms | 0 | 0 |
| CLS | 0,0003 | 0,0001 | 0 |

| Medida | Valor |
|--------|-------|
| Cargar el calendario (mes): JS pedido | 965 KB (282 KB con gzip), 13 archivos |
| Cargar el calendario: consultas a Supabase | 21 a 30 |
| Abrir el chat desde el calendario (primera vez / siguientes) | 479 ms / 285 ms |
| Cargar `/dashboard/assistant`: JS pedido | 655 KB (198 KB con gzip) |
| Pregunta al asistente: primera señal ("Pensando…", fija, sin progreso real) | 43 ms |
| Pregunta al asistente: respuesta completa (1.800 ms son del proveedor simulado) | 2.063 ms |
| Pregunta al asistente: consultas a Supabase | 7 |

Con 30 ms por consulta en local. En producción cada cambio de periodo suma además el arranque en frío de la función y la latencia real del móvil, así que los 430–600 ms medidos son el suelo, no lo que vive el usuario.

## Hipótesis y veredicto

| Id | Hipótesis | Veredicto | Evidencia |
|----|-----------|-----------|-----------|
| H1 | Cada cambio de periodo es un viaje al servidor y la latencia domina | **Confirmada** | 16–20 consultas y 1 petición RSC por cambio; `router.push` → `CalendarContent` relee perfil (3 consultas), calendarios, tres veces `getEventsInRange` (3 consultas cada una), personas, preferencias, grupos, disponibilidad y categorías (en cascada) |
| H2 | Los enlaces de la vista piden cosas que nadie ha pedido | **Confirmada (no estaba en la lista)** | 85 peticiones por cambio de mes: cada día del mes, cada "+N" y cada día del mini calendario es un `<Link>` que Next precarga al entrar en pantalla |
| H3 | El cristal (`backdrop-filter`) cuesta al desplazar | **No demostrable aquí** | `scripts/perf/paint.mjs`: mismas duraciones de fotograma con y sin desenfoque (mediana 16 ms). Chromium sin GPU no reproduce el compositor de iOS. Se decide por diseño en la spec 025: sin desenfoque en superficies grandes o siempre presentes |
| H4 | Las View Transitions retrasan ver el periodo nuevo | **Confirmada en parte** | 250–270 ms entre "el periodo nuevo está en el DOM" y "la transición ha terminado": por diseño (spec 011), no por coste. Con datos al instante, la salida de 120 ms y la entrada bastan; se acorta en la spec 026 al rehacer el gesto |
| H5 | La agenda da saltos al desplazar | **Confirmada** | `paint.mjs`: 7 fotogramas de más de 33 ms y un percentil 95 de 367 ms en 2,5 s de desplazamiento (cada tramo cargado repinta la lista entera) |
| H6 | Se envía JS que no hace falta al abrir | **Confirmada** | El cliente de Supabase (266 KB, 70 KB gzip) y zod (108 KB, 30 KB gzip) se cargan con el calendario; el primero solo hace falta para el tiempo real y las imágenes; el segundo, para validar en formularios que aún no están abiertos |
| H7 | La rejilla de semana y día no deja deslizar | **Confirmada (no estaba en la lista)** | La rejilla lleva `touch-pan-x touch-pan-y`: el navegador se queda el gesto horizontal y cancela el puntero, así que deslizar sobre las horas no cambia de semana ni de día; solo funciona sobre la cabecera de los días |
| H8 | El asistente tarda por el proveedor y por lo que hace la app alrededor | **Confirmada en parte** | La app añade unos 260 ms a los 1.800 ms del proveedor: perfil, cuota, calendarios y las herramientas una detrás de otra. El usuario no ve nada más que "Pensando…" hasta el final |
| H9 | Abrir el chat espera al servidor | **Confirmada** | 285–479 ms: es una navegación con su RSC; el formulario no aparece hasta que llegan la zona horaria y los calendarios |
| H10 | La región de Vercel | **No comprobable aquí** | `vercel.json` fija `dub1` junto a Supabase `eu-west-1`. Sin acceso a los logs de Vercel; con menos consultas por interacción su peso baja de todos modos |

## Requisitos funcionales

### Calendario sin red al cambiar de periodo

- RF-1 La página del calendario lee **una ventana ancha** de eventos alrededor de la fecha (desde la primera semana del mes anterior hasta la última del mes siguiente, y como mínimo los 42 días de la agenda) en una sola lectura de `getEventsInRange`.
- RF-2 Cambiar de periodo, de vista o ir a hoy dentro de la ventana **no hace ninguna petición**: la vista se pinta con los eventos que ya están en el navegador. La dirección (`?view=&date=`) cambia igual que antes y atrás/adelante del navegador funcionan.
- RF-3 Con el usuario quieto, el navegador **precarga** los periodos contiguos al visible que aún no tiene (un periodo a cada lado).
- RF-4 Al llegar a un periodo que no está cargado (salto lejano), la vista cambia al instante con lo que haya, marca que está cargando (`aria-busy` y un indicador discreto) y completa al llegar los datos. Si la lectura falla, se avisa y se puede reintentar cambiando de periodo.
- RF-5 Lo que cambia otra persona u otro dispositivo (tiempo real), volver a la app y cualquier escritura propia siguen refrescando: el servidor devuelve la ventana de la fecha **visible** y el navegador descarta lo que tenía.
- RF-6 La memoria está acotada: la ventana del navegador no pasa de 400 días; lo más lejano a la fecha visible se suelta.
- RF-7 Los enlaces de día (mes, "+N", cabecera de la semana, mini calendario, fila de meses, selector de vista, "Hoy", anterior y siguiente) siguen siendo enlaces con su dirección, pero no precargan nada y dentro del calendario navegan sin red.
- RF-8 Los puntos del mini calendario del mes visible y la tarjeta "Próximo evento" salen de la ventana ya leída cuando la cubre, sin consultas propias.
- RF-9 Los bloques "Ocupado" de semana y día se piden aparte y solo si el usuario tiene a alguien marcado; llegan después de pintar la vista.
- RF-10 La página del calendario hace como mucho **12 consultas** a Supabase al cargar (antes 21 a 30): el perfil se lee una vez y las categorías no esperan a los calendarios.
- RF-11 Se conserva todo lo existente: tiempo real y `holdLive`, permisos por RLS, series, imágenes, comentarios, deshacer, cambios optimistas, atajos, fines de semana ocultos, agenda continua y rutas `@modal`.

### Gesto y pintado

- RF-12 Deslizar en horizontal sobre la rejilla de horas de semana y día cambia de periodo; el desplazamiento vertical y el pellizco siguen funcionando.
- RF-13 La agenda no repinta los tramos ya pintados cuando llega uno nuevo.

### JS

- RF-14 El cliente de Supabase no bloquea la hidratación del calendario: se carga cuando hace falta (tiempo real tras pintar; imágenes al abrirlas).
- RF-15 Los esquemas de validación (zod) salen de los módulos que carga cada pantalla (tema, acentos, opciones de vista y deshacer), y el JS del chat se descarga en reposo desde el botón del asistente. *Reducido respecto a la primera redacción:* cargar con `lazy()` la ventana rápida, la tarjeta de detalle y el menú contextual se deja para la spec 026, que rehace esas piezas (ver "Diferido").

### Asistente

- RF-16 `POST /api/assistant` responde **en streaming** (NDJSON): una línea de progreso real por paso ("Mirando tu calendario…", "Buscando «dentista»…", "Calculando huecos libres…", "Leyendo los comentarios…", "Escribiendo la respuesta…") y una línea final con lo mismo que devolvía antes. Los errores conservan sus estados (400, 401, 429) cuando se conocen antes de empezar; los que ocurren después llegan como línea `error`.
- RF-17 El chat muestra el progreso real en lugar de "Pensando…" fijo, y lo anuncia a los lectores de pantalla.
- RF-18 Las herramientas de una misma ronda se ejecutan en paralelo y la respuesta sale antes de anotar la pregunta en la cuota. (La cuota sigue leyéndose después del perfil: necesita su zona horaria.)
- RF-19 Abrir el chat pinta el campo de escritura sin esperar al servidor; la zona horaria y los calendarios llegan después. Al abrirlo, la app precalienta la función (`GET /api/assistant`, 204, sin datos).
- RF-20 Se mantienen las garantías: herramientas atadas a la sesión, cuota diaria de 30 (solo cuentan las respondidas), nada se crea sin pulsar "Crear", cancelar aborta, y la conversación no se guarda.

## Requisitos no funcionales (objetivos comprometidos, mismas condiciones de medida)

- RNF-1 Cambio de mes, semana o día con datos ya cargados: periodo nuevo en pantalla en **menos de 100 ms**, sin peticiones a la app ni a Supabase.
- RNF-2 Cambio a un periodo sin cargar: vista nueva en menos de 100 ms y datos en **menos de 400 ms**.
- RNF-3 Abrir el chat: campo de escritura visible en **menos de 300 ms**.
- RNF-4 Primera señal del asistente (progreso real o texto) en **menos de 1 s**, y la app no añade más de 150 ms al tiempo del proveedor.
- RNF-5 CLS por debajo de 0,01 y ninguna tarea larga (> 50 ms) al cambiar de periodo con datos cargados.
- RNF-6 JS para pintar el calendario: al menos un 25 % menos de bytes bloqueantes.
- RNF-7 Consumo de la capa gratuita: menos consultas por interacción que antes; ningún canal de Realtime nuevo.

## Medidas después (2026-11-15, `scripts/perf/results/despues.json`; tres ejecuciones, se da el rango)

Mismas condiciones que "antes": iPhone 13 emulado, CPU 4×, 100 ms de latencia de red, 30 ms por consulta.

| Medida | Antes | Después (CPU 4×) | Después (sin ralentizar) |
|--------|-------|------------------|--------------------------|
| Cambio de mes: periodo nuevo en pantalla | 601 ms | **80–110 ms** | 18 ms |
| Cambio de semana | 481 ms | **61–80 ms** | 15 ms |
| Cambio de día | 433 ms | **40–82 ms** | 15 ms |
| Transición terminada (mes / semana / día) | 863 / 746 / 682 ms | 340–460 / 230–275 / 200–230 ms | 230 / 181 / 166 ms |
| Peticiones a la app por cambio (mes / semana / día) | 85 / 23 / 5 | **1 / 0 / 0** (la del mes es la precarga del siguiente, en reposo) | igual |
| Consultas a Supabase por cambio | 16 / 20 / 20 | 4 / 0 / 0 (precarga) | igual |
| CLS | 0,0003 | 0 | 0 |
| Tareas largas por cambio de mes | 64 ms | 93–185 ms (pintar el mes y la precarga, con la CPU 4×) | 0 |
| Salto a un periodo sin cargar: vista / datos | 601 ms (todo junto) | 200–735 ms / 745–1.170 ms | 65 ms / 446 ms |
| Cargar el calendario: consultas a Supabase | 21–30 | **12** | 12 |
| Cargar el calendario: JS que bloquea | 965 KB (282 KB gzip) | 865 KB (254 KB gzip); 50 KB más llegan en reposo (el chat) | igual |
| Abrir el chat (primera / siguientes) | 479 / 285 ms | **205–357 / 135–140 ms** | 84 / 63 ms |
| Cargar `/dashboard/assistant`: JS | 655 KB (198 KB gzip) | 551 KB (170 KB gzip) | igual |
| Asistente: primera señal | 43 ms ("Pensando…" fijo) | 24–32 ms, y progreso real por pasos desde el servidor | 9 ms |
| Asistente: respuesta completa (1.800 ms del proveedor simulado) | 2.063 ms | 2.040–2.090 ms | 2.009 ms |

### Objetivos: cumplidos y no cumplidos

| Objetivo | Resultado |
|----------|-----------|
| RNF-1 Cambio de periodo con datos < 100 ms, sin peticiones | **Cumplido** en semana y día; en el mes, 80–110 ms con la CPU 4× (18 ms sin ralentizar). Cero peticiones que bloqueen |
| RNF-2 Periodo sin cargar: vista < 100 ms y datos < 400 ms | **No cumplido** con la CPU 4× (vista 200–735 ms, datos 745–1.170 ms; 65 / 446 ms sin ralentizar). Solo ocurre al saltar más de un mes de golpe ("Ir a fecha", fila de meses); deslizar nunca pasa por aquí porque el periodo contiguo ya está precargado |
| RNF-3 Abrir el chat < 300 ms | **Cumplido** en las siguientes (135–140 ms) y casi siempre en la primera (205–357 ms). La spec 027 lo convierte en un panel que no navega |
| RNF-4 Primera señal < 1 s y ≤ 150 ms añadidos | Primera señal **cumplida** (30 ms, y el primer paso real del servidor llega con la primera línea del flujo). Lo que añade la app sigue en 240–290 ms (ida y vuelta de red de 100 ms y 7 consultas): **no cumplido** el segundo punto |
| RNF-5 CLS < 0,01 y sin tareas largas | CLS **cumplido** (0). Tareas largas: ninguna sin ralentizar; con la CPU 4× pintar un mes con 130 eventos sigue siendo una tarea de 90–180 ms |
| RNF-6 25 % menos de JS bloqueante | **No cumplido**: −10 % (965 → 865 KB). El cliente de Supabase ya no bloquea, pero zod sigue entrando por otros módulos de formularios |
| RNF-7 Menos consultas por interacción | **Cumplido**: de 16–20 a 0–4 por cambio de periodo y de 21–30 a 12 por carga. Ningún canal de Realtime nuevo |

Lo que más pesa en lo no cumplido es pintar el mes entero en un solo paso. La spec 026 lo resuelve teniendo ya pintados (ocultos) los periodos contiguos, de modo que deslizar solo los destapa.

## Diferido

| Qué | Por qué | Dónde |
|-----|---------|-------|
| Periodos contiguos ya pintados y gesto que arrastra la tira entera | Exige rehacer el reparto del workspace; es el diseño del calendario | Spec 026 |
| `lazy()` para ventana rápida, tarjeta de detalle y menú contextual | Esas piezas se rehacen en la 026; cargarlas a medias obligaba a cambiar sus tests dos veces | Spec 026 |
| Sacar zod del todo del JS inicial | Entra por `lib/forms`, `lib/calendar/schemas` y los formularios; hay que separar validación de tipos módulo a módulo | Spec 029 (auditoría final) |
| Chat como panel sin navegación | Es parte del rediseño del asistente | Spec 027 |
| Quitar el desenfoque de las superficies grandes | No medible aquí; decisión de diseño | Spec 025 |
| Lo que añade la app a cada pregunta (240–290 ms) | Leer cuota y perfil en una sola función de base de datos necesita una migración | Sin spec; anotado |

## Fuera de alcance

Rediseño visual (spec 025 en adelante), streaming palabra a palabra del texto del modelo (ver plan D7), virtualización de la agenda (ver plan D9), uso offline con datos, cambiar de proveedor o de región.

## Criterios de aceptación

- CA-1 `scripts/perf/measure.mjs despues` cumple RNF-1 a RNF-5 y la tabla "Medidas después" queda en esta spec.
- CA-2 Tests unitarios nuevos en verde: ventana de eventos (planificar, unir, recortar), navegación del calendario, protocolo NDJSON del asistente y herramientas en paralelo.
- CA-3 P8 completo en verde, con `test:db` (cambia el acceso a datos).
- CA-4 Recorrido en el navegador (móvil emulado y escritorio): deslizar 6 meses, saltar a una fecha lejana, crear y mover un evento lejos de la fecha inicial y verlo tras el refresco, atrás/adelante, tiempo real entre dos sesiones.

## No probado

- iPhone real, Safari y la PWA instalada (lo hace el usuario en producción).
- Groq real: sin clave en esta sesión; `eval:assistant` y `eval:schedule` no se ejecutan (el prompt y las herramientas no cambian).
- Supabase dev y producción: esta sesión en la nube no tiene sus credenciales; todo se probó contra un Supabase local levantado con `supabase start` y las mismas migraciones.

## Trazabilidad

Ver `tasks.md`.
