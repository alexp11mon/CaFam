# Plan 011 — Rediseño visual: modo oscuro, transparencias y movimiento

Spec de origen: `specs/011-rediseno-visual/spec.md` (aprobada el 2026-10-29). Plan aprobado el 2026-10-29, con la D4. Constitución: `docs/constitution.md` (enmienda 3).

## Resumen de arquitectura

- **Tema:** los colores siguen siendo tokens de Tailwind (`bg-paper`, `text-ink`…), pero cada token pasa a ser una variable CSS con un valor claro y otro oscuro. El tema activo lo decide el atributo `data-theme` de `<html>` (`light`, `dark` o ninguno, que significa "como el sistema" y cae en `prefers-color-scheme`). Así casi ningún componente cambia.
- **Sin destello:** un script en línea en el `<head>` lee una cookie y pone el atributo antes del primer pintado. La elección se guarda en el perfil (`profiles.theme`), y la cookie es su copia en el dispositivo.
- **Transparencias y movimiento:** son utilidades CSS propias definidas en `globals.css` (`glass`, `press`…), más el componente `<ViewTransition>` de React 19.3 para los cambios de vista, periodo, filtros y tema. No se añaden dependencias.

```
<head> theme-script ──lee cookie cafam-theme──▶ <html data-theme="light|dark|(nada)">
globals.css: :root (claro) · [data-theme=dark] · @media(prefers-color-scheme:dark) :root:not([data-theme=light])
        │ tokens: stone paper ink muted line control danger on-ink pastel-ink mark on-mark
        │         accent* (por acento y tema) · glass* · backdrop · shadow-soft/float · motion-*
Ajustes ThemePicker ─┐
Rail/Más ThemeToggle ┴─ applyTheme() (atributo + meta theme-color + View Transition) ─▶ setTheme() ─▶ profiles.theme + cookie
signIn ─▶ cookie desde el perfil · signOut / proxy sin sesión ─▶ borra la cookie · AppFrame ThemeSync ─▶ corrige una cookie vieja
CalendarWorkspace ─ <ViewTransition key=vista+fecha> + tipos cal-view / cal-next / cal-prev / cal-filter
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `theme-schema` | `supabase/migrations/<ts>_profile_theme.sql` | Añade `profiles.theme`: `text not null default 'system'`, con `check` en `light`, `dark` o `system`. Lo protegen las políticas de `profiles`, en las que solo el dueño lee y escribe | No lo exponen `visible_people` ni `calendar_members_with_names` | RF-2, RF-4 |
| `theme-core` | `src/lib/theme/theme.ts` | Lógica pura: `THEME_IDS`, `themeSchema` (zod, en español), `THEME_COOKIE = "cafam-theme"`, `parseTheme()`, `effectiveTheme(theme, prefersDark)`, `nextToggleTheme()` y `THEME_SCRIPT` (la cadena del script en línea) | No toca el DOM fuera del script | RF-2, RF-6, RF-7, RF-8 |
| `palette` | `src/lib/theme/accents.ts` y `src/lib/theme/contrast.ts` | `NEUTRALS` pasa a tener los valores `light` y `dark`, más los tokens `onInk`, `pastelInk`, `mark` y `onMark`. Cada acento tiene `ink` y `edge` por tema. `contrast.ts` extrae el cálculo de contraste y la mezcla alfa (`composite`), que hoy vive dentro del test | No decide qué tema se ve | RF-9, RF-10, RF-15 |
| `tokens-css` | `src/app/globals.css` | Variables por tema (tres bloques: claro, oscuro explícito y oscuro del sistema). Tokens de cristal, degradado de fondo, sombras y movimiento. Utilidades `glass`, `glass-float`, `press` y `animate-*`. Reglas de `::view-transition-*`, de `<dialog>` con `@starting-style`, el respaldo `@supports not (backdrop-filter)` y `prefers-reduced-motion` | No contiene valores que no estén en `accents.ts` (los neutros y acentos los compara un test) | RF-5, RF-9, RF-13, RF-14, RF-20, RF-22, RF-23, RF-24, RF-25 |
| `token-migration` | Unos 20 componentes | Pasa a tokens que sirven en los dos temas: `text-white` sobre `bg-ink` → `text-on-ink`; el texto y los contornos sobre pastel (`event-chip`, `avatar`, puntos con `ink/15`) → `pastel-ink`; el logotipo → `mark`/`on-mark` (la marca no cambia con el tema) | No cambia la disposición ni el aspecto en claro | RF-10, RF-26 |
| `design-guard` | `tests/unit/design-tokens.test.ts` | La guardia pasa a las reglas de la enmienda 3 (D11) | — | RF-12, RF-22, RF-26 |
| `theme-boot` | `src/app/layout.tsx`, `(auth)/actions.ts`, `src/proxy.ts`, `components/shell/theme-sync.tsx`, `app/dashboard/layout.tsx` (lectura del perfil) | Mete el script en `<head>` y `themeColor` por `media`. `signIn` escribe la cookie desde el perfil; `signUp` y `signOut` la borran. El proxy la borra en una petición sin sesión. `ThemeSync` corrige la cookie y el atributo si el perfil dice otra cosa | No guarda nada en el perfil | RF-4, RF-7, RF-8, RF-11 |
| `theme-apply` | `src/lib/theme/apply-theme.ts` (cliente) | `applyTheme(theme)`: cambia el atributo y el `meta theme-color` dentro de `document.startViewTransition` si existe y no se pide movimiento reducido, y escribe la cookie | No llama al servidor | RF-3, RF-5, RF-11, RF-21, RF-23, RF-24 |
| `theme-picker` | `components/settings/theme-picker.tsx`, `app/dashboard/settings/actions.ts` (`setTheme`), la página de Ajustes | Tres opciones como el selector de acento: aplica al momento, guarda con `setTheme` y deshace el cambio si falla | — | RF-1, RF-3, RF-4 |
| `theme-toggle` | `components/shell/theme-toggle.tsx`, `side-rail.tsx`, `more-sheet.tsx`, `icons.tsx` (sol y luna) | Alterna entre claro y oscuro según el tema efectivo, con `nextToggleTheme` | No ofrece "Como el sistema" (spec, Dudas) | RF-6 |
| `glass-surfaces` | `side-rail`, `bottom-bar`, `more-sheet`, `event-modal`, `quick-create`, `confirm-dialog`, `toast`, los paneles del calendario (`next-event-card`, `mini-month`, filtros), `page-shell` y la página de Ajustes | Pone `glass` (en reposo) o `glass-float` (lo que flota) en esos contenedores, en lugar de `bg-paper` | No cambia su contenido | RF-12, RF-13, RF-14, RF-15 |
| `micro` | `components/ui/button.tsx`, `link-button.tsx`, `shell/bar-styles.ts`, `calendar/view-toolbar.tsx`, `settings/accent-picker.tsx`, `ui/select.tsx`, `text-field.tsx`, `text-area.tsx`, `time-field.tsx` | `press` (escala al pulsar y elevación de 1 px al pasar el puntero) y transición del anillo de foco | — | RF-16 |
| `view-motion` | `components/calendar/calendar-workspace.tsx`, `view-toolbar.tsx`, `lib/hooks/use-calendar-shortcuts.ts` y `lib/calendar/transition-types.ts` (puro) | Envuelve el área de la vista en `<ViewTransition key={vista + fecha}>` con `enter`/`exit` por tipo. Los enlaces y atajos de vista y periodo navegan con `transitionTypes` (`cal-view`, `cal-next`, `cal-prev`). Los interruptores de filtros cambian el estado dentro de `startTransition` + `addTransitionType("cal-filter")`, que produce un fundido | No anima nada que el navegador no soporte | RF-17, RF-18, RF-19, RF-24, RF-25 |
| `overlay-motion` | `globals.css` (reglas de `dialog`), `components/ui/toast.tsx` | Entrada y salida de `<dialog>` y `::backdrop` con `@starting-style` y `transition-behavior: allow-discrete`. El aviso sale con un estado `leaving` de 200 ms antes de quitarse | — | RF-20 |
| `validation` | Capturas y comprobación en el navegador | Todas las pantallas en los dos temas, con los acentos rojo y amarillo, y con movimiento reducido. Rendimiento de las animaciones en móvil | — | RF-26, requisitos no funcionales |

## Modelo de datos

- **`profiles.theme`**: `text not null default 'system'`, `check (theme in ('light','dark','system'))`. Una fila existente queda en `system` (RF-2). Se escribe con `setTheme` y la protegen las políticas de `profiles`.
- **Cookie `cafam-theme`**:
  - Valor `light`, `dark` o `system`; sin la cookie se aplica `system`.
  - `path=/`, `max-age` de 1 año, `SameSite=Lax`, `Secure` en producción y **sin `HttpOnly`**, porque la lee el script en línea.
  - No es un secreto ni identifica a nadie: es la copia del perfil en el dispositivo.
- **Tokens por tema** (valores de partida; el test de contraste los fija en la T3):

| Token | Claro (actual) | Oscuro (propuesta) |
|-------|----------------|--------------------|
| `stone` | `#E8E5DD` | `#171612` |
| `paper` | `#F2F0EA` | `#211F1B` |
| `ink` | `#141414` | `#F2F0EA` |
| `muted` | `#66635D` | `#A9A59C` |
| `line` | `#D6D1C4` | `#36332D` |
| `control` | `#857F75` | `#7F796F` |
| `danger` | `#B42318` | `#F97066` |
| `on-ink` (texto sobre `bg-ink`) | `#FFFFFF` | `#141414` |
| `pastel-ink` (texto sobre pastel) | `#141414` | `#141414` |
| `mark` / `on-mark` (logotipo) | `#141414` / `#E8E5DD` | igual |

  - **Acento en oscuro:** `fill` y `on-accent` iguales que en claro. `accent-ink` y `accent-edge` pasan a una variante clara de cada acento (por ejemplo, rojo `#F97066`, azul `#8AB4FF`, verde `#4FD18B`, amarillo `#F5C518`, morado `#B794F6` y gris `#B3AFA6`).
  - **Cristal:** `glass-bg` es `paper` con un alfa de 0,72 a 0,85, que fija el test de RF-15. Llevan además `glass-edge` (borde de 1 px), `glass-blur` (16 px), `shadow-soft` y `shadow-float`.
  - **Fondo:** `backdrop` es un degradado radial suave de dos tonos cercanos a `stone`, distinto en cada tema.
  - **Movimiento:** `motion-fast` 150 ms, `motion-base` 220 ms, `motion-slow` 400 ms (el máximo, RF-22), `motion-ease` y `motion-distance` 12 px, que pasa a 0 con movimiento reducido.

- **Valores finales (T3, 2026-10-29)**, comprobados en `accents.test.ts`:
  - Los neutros oscuros y las variantes oscuras de `accent-ink` son los de la tabla.
  - `accent-edge` en oscuro: rojo `#D92D20`, verde `#1F7A4A` y amarillo `#F5C518` (el relleno, ≥ 3:1). Azul `#8AB4FF`, morado `#B794F6` y gris `#B3AFA6` (la tinta, porque su relleno queda por debajo de 3:1 sobre `paper` oscuro).
  - Cristal: alfa 0,93 en claro y 0,92 en oscuro. Peor texto sobre cristal: 4,57:1 en claro y 4,68:1 en oscuro, con la tinta o un pastel detrás. Con valores más bajos (0,72 a 0,9) el texto secundario baja de 4,5:1.
  - Degradado de fondo: claro de `#E8E5DD` a `#E4E0D7` (el `#DDD9CE` propuesto dejaba `muted` en 4,24:1); oscuro de `#171612` a `#0F0E0B`.
  - El contraste lo calcula `contrastRatio` de `lib/calendar/palette.ts`, que ya existía; `lib/theme/contrast.ts` solo añade `composite`.

## Contratos e interfaces

- `setTheme(theme: string): Promise<{ error?: string }>`, Server Action en `settings/actions.ts`:
  - Valida con `themeSchema` y actualiza `profiles.theme` de la fila propia.
  - Escribe la cookie con `cookies().set` y hace `revalidatePath("/dashboard", "layout")`.
  - Errores en español: "No se ha podido guardar el tema. Inténtalo de nuevo." o el de conexión.
- `THEME_SCRIPT`: script en línea de menos de 600 bytes.
  - Lee `cafam-theme` de `document.cookie` y, si vale `light` o `dark`, pone `data-theme` en `<html>` y el `content` de los `meta[name=theme-color]`.
  - No lanza errores: va envuelto en `try`.
- `applyTheme(theme: ThemeId): void`:
  - Hace lo mismo en el cliente, dentro de `document.startViewTransition` si existe y no hay `prefers-reduced-motion`.
  - Escribe también la cookie, para que el cambio se aplique al momento aunque el servidor tarde (RF-3).
- `effectiveTheme(theme, prefersDark): "light" | "dark"`; `nextToggleTheme(effective): "light" | "dark"`.
- **Tipos de transición** (`lib/calendar/transition-types.ts`): `CAL_VIEW`, `CAL_NEXT`, `CAL_PREV` y `CAL_FILTER`, más `periodType(delta)`.
- **Utilidades CSS**:
  - `glass`: superficie en reposo.
  - `glass-float`: lo que flota, con la sombra de flotante.
  - `press`: microinteracción.
  - `bg-backdrop`: fondo de pantalla.

  Las clases `shadow-soft` y `shadow-float` salen de `@theme`.

## Flujo principal paso a paso

1. **Carga de una página** (RF-7, RF-8):
   - El navegador ejecuta `THEME_SCRIPT` antes de pintar el `<body>`. Con la cookie `dark`, `<html data-theme="dark">` aplica los tokens oscuros. Sin cookie, el bloque `@media (prefers-color-scheme: dark)` decide.
   - En una petición sin sesión, el proxy borra la cookie en la misma respuesta (RF-8).
2. **Inicio de sesión** (RF-4): `signIn` lee `profiles.theme` y escribe la cookie antes de redirigir, así que el primer pintado del panel ya va con el tema de la cuenta en cualquier dispositivo.
3. **Elegir en Ajustes** (RF-1, RF-3, RF-21):
   - `ThemePicker` llama a `applyTheme`, que hace un fundido con View Transition, cambia el atributo, `theme-color` y la cookie.
   - Después llama a `setTheme`. Si falla, vuelve al tema anterior y muestra el error.
4. **Acceso directo** (RF-6): `ThemeToggle` calcula el tema efectivo y aplica el contrario con el mismo flujo que el paso 3.
5. **Cambio del sistema** (RF-5): con "Como el sistema" no hay atributo, así que la media query cambia los tokens al momento sin JavaScript.
6. **Otro dispositivo con una cookie vieja** (RF-4, casos límite): el panel carga con la cookie vieja. `ThemeSync` ve que el perfil dice otra cosa y aplica el tema del perfil sin animación. Como mucho se ve un instante el tema anterior al cargar, lo que ya prevé la spec.
7. **Cambiar de vista o de periodo** (RF-17, RF-18):
   - El enlace o el atajo navega con `transitionTypes: ["cal-view"]`, `["cal-next"]` o `["cal-prev"]`. La navegación es una transición de React, y `<ViewTransition key>` hace salir la vista anterior y entrar la nueva: un fundido con 12 px de desplazamiento en el sentido del periodo, o un fundido con escala mínima al cambiar de vista.
   - `::view-transition { pointer-events: none }` deja pulsar durante la animación (RF-25). Una transición nueva salta la anterior, así que los cambios rápidos no se acumulan.
8. **Filtros** (RF-19): el interruptor actualiza el estado dentro de `startTransition` con el tipo `cal-filter`, y la vista hace un fundido de 220 ms entre la vista con y sin esos eventos.
9. **Ventanas** (RF-20): `showModal()` hace entrar el `<dialog>` con `@starting-style` (opacidad y 8 px) y `close()` lo hace salir con `allow-discrete`. El aviso entra igual y sale con `leaving`.
10. **Movimiento reducido** (RF-23): `motion-distance: 0`, `press` sin escala ni elevación, y las View Transitions quedan en un fundido de 150 ms; el cambio de tema no se anima.

## Decisiones técnicas

- D1: **Tokens con valor por tema mediante variables CSS y `data-theme` en `<html>`.** Descartado el `dark:` de Tailwind: obligaría a tocar unos 150 usos de `text-ink` y a mantener dos clases por elemento. Descartada `light-dark()`: no funciona antes de iOS 17.5 y dejaría la app sin colores en iPhones algo antiguos. Cubre: RF-3, RF-5, RF-9, RF-26.
- D2: **El oscuro se escribe dos veces** (`[data-theme="dark"]` y `@media … :root:not([data-theme="light"])`), y `accents.test.ts` comprueba que los dos bloques y `accents.ts` coinciden. Descartado generar el CSS con un script, porque añade un paso de build. Cubre: RF-5, RF-9.
- D3: **Script en línea con una cookie**, en lugar de leer el perfil en el layout raíz. Con `cacheComponents` el `<html>` no puede depender de la sesión sin `<Suspense>`, y el script es la única forma de pintar bien desde el primer fotograma. Descartado `localStorage`, porque `signIn` (servidor) no podría escribirlo y el primer inicio de sesión en otro dispositivo pintaría el tema equivocado. Cubre: RF-4, RF-7.
- D4: **Sin cookie y sin sesión, el tema del sistema.** El proxy borra la cookie en las peticiones sin sesión, y `signOut` y `signUp` también, de modo que no queda el tema de una cuenta en la pantalla de login (RF-8). La pantalla `/offline` la sirve el service worker sin pasar por el proxy: usa la cookie del dispositivo si la hay y, si no, el sistema. La cookie solo existe con una sesión iniciada en ese dispositivo, así que es el tema de esa cuenta. Descartado que `/offline` ignore la cookie, porque una persona con sesión vería el tema contrario al quedarse sin red. Cubre: RF-8 y el caso límite "Sin conexión".
- D5: **Tokens nuevos `on-ink`, `pastel-ink` y `mark`/`on-mark`.** El botón primario sigue siendo "tinta" (negro en claro, claro en oscuro) con el texto en `on-ink`. El texto sobre los pasteles es siempre oscuro (RF-10). El logotipo no cambia con el tema, como el icono de la PWA (ajustado el 2026-10-30 a petición del usuario: en oscuro el cuadrado `#141414` no se distinguía de la piedra `#171612`, así que se invierte, piedra clara con letras en tinta; el icono de la PWA no cambia). Descartado mantener el botón negro en oscuro: sobre `#171612` no tendría el contraste de 3:1 que P9 pide a un elemento gráfico. Cubre: RF-9, RF-10, RF-26.
- D6: **Utilidades `glass` y `glass-float` en `globals.css`**: fondo `glass-bg`, `backdrop-filter: blur(16px) saturate(1.4)`, borde `glass-edge` y sombra, con `@supports not (backdrop-filter: blur(1px))` → fondo `paper` opaco. Descartado escribir `backdrop-blur-*` y `bg-*/alpha` en cada componente: la constitución exige tokens y la guardia no podría comprobarlo. Cubre: RF-12, RF-14.
- D7: **Contraste sobre cristal con el peor fondo calculado.** `composite(glass-bg, alfa, fondo)` sobre cada color que puede quedar detrás:
  - los dos tonos del degradado;
  - `ink`;
  - los rellenos de acento;
  - los seis pasteles de la paleta.

  El resultado tiene que dar 4,5:1 con `ink` y `muted`, y con `accent-ink` donde se usa. El alfa sube hasta que pasa. Descartado medir capturas de pantalla, porque no se puede repetir en un test. Cubre: RF-15.
- D8: **View Transitions de React** (`<ViewTransition>`, `addTransitionType` y `transitionTypes` de `Link` y `router.push`), según la guía de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Sin soporte del navegador, la app funciona igual sin animar (RF-24). Descartado animar a mano con CSS y estados de montaje, porque no se puede animar la salida de una vista que React ya ha quitado. Cubre: RF-17, RF-18, RF-19, RF-24.
- D9: **`<ViewTransition key={vista+fecha}>` en el área de la vista del workspace**, no en `page.tsx`, porque la vista se pinta en el cliente dentro del workspace. Las vistas ocultas por Activity no se animan al volver, porque no cambian de `key` (caso límite). Descartado envolver la página: los parámetros de búsqueda no remontan el `page.tsx`. Cubre: RF-17, RF-18.
- D10: **Fundido de `<dialog>` con `@starting-style` y `transition-behavior: allow-discrete`** sobre `opacity`, `transform`, `display` y `overlay`. Donde no se soporta, se abre y cierra sin animación. Descartado mantener la ventana montada con temporizadores, porque choca con el cierre que ya gestiona `EventModal` (trampas de Activity de la spec 008). Cubre: RF-20.
- D11: **Guardia de diseño nueva:**
  - Prohíbe `backdrop-blur-*`, los degradados de Tailwind (`bg-linear-*` y similares), `shadow-*` salvo `shadow-soft` y `shadow-float`, `text-white`, `text-black` y el variante `dark:`.
  - Prohíbe duraciones de más de 400 ms (`duration-[5-9]\d\d`, `duration-1000` y valores arbitrarios mayores).
  - Mantiene las prohibiciones que no cambian: hex sueltos, paleta de Tailwind, `bg-white`, monoespaciada, mayúsculas espaciadas y emojis.
  - `shadow-float` y `glass-float` solo se permiten en la lista de lo que flota.

  Descartado quitar la guardia, porque la enmienda 3 exige que todo sean tokens. Cubre: RF-12, RF-22, RF-26.
- D12: **`theme-color` con dos `meta` por `media`** desde `viewport.themeColor`, que `applyTheme` y el script sobrescriben con el tema elegido. El `manifest` sigue en piedra, porque no admite un valor por tema. Cubre: RF-11, "donde el navegador lo permita".
- D13: **`press` = `transition: transform var(--motion-fast)`**, más `active:scale(0.97)` y `hover:translateY(-1px)` solo con `(hover: hover)`. Descartado animar también el color de fondo con una duración larga, porque basta con `transition-colors`. Cubre: RF-16.
- D14: **El acceso directo alterna claro y oscuro según el tema efectivo**, y "Como el sistema" solo se elige en Ajustes (spec, Dudas). Cubre: RF-6.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1 | theme-picker |
| RF-2 | theme-schema, theme-core |
| RF-3 | theme-apply, theme-picker |
| RF-4 | theme-schema, theme-boot, theme-picker |
| RF-5 | tokens-css, theme-apply |
| RF-6 | theme-toggle, theme-core |
| RF-7 | theme-core, theme-boot |
| RF-8 | theme-core, theme-boot |
| RF-9 | palette, tokens-css |
| RF-10 | palette, token-migration |
| RF-11 | theme-boot, theme-apply |
| RF-12 | glass-surfaces, tokens-css, design-guard |
| RF-13 | tokens-css, glass-surfaces |
| RF-14 | tokens-css, glass-surfaces |
| RF-15 | palette, glass-surfaces |
| RF-16 | micro |
| RF-17 | view-motion |
| RF-18 | view-motion |
| RF-19 | view-motion |
| RF-20 | overlay-motion, tokens-css |
| RF-21 | theme-apply |
| RF-22 | tokens-css, design-guard |
| RF-23 | tokens-css, theme-apply |
| RF-24 | view-motion, theme-apply, tokens-css |
| RF-25 | view-motion, tokens-css |
| RF-26 | token-migration, design-guard, validation |

## Riesgos y mitigaciones

- R1: **Rendimiento del desenfoque en móviles de gama media** (requisito no funcional). Mitigación: `glass` solo en los contenedores de RF-12, nunca en las filas de eventos ni dentro de la rejilla que se desplaza. Se mide con el panel de rendimiento de Chrome a 4× CPU. Si no llega a 60 fps, el desenfoque baja a 8 px o la superficie pasa a opaca en ese contenedor.
- R2: **Un `text-ink` sobre pastel que se pierda en la migración** y quede claro sobre claro en oscuro. Mitigación: buscar todos los `style={{ backgroundColor` (17 archivos) y revisar los que tienen texto encima, más una comprobación del oscuro en las capturas del mes y de los avatares.
- R3: **Las View Transitions y Activity (spec 008)**: una ruta interceptada oculta podría animarse. Mitigación: la `key` solo está en el área de la vista. La ventana de evento no está dentro de un `<ViewTransition>` y sigue con su cierre actual. Se repiten los tests de `event-modal`.
- R4: **jsdom no tiene `startViewTransition`, `matchMedia` ni `@starting-style`.** Mitigación: `applyTheme` comprueba que existan, y los tests simulan `matchMedia` y miden atributos y llamadas, no animaciones. Las animaciones se revisan en el navegador.
- R5: **Que el script en línea falle o tarde.** Mitigación: va envuelto en `try`, y sin él la página se ve en el tema del sistema, sin romperse.
- R6: **Un cristal poco legible sobre la rejilla.** Mitigación: D7 fija el alfa por cálculo, y la revisión con capturas del calendario mira las superficies que se superponen al contenido (la barra inferior en el móvil).
- R7: **La rama de la spec y producción.** La migración `profile_theme` se aplica en dev con `npm run db:push`; en producción la aplica el usuario, como siempre.

## Pasos fuera del repositorio (los ejecuta el usuario)

1. Fusionar y publicar: `git switch main && git merge --ff-only 011-rediseno-visual && git push origin main 011-rediseno-visual`.
2. Migración en producción:
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```

## Dudas abiertas

- Ninguna. La D4 (`/offline` usa el tema guardado en el dispositivo y, si no hay, el del sistema) quedó aprobada con el plan el 2026-10-29.
