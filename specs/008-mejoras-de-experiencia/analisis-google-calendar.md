# Análisis de Google Calendar con REA (spec 008)

> Fecha: 2026-10-23. Herramienta: REA (`list_browser_targets`, `inspect_web_page`, `capture_web_screenshot` y `capture_browser_scenario` en modo `connect`) sobre calendar.google.com, en un Edge aislado con perfil temporal y una **cuenta de prueba sin datos reales** creada por el usuario para esto.
> Alcance: entender el **comportamiento** (no el código) de la creación de eventos, el cambio de vistas y el trato de varios calendarios. No se ha copiado código, estilos, iconos ni imágenes de Google: las capturas se quedaron en el directorio temporal de la sesión y no se suben al repositorio.

## Método

1. Passive: árbol de accesibilidad de la vista semanal (roles y nombres de los controles).
2. Escenarios con acciones declaradas (REA las ejecuta en el navegador, con capturas tras cada paso):
   - clic en un hueco de la semana → ventana rápida → escribir título → "More options" → formulario completo → abrir las listas de hora de inicio y fin → guardar;
   - atajos de teclado `m`, `d`, `w`; abrir un evento; abrir el menú de vistas y el menú "Create";
   - vista mes → clic en un día vacío → desplegar el selector de calendario de la ventana rápida.
3. Lo que REA **no** pudo ejecutar (sus acciones no incluyen arrastrar): la creación arrastrando. Lo descrito sobre arrastre en este documento viene de la ayuda pública de Google y del uso habitual, **no** de una observación con REA.

## Hallazgos (observado con REA)

### Creación de eventos

| # | Observación | Evidencia |
|---|-------------|-----------|
| G1 | Un clic en una franja vacía de la vista semana crea al instante un **bloque provisional** "(No title)" en esa franja de media hora, con **1 h** de duración, y abre al lado una **ventana rápida** (no una página). | Escenario 2, captura tras `clickslot` |
| G2 | La ventana rápida tiene el **foco en el título** ("Add title"), una línea con día y horas ("Thursday, October 22 · 2:30pm – 3:30pm"), accesos de una línea a lugar y descripción, el **calendario con su punto de color** y dos botones: "More options" y "Save". | Escenario 2 |
| G3 | "More options" lleva al **formulario completo conservando lo escrito** (el título pasa). La URL cambia a `/r/eventedit` (es una página propia). | Escenario 3 |
| G4 | El formulario completo agrupa en una línea fecha inicio · hora inicio · "to" · hora fin · fecha fin, y debajo "All day" y la repetición. | Escenario 3 |
| G5 | Las horas son **combobox editables** (rol `combobox`, `autocomplete`): se puede escribir o elegir de una lista. | Árbol de accesibilidad del formulario |
| G6 | La lista de la **hora de fin empieza en la hora de inicio y muestra la duración** de cada opción: "1:30pm (30 mins)", "1:45pm (45 mins)", "2:00pm (1 hr)", "2:30pm (1.5 hrs)"… (pasos de 15 min cerca del inicio y de 30 min después). | Escenario 5, captura tras `endlist` |
| G7 | Al guardar se vuelve a la vista con la misma semana y aparece un **aviso inferior** "Event saved" con "Undo" y cerrar. | Escenario 5, captura tras `saved` |
| G8 | En la **vista mes**, un clic en un día vacío crea un evento **de día completo** ("Tuesday, October 27 – Tuesday, October 27") con un botón "Add time" para pasarlo a evento con hora. El bloque provisional aparece como barra en la celda. | Escenario 7 |
| G9 | El selector de calendario de la ventana rápida se despliega **dentro de la propia ventana** (nombre, punto de color, disponibilidad, visibilidad y aviso). | Escenario 7, captura tras `calsel` |
| G10 | El botón "Create" tiene un menú (Event, Task, Appointment schedule). | Escenario 6 |

### Ver y gestionar un evento

| # | Observación | Evidencia |
|---|-------------|-----------|
| G11 | Un clic en un evento abre una **ventana flotante** junto al evento con iconos de editar, borrar, enviar, más y cerrar; debajo, cuadrado de color, título, "Thursday, October 22 · 1:00 – 2:00pm", aviso y calendario. | Escenario 6, captura tras `detail` |
| G12 | Escape cierra la ventana flotante. | Escenario 6, paso `closedetail` |

### Vistas y navegación

| # | Observación | Evidencia |
|---|-------------|-----------|
| G13 | Barra superior: "Today", flechas anterior/siguiente con nombre accesible según la vista ("Previous week", "Next week"), título del periodo ("October 2026" en semana y mes, "October 23, 2026" en día) y un **menú de vista** (botón con el nombre de la vista actual). | Árbol de accesibilidad; escenario 6 |
| G14 | El menú de vista enseña el **atajo de cada vista**: Day `D`, Week `W`, Month `M`, Year `Y`, Schedule `A`, 4 days `X`, y opciones (fines de semana, eventos rechazados). | Escenario 6, captura tras `viewmenushow` |
| G15 | El atajo `d` cambia a la vista día **sin recargar**, conservando la fecha. (El primer `m` no hizo efecto porque un diálogo de Google tenía el foco: los atajos se ignoran mientras hay un diálogo abierto.) | Escenario 6 |
| G16 | La URL refleja vista y fecha: `/r/week/2026/10/23`, `/r/month/2026/10/23`. Abrir una URL va directamente a esa vista. | Escenarios 2 y 7 |
| G17 | La rejilla horaria ocupa **todo el alto disponible** de la ventana, con la columna de horas a la izquierda, el día de hoy marcado con un círculo relleno y una **línea roja con un punto** en la hora actual. | Captura inicial |
| G18 | Vista mes: los eventos con hora se muestran como **punto de color + hora + título** ("● 1pm Cena familiar"); los de día completo, como **barra de color** a lo ancho de la celda. Días de otros meses con número atenuado y "Oct 1" en el primer día del mes. | Escenario 7 |
| G19 | Un mini calendario en la barra lateral navega a cualquier fecha; hoy marcado igual que en la vista principal. | Captura inicial |

### Varios calendarios

| # | Observación | Evidencia |
|---|-------------|-----------|
| G20 | Barra lateral con grupos plegables "My calendars" y "Other calendars"; cada calendario es una **casilla de verificación pintada con su color**. Desmarcar oculta sus eventos en todas las vistas. | Captura inicial; árbol de accesibilidad (`list` "My calendars") |
| G21 | Todos los calendarios visibles se **mezclan en la misma rejilla**; el color del calendario identifica cada evento (p. ej. festivos en verde, eventos propios en azul). | Escenario 7 |
| G22 | Al crear, el calendario por defecto es el principal del usuario y se puede cambiar en la propia ventana rápida (G9). | Escenarios 2 y 7 |

## Lo que no se pudo observar

- **Arrastrar para crear** (las acciones de REA no incluyen arrastrar). Comportamiento conocido por la ayuda de Google: pulsar en una franja y arrastrar hacia abajo dibuja el bloque en pasos de 15 min y, al soltar, abre la ventana rápida con ese inicio y ese fin.
- Comportamiento en móvil (la app móvil es nativa; la web no se probó a 390 px).
- Código interno: no se analizó (no hace falta para reproducir el comportamiento y no se quiere copiar).

## Comparación con CaFam (2026-10-23) y propuesta

| Google | CaFam hoy | Propuesta para la 008 |
|--------|-----------|-----------------------|
| Ventana rápida sobre la rejilla (G1, G2) y formulario completo aparte (G3) | Página completa `/dashboard/events/new` | Ventana sobre el calendario (ya en la 008, RF-1). Ver duda D1 sobre un paso rápido previo |
| Bloque provisional en la franja (G1) | No existe | Mostrar el hueco elegido marcado mientras la ventana está abierta |
| Clic en semana/día → hora de la franja, 1 h (G1) | No se puede crear desde la rejilla | Clic → esa media hora; arrastrar → ese intervalo (decisión del usuario: incluir arrastrar para crear) |
| Clic en mes → día completo (G8) | No se puede | Ver duda D2 |
| Hora como combobox con lista (G5) | `input type="time"` | Lista de 30 en 30 (ya en la 008, RF-13 a RF-16) |
| Lista de fin con duración (G6) | — | Añadir la duración a la lista de la hora de fin |
| Aviso "Guardado" con Deshacer (G7) | Redirige al detalle | Aviso breve sin "Deshacer" (ya en la 008, RF-32; deshacer está fuera de alcance) |
| Detalle flotante (G11) | Página completa | Ventana (ya en la 008, RF-2) |
| Atajos D/W/M/A y menú con atajos (G14, G15) | Botones Agenda/Mes/Semana/Día sin atajos | Añadir atajos de vista y mostrarlos en los botones |
| Rejilla a toda altura (G17) | Rejilla con alto fijo de 28 rem | Rejilla que ocupa el alto disponible |
| Mes: punto + hora + título; día completo como barra (G18) | Todos como chip con barra lateral | Distinguir los dos tipos |
| Casillas del color del calendario (G20) | Filtros por persona → calendario → categoría | Sin cambios: el modelo de CaFam ya cubre esto y lo amplía |
| Semana empieza en domingo | Lunes | Lunes (España) |
| Eventos rellenos con el color y texto blanco | Color solo como marca, texto en tinta (P9) | Se mantiene P9 |
