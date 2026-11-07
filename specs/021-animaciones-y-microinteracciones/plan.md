# Plan 021 — Animaciones y microinteracciones

Spec de origen: [`spec.md`](spec.md), aprobada el 2026-11-07. Constitución: `docs/constitution.md`, con la enmienda 8 ya aplicada (recortes animados y sin rebote).

## Resumen de arquitectura

El movimiento vive en tres capas, sin dependencias nuevas ni cambios de base de datos:

1. **CSS** (`globals.css`): los tokens de movimiento (curvas, pares de duración de entrada y salida, escalas, retrasos) y las utilidades que los aplican: desplegables (`pop`), escalonado (`stagger`), detalle retrasado (`settle`), pulsar sin elevación (`press-quiet`), revelados con recorte y apilado de estados (`swap`). Cubre todo lo que se puede decidir sin medir la pantalla.
2. **Funciones puras** (`src/lib/motion/`): el origen de un desplegable, la goma, la decisión al soltar un gesto y el arco de un traslado. Se prueban con Vitest sin navegador.
3. **Animaciones medidas** con la Web Animations API (`element.animate`, API nativa): todo lo que necesita posiciones reales, que son la transformación evento → detalle, el regreso en arco, el pulso y el final de un gesto. Pasan por un único `play()` que se puede interrumpir.

```
pointer / clic ─▶ componente ─▶ lib/motion (puro: origen, goma, arco, decisión)
                      │                     │
                      ▼                     ▼
            clases y data-* CSS    play() con WAAPI ──▶ commitStyles + cancel (RF-63)
                      │                     │
                      └──────▶ tokens --motion-* / --ease-* (globals.css)
                                 └─ prefers-reduced-motion: fundidos o nada (RF-66, RF-67)
```

## Módulos y responsabilidades

### Base (CSS y funciones puras)

- **`motion-tokens`** (`src/app/globals.css`, bloque `:root`): curvas `--ease-out` (entradas y salidas) y `--ease-in-out` (movimientos); pares de duración `--motion-{pop,dialog,base,fast}-{in,out}` con la salida al 80 %; `--motion-row`, `--motion-pulse`, `--motion-reveal`; `--pop-scale: 0.95`, `--stagger-step: 30ms`, `--settle-delay: 50ms`, `--arc-max: 32px`, `--pulse-scale: 1.04`, `--swap-scale: 0.5`, `--swap-blur: 4px`, `--knob-stretch: 1.12`. Con `prefers-reduced-motion` cambia las escalas a 1, los retrasos a 0, el desenfoque a 0 y las duraciones a 150 ms como mucho. `--motion-ease` desaparece y sus usos pasan a `--ease-out` o `--ease-in-out`. No anima nada. Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-66.
- **`motion-utilities`** (`globals.css`): utilidades de CSS sin estado:
  - `pop`: cerrado si tiene `[hidden]` o `[data-leaving]`, con opacidad 0 y `scale(var(--pop-scale))`. Usa `transform-origin: var(--pop-origin)`, `@starting-style` y `allow-discrete`.
  - `stagger`: los hijos entran con `row-in` y retrasos por `nth-child` del 2 al 8, y del 9 en adelante con el retraso del octavo.
  - `settle`: el mismo `row-in` con `--settle-delay`.
  - `press-quiet`: solo la escala al pulsar, sin elevarse al pasar por encima.
  - `swap`: varias capas en la misma celda de una rejilla.
  - `reveal-down`: recorte de arriba abajo y vuelta.
  - Las reglas de `::view-transition` para el revelado circular (`html[data-reveal]`) y para el selector de vista con nombre propio.
  Cubre: RF-6, RF-7, RF-9, RF-11, RF-12, RF-13, RF-16, RF-17, RF-19, RF-35, RF-36, RF-38, RF-52, RF-54.
- **`motion-origin`** (`src/lib/motion/origin.ts`, puro): `originFrom(trigger: Box | Point, panel: Box): string`. Calcula el punto del panel más cercano al centro del disparador, en px relativos al panel (`"312px 0px"`). No toca el DOM. Cubre: RF-8, RF-9, RF-10.
- **`motion-band`** (`src/lib/motion/rubber-band.ts`, puro): `rubberBand(excess, max = 64)`. Devuelve un desplazamiento creciente, cada vez más lento, que nunca llega a `max`. También tiene `banded(value, min, max)` para aplicarlo fuera de un intervalo. Cubre: RF-32, RF-33.
- **`motion-release`** (`src/lib/motion/release.ts`, puro): `releaseDecision({ delta, velocity, threshold })` → `"forward" | "back" | "stay"`, con el umbral de velocidad de 0,5 px/ms. `trackVelocity()` guarda las últimas muestras del puntero (100 ms) y da la velocidad al soltar. `lockAxis(dx, dy)` decide el eje a los 10 px. Cubre: RF-25, RF-27, RF-28, RF-29, RF-30, RF-31.
- **`motion-flight`** (`src/lib/motion/flight.ts`, puro): `flightKeyframes(from: Box, to: Box)` → fotogramas de `translate`. Si el trayecto mide 48 px o más, hace un arco con una separación senoidal de `--arc-max` hacia arriba; si es menor, va en línea recta. Cubre: RF-20, RF-21, RF-22.

### Ayudas del navegador

- **`motion-play`** (`src/lib/motion/play.ts`): `play(el, keyframes, { duration, easing, delay })` devuelve la `Animation`. Antes de empezar, fija con `commitStyles()` y cancela lo que ya corre en ese elemento, así la animación nueva parte de donde esté (RF-63). Si no hay `el.animate` (jsdom) o hay movimiento reducido, pone el estado final sin animar. `prefersReducedMotion()` lee la consulta del sistema. `pulse(el)` sube a `--pulse-scale` y baja en `--motion-pulse` con `--ease-in-out`, y no hace nada con movimiento reducido. Cubre: RF-47, RF-49, RF-63, RF-64, RF-66, RF-67.
- **`use-presence`** (`src/lib/hooks/use-presence.ts`): `usePresence(open, exitMs)` → `{ mounted, leaving }`. Mantiene montado lo que se cierra hasta que acaba su salida. Si se vuelve a abrir mientras sale, cancela la salida. Cubre: RF-9, RF-38, RF-65.
- **`use-enter-once`** (`src/lib/hooks/use-enter-once.ts`): pone `data-entering` en una lista al montarla y lo quita a los 400 ms. Así una vista que Activity oculta y vuelve a mostrar no repite el escalonado: el CSS solo escalona con `[data-entering]`. Las filas nuevas llevan `row-in` por su cuenta. Cubre: RF-16, RF-17, RF-18 y el caso límite de Activity.
- **`motion-marks`** (`src/lib/motion/marks.ts`): almacén en memoria del cliente, con clave el id del evento, de lo que un bloque debe hacer en su próxima pintura: `{ kind: "return", from: Box }` o `{ kind: "pulse" }`. `captureReturn(id)` mide el bloque visible antes del cambio y `takeMark(id)` lo consume una sola vez. Las marcas caducan a los 2 s. Cubre: RF-20, RF-48.
- **`motion-morph`** (`src/lib/motion/morph.ts`):
  - `setMorphOrigin({ eventId, segment, box, color })`, que guarda el bloque pulsado, y `takeMorphOrigin(eventId)`, que lo devuelve si tiene menos de 1 s.
  - `findVisibleBlock(eventId, segment)`: busca `[data-event-id]` con `checkVisibility()` y dentro de la pantalla. Así ignora las copias ocultas por Activity.
  - `morphIn(el, from)` y `morphOut(el, to)`: animan `translate` y `clip-path: inset(... round r)` entre la caja del bloque y la de la superficie, sin escalar. A la vez funden una capa interior con el color del evento y el contenido, que aparece a partir del 40 % del recorrido.
  - Llama a `holdLive()` durante la animación y lo suelta al acabar.
  Cubre: RF-55, RF-56, RF-57, RF-58, RF-59, RF-60, RF-61.

### Componentes nuevos de `ui/`

- **`switch`** (`src/components/ui/switch.tsx`): `<button role="switch" aria-checked>` con su etiqueta visible y su descripción. La bolita cambia de lado con una transición de `translate` en `--ease-in-out` (se invierte sola si se pulsa a medio camino), y al cambiar de estado se le aplica la animación `knob-stretch`: `scale` de 1,12 × 0,893 a mitad de viaje, que conserva el área. El estado no depende del color: la bolita va a la derecha encendido y a la izquierda apagado. Es optimista: si falla, el padre devuelve `checked`. Cubre: RF-40, RF-41, RF-42, RF-43, RF-44, RF-45, RF-46.
- **`swap-label`** (`src/components/ui/swap-label.tsx`): `<SwapLabel busy={pending} idle="Guardar" busyText="Guardando…" />`. Pinta los dos textos en la misma celda: la anchura es la del más largo y los dos se funden a la vez. El que no se ve lleva `aria-hidden`. Cubre: RF-52, RF-53.
- **`icon-swap`** (`src/components/ui/icon-swap.tsx`): `<IconSwap show="a" a={<SunIcon/>} b={<MoonIcon/>} />`. Apila los dos iconos y anima `scale`, `opacity` y `filter: blur` entre ellos. Cubre: RF-54.
- **`crossfade-text`** (`src/components/ui/crossfade-text.tsx`): cuando cambia `text`, guarda el anterior en una capa que sale mientras entra el nuevo, en la misma celda. Lo usa el título del mes de la cabecera del móvil. Cubre: RF-52.

### Cambios en componentes existentes

- **`popovers`**: aplican `pop` y `--pop-origin` (con `originFrom`), y `usePresence` donde el elemento se desmonta al cerrarse:
  - `event-menu.tsx`: origen en el puntero, o en el evento enfocado si se abrió con el teclado;
  - `ui/time-field.tsx`: ya usa `hidden`; origen en el campo;
  - el selector de fecha flotante de `calendar-workspace.tsx`: origen en el botón "Elegir fecha";
  - `quick-create.tsx` en el ordenador: origen en el hueco;
  - el tooltip de `side-rail.tsx`: origen en el icono.
  Cubre: RF-6, RF-7, RF-8, RF-9, RF-10, RF-65.
- **`dialogs`** (`globals.css`, bloque `dialog`):
  - ventanas centradas: de `translate: 0 8px` pasan a `scale(var(--pop-scale))` con origen en el centro y `--motion-dialog-in/out`;
  - hojas (`[data-sheet]`, la hoja "Más", la ventana rápida en el móvil): desde abajo, `translate: 0 100%`;
  - cajón (`[data-drawer]`): desde la izquierda, como hoy;
  - superficies que se transforman (`[data-morph]`): sin transición de CSS, porque las anima `morph`.
  Cubre: RF-11, RF-12.
- **`press-coverage`**: `press-quiet` en las filas de `event-menu`, de `more-sheet` y de `nav-drawer`, en las opciones de `time-field`, en los días de `mini-month` y `month-strip`, en los avatares de los filtros y en el interruptor. `press` se queda en botones, tarjetas de tema y acento y botones flotantes. `EventBlock` sigue sin `press`. Cubre: RF-13, RF-14, RF-15.
- **`lists`**: `stagger` + `useEnterOnce` en `calendar-list`, `member-list`, `connection-list`, `calendar-picker`, la lista de `event-comments` (los nuevos del sondeo y "Ver anteriores" con `row-in`) y `cited-events`. Solo `stagger`, sin el hook porque se vuelven a abrir, en `event-menu`, la lista de horas, `nav-drawer` y `more-sheet`. Ninguna vista del calendario lo usa. Cubre: RF-16, RF-17, RF-18.
- **`settle-details`**: `settle` en el "Deshacer" de `toast.tsx`, en los botones de `quick-create`, en la fila de acciones de `event-card` y en `cited-events` bajo la respuesta. Cubre: RF-19.
- **`return-flight`**: `event-interactions.tsx` llama a `captureReturn(id)` justo antes de deshacer un cambio que falla, de ejecutar "Deshacer" y de cancelar la pregunta del alcance de una serie. `draggable-event.tsx`, en `useLayoutEffect`, consume la marca y llama a `play(el, flightKeyframes(from, to))` con `--ease-in-out`. Cubre: RF-20, RF-21, RF-22.
- **`follow-gesture`** (`src/lib/hooks/use-follow-drag.ts`): sigue un puntero en un eje con bloqueo de eje (`lockAxis`), escribe `translate` en el elemento dentro de `requestAnimationFrame` (sin estado de React por fotograma), lleva la velocidad con `trackVelocity()` y al soltar llama a `onRelease(delta, velocity)`. Lo usan:
  - la vista de `calendar-workspace.tsx`, que sustituye a `useSwipe`: el contenedor de mes, semana y día pasa a `touch-pan-y`; al soltar, `releaseDecision` con 50 px o la velocidad decide si la vista sale con `play()` y entonces llama a la navegación de periodo, cuya transición `cal-next/prev` ya hace entrar el nuevo, o si vuelve a 0;
  - `nav-drawer.tsx`, con la goma hacia la derecha y el umbral de la mitad del ancho;
  - `image-viewer.tsx`, con la goma en los extremos, el umbral del 25 % y la imagen nueva entrando por el lado contrario con `data-enter-from`.
  Cubre: RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31.
- **`band-limits`**:
  - `event-modal.tsx`: la hoja sustituye `Math.max(offset, -40)` por `banded()`. Ampliada, la goma empieza en 0; a media altura, en la distancia hasta la altura completa. Al soltar, el `translate` sobrante vuelve con `play()`.
  - `use-grid-zoom.ts`: durante el pellizco, la altura fuera de 24–144 px se calcula con `banded()`. Al soltar, la altura se fija en el límite y la diferencia se devuelve con `scaleY` (FLIP, solo `transform`).
  - `use-event-drag.ts`: el borde de un evento por debajo de 15 min se trata igual, con `scaleY` de la vista previa.
  Cubre: RF-32, RF-33, RF-67.
- **`view-switcher`** (`view-toolbar.tsx`): el selector se pinta dos veces en la misma caja:
  - debajo, la capa base con el texto `muted`;
  - encima, una capa `aria-hidden` y sin eventos de puntero con `bg-accent` y `text-on-accent`, recortada con `clip-path: inset(0 var(--r) 0 var(--l) round 9999px)` a la opción elegida.
  `--l` y `--r` salen de medir las opciones (con `ResizeObserver`), y la transición de `clip-path` en `--ease-in-out` mueve la píldora y cambia el color del texto justo debajo de ella. El grupo lleva `view-transition-name: view-switcher`, con su animación anulada, para que el fundido de la vista no lo duplique. Cubre: RF-34, RF-35.
- **`theme-reveal`**:
  - `applyTheme(theme, origin?)` (`lib/theme/apply-theme.ts`) pone `--reveal-x`, `--reveal-y` y `--reveal-r` (distancia a la esquina más lejana) y `data-reveal` en `<html>` mientras dura la transición, y lo quita al acabar. El CSS anima `::view-transition-new(root)` de `circle(0)` a `circle(var(--reveal-r))` en `--motion-reveal`.
  - `theme-toggle.tsx` pasa el centro del botón.
  - `theme-picker.tsx` pasa el de la opción.
  - `accent-picker.tsx` envuelve su repintado en la misma función.
  Sin View Transitions o con movimiento reducido, el cambio es inmediato, como hoy. Cubre: RF-36, RF-37, RF-39.
- **`selection-slide`** (`theme-picker.tsx`, `accent-picker.tsx`): un anillo `aria-hidden` del tamaño de una tarjeta se coloca sobre la elegida con `translate` (todas las tarjetas miden lo mismo) y se desliza a la nueva con `--ease-in-out`. Sustituye a `has-checked:ring`; `has-checked:border-ink` se queda para cuando no hay movimiento. Cubre: RF-62.
- **`header-reveal`**: la fila de meses y el mini calendario de la cabecera del móvil (`calendar-workspace.tsx`) usan `usePresence` y `reveal-down`. Cubre: RF-38.
- **`state-overlap`**:
  - `SwapLabel` sustituye a los 22 `{pending ? "…" : "…"}` de los botones (21 archivos);
  - `top-bar.tsx` usa `CrossfadeText` en el título;
  - `toast.tsx` guarda el aviso anterior como capa `data-leaving` mientras entra el nuevo;
  - `event-panel.tsx` pasa de detalle a edición dentro de `startTransition`, con `<ViewTransition key={modo}>` y el fundido `auto`.
  Cubre: RF-52, RF-53.
- **`icon-swaps`**: `IconSwap` en `theme-toggle.tsx` y en cada lugar que hoy pinta `cond ? <IconA/> : <IconB/>` en el mismo sitio (la tarea los busca con `grep` y los lista en `tasks.md`). Cubre: RF-54.
- **`success-pulse`**: `pulse(ref.current)` cuando llega el éxito:
  - en `profile-form`, `email-form`, `password-form` y las opciones de calendario de Ajustes;
  - en `copy-button` y en el copiar ID de `access-code-panel`;
  - en `sync-now-button`, `switch` y `comment-form`.
  Para los bloques, `event-interactions.tsx` llama a `markPulse(id)` cuando un cambio pasa de pendiente a guardado, y `draggable-event.tsx` lo consume. Solo hay pulso en el camino del éxito, y siempre junto al texto o aviso que ya existe. Cubre: RF-47, RF-48, RF-49, RF-50, RF-51.
- **`event-morph`**:
  - `event-block.tsx`: al pulsar, llama a `setMorphOrigin` con su caja, su tramo (`data-segment`, nuevo en los tramos de varios días del mes) y su color.
  - `event-card.tsx`: tras colocarse, hace `morphIn` desde el origen y, al cerrar, `morphOut` hacia `findVisibleBlock` o la salida `pop`.
  - `event-modal.tsx` (la ventana y la hoja): recibe `morphId` de las rutas interceptadas y hace lo mismo antes de `router.back()`. En el cancelar de Escape anima y luego cierra.
  - "Editar" y "Abrir" de la tarjeta guardan la caja de la tarjeta como origen antes de navegar.
  Cubre: RF-55, RF-56, RF-57, RF-58, RF-59, RF-60, RF-61.
- **`settings-switches`**: `view-options-setting.tsx` ("Mostrar fines de semana") y `availability-setting.tsx` pasan de casilla a `Switch`, con su texto de ayuda y su error como hoy. Cubre: RF-40, RF-45.
- **`design-guard`** (`tests/unit/design-tokens.test.ts` y el nuevo `tests/unit/motion-tokens.test.ts`). Reglas nuevas:
  - ninguna `cubic-bezier` con valores de `y` fuera de [0, 1];
  - ninguna curva `ease-[…]` suelta ni `duration-<número>` en las clases;
  - cada `--motion-*-out` es el 80 % ±10 ms de su `-in`;
  - todos los tokens de duración son de 400 ms como mucho;
  - `7 × --stagger-step + --motion-row ≤ 400 ms`.
  Cubre: RF-3, RF-4, RF-5 y el RNF de tokens.

## Modelo de datos

No hay cambios en la base de datos ni migraciones. Solo hay estado en memoria del cliente:

- `MorphOrigin { eventId: string; segment: string | null; box: Box; color: string; at: number }`. Lo escribe un clic y lo lee la superficie que se abre en menos de 1 s. Uno a la vez.
- `MotionMark = { kind: "return"; from: Box } | { kind: "pulse" }` en un `Map<eventId, MotionMark & { at: number }>`. Se consume una vez y caduca a los 2 s.
- `Box { left, top, width, height }`, el mismo de `lib/calendar/popover.ts` (se importa, no se duplica).
- Tokens de `globals.css` (valores iniciales, ajustables en la revisión visual sin romper las reglas de la guardia):

| Token | Valor | Token | Valor |
|-------|-------|-------|-------|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--motion-pop-in` / `-out` | 200 / 160 ms | `--motion-dialog-in` / `-out` | 240 / 192 ms |
| `--motion-base-in` / `-out` | 220 / 176 ms | `--motion-fast-in` / `-out` | 150 / 120 ms |
| `--motion-row` | 180 ms | `--motion-pulse` | 300 ms |
| `--motion-reveal` | 400 ms | `--motion-move` | 300 ms |
| `--pop-scale` | 0.95 | `--press-scale` | 0.97 (ya existe) |
| `--stagger-step` | 30 ms | `--settle-delay` | 50 ms |
| `--arc-max` | 32 px | `--pulse-scale` | 1.04 |
| `--swap-scale` / `--swap-blur` | 0.5 / 4 px | `--knob-stretch` | 1.12 |

`--motion-base` y `--motion-fast` se quedan como alias de `-in` mientras se migran sus usos, y la última tarea de CSS los quita.

## Contratos e interfaces

- `originFrom(trigger: Box | { x: number; y: number }, panel: Box): string`: px relativos al panel, siempre dentro de él.
- `rubberBand(excess: number, max = 64): number`: devuelve 0 si `excess <= 0`, es creciente, `< max` y su pendiente baja. `banded(value, min, max, limit = 64): number`.
- `releaseDecision({ delta, velocity, threshold, speed = 0.5 }): "forward" | "back" | "stay"`: `forward` si `delta ≤ -threshold` o `velocity ≤ -speed`, `back` en el caso simétrico y `stay` en el resto. `lockAxis(dx, dy, slop = 10): "x" | "y" | null`.
- `flightKeyframes(from: Box, to: Box, steps = 8): Keyframe[]`: el primer fotograma es el desplazamiento completo y el último `translate: 0 0`. La separación máxima del arco es `min(32, distancia / 4)` cuando la distancia es de 48 px o más, y 0 si es menor.
- `play(el, keyframes, options): Animation | null`: con movimiento reducido o sin `animate`, aplica el último fotograma y devuelve `null`. `pulse(el): void`.
- `usePresence(open: boolean, exitMs: number): { mounted: boolean; leaving: boolean }`.
- `useFollowDrag({ axis, onMove?, onRelease, band? }): handlers`: los manejadores `onPointerDown/Move/Up/Cancel` para el elemento.
- `Switch` props: `checked`, `onCheckedChange(next)`, `label`, `description?`, `disabled?`, `pending?`.
- `SwapLabel` props: `busy`, `idle`, `busyText`. `IconSwap` props: `show: "a" | "b"`, `a`, `b`. `CrossfadeText` props: `text`, `className?`.
- `applyTheme(theme: ThemeId, origin?: { x: number; y: number }): void`, compatible con las llamadas de hoy.
- Atributos que lee el CSS: `data-leaving`, `data-entering`, `data-sheet`, `data-drawer`, `data-morph`, `data-enter-from="start|end"`, `data-reveal` (en `<html>`), `data-segment` (bloques del mes).

## Flujo principal paso a paso

**Abrir un evento desde su bloque y cerrarlo (ordenador)**

1. Clic en un `EventBlock` → `setMorphOrigin({ eventId, segment, box, color })` → `openCard(event, anchor)` (spec 019).
2. `EventCard` se monta con `data-morph`, se coloca con `placeCard` y, en `useLayoutEffect`, `takeMorphOrigin` le da la caja del bloque. `morphIn` anima su `translate` desde el bloque, su `clip-path` desde el tamaño del bloque hasta el suyo y la capa de color de 1 a 0, con `--ease-in-out` y `--motion-move` (RF-55, RF-56). `holdLive()` aplaza los refrescos (RF-61). La fila de acciones llega 50 ms después (RF-19).
3. Escape, "Cerrar" o un clic fuera → `findVisibleBlock`. Si hay bloque, `morphOut` hacia su caja actual y después se desmonta (RF-57). Si no, salida `pop` hacia el evento y después se desmonta (RF-58). El foco vuelve al bloque, como hoy.
4. "Editar" → `setMorphOrigin` con la caja de la tarjeta → navegación → la ventana interceptada hace `morphIn` desde la tarjeta (RF-60).

**Abrir un evento en el móvil**: el bloque es un enlace. El clic guarda el origen y la ruta interceptada monta `EventModal variant="sheet"`, que hace `morphIn` desde el bloque en lugar de subir desde abajo (RF-55). Sin origen, sube desde abajo (RF-59, RF-12).

**Deslizar de periodo**

1. `pointerdown` táctil en la vista → `useFollowDrag` espera 10 px para decidir el eje. Si es vertical, lo suelta y la página se desplaza (RF-27).
2. En horizontal, cada `pointermove` escribe `translate: dx 0` en el contenedor de la vista en el siguiente fotograma (RF-23, RF-26).
3. `pointerup` → `releaseDecision(dx, velocidad, 50)`. Con `forward` o `back`, `play()` saca la vista por ese lado en `--motion-fast-out` y llama a la navegación de periodo, cuya transición `cal-next/prev` hace entrar el nuevo por el lado contrario (RF-28, RF-25). Con `stay`, `play()` la devuelve a 0 con `--ease-in-out` (RF-29, RF-24). El `translate` se quita al acabar.

**Cambiar un ajuste con el interruptor**: pulsar → `aria-checked` cambia en el acto, la bolita viaja estirándose (RF-43, RF-44) → acción del servidor. Si sale bien, `pulse()` y el texto de estado de hoy (RF-47). Si falla, vuelve atrás animado y muestra el error (RF-45).

## Decisiones técnicas

- D1: **CSS para todo lo que no necesita medir y la Web Animations API para lo que sí**, las dos nativas (constitución, "Animación"). Descartada una librería de animación, porque P6 la prohíbe y la WAAPI ya da interrupción, curvas y promesas de fin. Cubre: RF-1 a RF-68.
- D2: **Evento → detalle con `translate` + `clip-path` y una capa de color**, sin escalar la superficie. Descartado `scale`, porque deforma el texto (RF-56). Descartados los elementos compartidos de `<ViewTransition name>`, por tres motivos: un nombre no puede repetirse en la página; Activity deja copias ocultas de la misma vista con los mismos bloques; y un evento de varios días tiene varios tramos con el mismo id. Cubre: RF-55, RF-56, RF-57, RF-60.
- D3: **Salidas con `usePresence` para lo que se desmonta y `[hidden]` con `allow-discrete` para lo que ya está siempre montado** (la lista de horas, los diálogos). Descartado dejar montados el menú y la tarjeta, porque cambiaría su gestión del foco y de los clics fuera (specs 017 y 019). Cubre: RF-9, RF-38, RF-65.
- D4: **Origen como variable CSS calculada con una función pura** desde la caja del disparador y la del panel. Descartados los orígenes fijos por componente, porque el menú y la ventana rápida cambian de lado según el sitio libre (`placeCard`). Cubre: RF-8, RF-9, RF-10.
- D5: **Dos curvas sin rebote**: `--ease-out` para entrar y salir, y `--ease-in-out` para moverse. La guardia rechaza cualquier `y` fuera de [0, 1]. Descartado seguir con la curva única `cubic-bezier(0.2, 0, 0, 1)`, porque no distingue los movimientos (RF-2). Cubre: RF-1, RF-2, RF-4.
- D6: **Duraciones en pares `-in`/`-out`** comprobadas por un test (80 % ±10 ms). Descartado calcular la salida con `calc()` en cada regla, porque la guardia no podría leer el valor final. Cubre: RF-3, RF-5, RF-6, RF-11.
- D7: **Escalonado con `nth-child` hasta 8** y solo bajo `data-entering`. Descartado `sibling-index()`, porque Safari no lo admite. Descartado escalonar siempre, porque Activity repite las animaciones de CSS al volver a mostrar una vista. Cubre: RF-16, RF-17, RF-18.
- D8: **Selector de vista con dos capas y la de arriba recortada**. Descartado mover una píldora por debajo del texto y cambiar el color con una transición, porque el color cambiaría de golpe o con un fundido, no justo por donde pasa la píldora (RF-35). Cubre: RF-34, RF-35.
- D9: **Revelado circular con la View Transition que ya usa `applyTheme`** y `clip-path: circle()` sobre `::view-transition-new(root)`, activado solo con `data-reveal`. Descartado un círculo de un `div` a pantalla completa, porque taparía la página sin dejar ver el tema nuevo debajo. Cubre: RF-36, RF-37, RF-39.
- D10: **Interruptor como `<button role="switch">`**: Espacio e Intro lo cambian sin código y lo anuncia con su nombre. Descartada la casilla con `role="switch"`, porque su `:checked` y el estado optimista de React se desfasan cuando la acción falla. Cubre: RF-40 a RF-46.
- D11: **Seguir al dedo escribiendo `translate` en `requestAnimationFrame`**, sin estado de React por fotograma, y la vista en `touch-pan-y` para que el navegador entregue el gesto horizontal. Descartado `setState` en cada `pointermove`, porque volvería a pintar toda la vista 60 veces por segundo. Cubre: RF-23, RF-26, RF-27, RF-30, RF-31.
- D12: **La goma del pellizco y del borde de un evento se devuelve con `scaleY`** (FLIP): al soltar, la altura se fija en el límite y lo que sobra vuelve con `transform`. Descartado animar la altura, porque la constitución solo deja animar `transform`, `opacity`, `filter` y recortes. Cubre: RF-32, RF-33.
- D13: **Marcas de regreso y de pulso en un almacén por id**, consumidas por el bloque en su `useLayoutEffect`. Descartado pasarlas por las props de la vista, porque el refresco del servidor vuelve a montar los bloques y cambia sus contenedores. Cubre: RF-20, RF-48.
- D14: **Detalle → edición con `<ViewTransition>` y `startTransition`**, como los cambios de vista de la 011. Descartado guardar en memoria el contenido anterior para solaparlo, porque duplicaría formularios con los mismos `id`. Cubre: RF-52.
- D15: **`play()` interrumpible con `commitStyles()` + `cancel()`**. Descartado `Animation.reverse()`, porque solo sirve para volver por el mismo camino y no para ir a un sitio nuevo (un bloque que se ha movido). Cubre: RF-63, RF-64.
- D16: **Ninguna librería nueva ni cambio de base de datos**. Descartado guardar en el perfil si el usuario quiere menos movimiento, porque la spec se basa en el ajuste del sistema operativo. Cubre: RNF y RF-66.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1 | motion-tokens, motion-utilities |
| RF-2 | motion-tokens |
| RF-3 | motion-tokens, design-guard |
| RF-4 | motion-tokens, design-guard |
| RF-5 | motion-tokens, design-guard |
| RF-6 | popovers, motion-utilities |
| RF-7 | motion-utilities, popovers |
| RF-8 | motion-origin, popovers |
| RF-9 | motion-origin, use-presence, popovers |
| RF-10 | motion-origin, popovers |
| RF-11 | dialogs, motion-utilities |
| RF-12 | dialogs |
| RF-13 | press-coverage, motion-utilities |
| RF-14 | press-coverage |
| RF-15 | press-coverage |
| RF-16 | lists, motion-utilities, use-enter-once |
| RF-17 | motion-utilities, use-enter-once |
| RF-18 | lists, use-enter-once |
| RF-19 | settle-details, motion-utilities |
| RF-20 | motion-flight, motion-marks, return-flight |
| RF-21 | motion-flight |
| RF-22 | motion-flight |
| RF-23 | follow-gesture |
| RF-24 | follow-gesture, band-limits, motion-play |
| RF-25 | motion-release, follow-gesture |
| RF-26 | follow-gesture |
| RF-27 | motion-release, follow-gesture |
| RF-28 | motion-release, follow-gesture |
| RF-29 | motion-release, follow-gesture |
| RF-30 | follow-gesture |
| RF-31 | follow-gesture |
| RF-32 | motion-band, band-limits, follow-gesture |
| RF-33 | motion-band, band-limits |
| RF-34 | view-switcher |
| RF-35 | view-switcher, motion-utilities |
| RF-36 | theme-reveal, motion-utilities |
| RF-37 | theme-reveal |
| RF-38 | header-reveal, motion-utilities, use-presence |
| RF-39 | theme-reveal |
| RF-40 | switch, settings-switches |
| RF-41 | switch |
| RF-42 | switch |
| RF-43 | switch |
| RF-44 | switch |
| RF-45 | switch, settings-switches |
| RF-46 | switch |
| RF-47 | success-pulse, motion-play |
| RF-48 | success-pulse, motion-marks |
| RF-49 | motion-play, motion-tokens |
| RF-50 | success-pulse |
| RF-51 | success-pulse |
| RF-52 | state-overlap, swap-label, crossfade-text |
| RF-53 | swap-label |
| RF-54 | icon-swap, icon-swaps |
| RF-55 | event-morph, motion-morph |
| RF-56 | motion-morph |
| RF-57 | event-morph, motion-morph |
| RF-58 | event-morph, motion-morph |
| RF-59 | event-morph |
| RF-60 | event-morph |
| RF-61 | motion-morph |
| RF-62 | selection-slide |
| RF-63 | motion-play |
| RF-64 | motion-play |
| RF-65 | use-presence, popovers |
| RF-66 | motion-tokens, motion-play |
| RF-67 | motion-play, band-limits |
| RF-68 | motion-utilities, dialogs, press-coverage, state-overlap (componentes compartidos de todas las pantallas) |

## Riesgos y mitigaciones

- R1: **El selector de vista se duplica durante el fundido de la vista** (la View Transition de la raíz hace una foto del selector viejo). Mitigación: `view-transition-name: view-switcher` con `::view-transition-group(view-switcher) { animation: none }` y la foto vieja oculta, para que se vea solo la capa viva. Se comprueba en la primera tarea del selector.
- R2: **Pasar la vista a `touch-pan-y` rompe el pellizco o un desplazamiento horizontal** (la semana en pantallas estrechas). Mitigación: se prueba en el iPhone antes de seguir. Si la semana necesita desplazamiento horizontal, `useFollowDrag` solo se activa cuando no hay desbordamiento horizontal, y el deslizar de hoy (al soltar) se queda como respaldo.
- R3: **`clip-path` animado sobre cristal (`backdrop-filter`) va lento en Safari de iOS.** Mitigación: durante la transformación, la superficie usa el fondo opaco `paper` (`data-morph`) y recupera el cristal al acabar. Se mide con la CPU ralentizada 4 veces (RNF).
- R4: **`findVisibleBlock` encuentra la copia oculta de Activity.** Mitigación: `checkVisibility()` más la intersección con la pantalla y con el contenedor `[data-grid-scroll]`. Hay un test con dos bloques del mismo id, uno oculto.
- R5: **jsdom no tiene `element.animate`, `checkVisibility` ni View Transitions.** Mitigación: `play()` aplica el estado final sin animar, y los tests de componentes comprueban estados y atributos (`data-leaving`, `aria-checked`), no fotogramas. Lo visual se revisa con capturas y a mano (P8).
- R6: **Un refresco en tiempo real a mitad de la transformación cambia el bloque de sitio.** Mitigación: `holdLive()` durante `morphIn`/`morphOut` (RF-61), y al cerrar se busca la caja actual, no la guardada (RF-57).
- R7: **Tocar 21 archivos con `SwapLabel` rompe tests que buscan el botón por su nombre.** Mitigación: el texto oculto lleva `aria-hidden`, así el nombre accesible es el mismo de hoy. Se corre `npm test` completo en esa tarea.
- R8: **El pulso y el regreso en arco se cruzan** (deshacer un evento que acababa de guardarse). Mitigación: una sola marca por id (la última gana) y `play()` cancela la animación anterior (RF-63).
- R9: **La hoja del detalle cambia de altura con `transition-[height]`** (spec 017), una propiedad que la constitución no deja animar. Mitigación: fuera del alcance de los RF de esta spec. Se mantiene tal cual y se anota como deuda en `tasks.md` si la revisión de rendimiento lo señala.

## Dudas abiertas

- Ninguna bloqueante. Los valores de la tabla de tokens son el punto de partida. Pueden ajustarse en la revisión visual (P9) sin tocar los RF, siempre dentro de las reglas de la guardia: sin rebote, salida al 80 % y 400 ms como mucho.
