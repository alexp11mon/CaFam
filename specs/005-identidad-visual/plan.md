# Plan 005 — Identidad visual

> Estado: **Aprobado** por el usuario (2026-10-22), incluidas la tipografía Inter Tight, los seis acentos y la propuesta de icono.
> Spec de origen: `specs/005-identidad-visual/spec.md` (aprobada el 2026-10-22). Constitución: `docs/constitution.md` (P9 y "Identidad visual y diseño de interfaz"). Parte del código de las specs 001 a 004.

## Resumen de arquitectura

Rediseño sobre la misma arquitectura: monolito Next.js 16 con Server Components, Server Actions y Supabase con RLS. No hay dependencias nuevas.

- **Diseño por tokens.** Los colores, la tipografía y los radios viven en `globals.css`. El color de acento son tres variables CSS que cambian según el atributo `data-accent` del contenedor de la app.
- **Marco común.** Un `layout.tsx` nuevo en `/dashboard` pinta la barra lateral (escritorio) o la barra inferior (móvil) y el contenedor del acento. El acento se lee del perfil en el servidor, así que llega pintado desde el primer HTML.
- **Lo nuevo es lógica pura testeada más componentes:** la vista agenda, el mini calendario, los avatares y el próximo evento. Como en la spec 002, los cálculos de fechas están en `lib/calendar`.
- **Un solo cambio de base de datos:** una columna `accent` en `profiles`, protegida por las políticas que ya existen.

```
Navegador ─▶ /dashboard/layout.tsx ── <Suspense> AppFrame (lee profiles.accent) ── <div data-accent="red|blue|…">
                                          ├ SideRail (≥1024 px)  /  BottomBar + "Más" (<1024 px)
                                          └ página: calendar (agenda|month|week|day) · calendars · settings · join · import · events…
             /dashboard/calendar ── CalendarContent ── panel: MiniMonth · NextEventCard · CalendarFilters (avatares)
                                                    └ AgendaView | MonthView | WeekView | DayView
globals.css ── @theme (stone, paper, ink, muted, line, accent, on-accent, accent-ink, fuente)
             └ [data-accent=x] { --accent… } × 6
Supabase ── profiles.accent (check en 6 valores, por defecto 'red'; RLS "solo el propio" ya existente)
```

## Módulos y responsabilidades

| Módulo | Ubicación | Qué hace | Qué no hace | RF |
|--------|-----------|----------|-------------|----|
| `tokens` | `src/app/globals.css`, `src/app/layout.tsx` | Define en `@theme` los tokens `stone`, `paper`, `ink`, `muted`, `line`, `accent`, `on-accent` y `accent-ink`, los seis bloques `[data-accent=…]`, la fuente con `next/font` y el fondo `stone`. El rojo va en `:root` para las páginas sin sesión. Elimina `brand`, `brand-soft` y Geist Mono | No sabe qué acento tiene el usuario | RF-1, RF-3, RF-11, RF-14 |
| `accents` | `src/lib/theme/accents.ts` | Lista cerrada de los seis acentos (`id`, nombre en español, `fill`, `onFill`, `ink`), `DEFAULT_ACCENT = "red"`, `isAccent` y el esquema `zod`. Es la fuente de los valores de `globals.css` y de su test de contraste | No toca el DOM ni la base de datos | RF-6, RF-10, RF-14 |
| `accent-migration` | `supabase/migrations/2026102310…_profile_accent.sql` | Añade la columna `profiles.accent` (`text not null default 'red'` con `check` en los seis valores) | No crea políticas: ya vale `profiles` "leer/actualizar solo el propio" | RF-8, RF-10, RF-13 |
| `settings` | `src/app/dashboard/settings/page.tsx`, `actions.ts` | Pantalla Ajustes con la sección "Color de acento". La acción `setAccent` valida con `zod`, actualiza la fila propia y llama a `revalidatePath("/dashboard", "layout")` | No guarda nada más del perfil (spec 006) | RF-6, RF-8, RF-12, RF-13 |
| `accent-picker` | `src/components/settings/accent-picker.tsx` | Grupo de radios con muestra y nombre. Al elegir, cambia `data-accent` del contenedor sin recargar, llama a `setAccent` y, si falla, vuelve al anterior y muestra el error | No decide permisos | RF-6, RF-7, RF-12 |
| `app-frame` | `src/app/dashboard/layout.tsx`, `src/components/shell/app-frame.tsx` | Lee `profiles.accent` dentro de `<Suspense>`, envuelve las páginas en `<div data-accent>` y monta `SideRail` y `BottomBar` | No pinta el contenido de cada página | RF-9, RF-16, RF-18 |
| `nav` | `src/lib/shell/nav.ts` | Función pura: lista de destinos y `activeSection(pathname)` | Sin JSX | RF-16, RF-18, RF-20 |
| `side-rail` | `src/components/shell/side-rail.tsx` | Barra lateral estrecha (solo `lg:` y más): marca, iconos con nombre accesible y tooltip, sección activa y "Cerrar sesión" (formulario `signOut`) | No aparece por debajo de 1024 px | RF-16, RF-20, RF-51 |
| `bottom-bar` | `src/components/shell/bottom-bar.tsx`, `more-sheet.tsx` | Barra inferior (por debajo de `lg`) con Calendario, Mis calendarios, "+ Evento" (píldora negra central) y "Más". "Más" abre un `<dialog>` con Unirme, Importar, Ajustes y Cerrar sesión | No aparece desde 1024 px | RF-18, RF-20, RF-22 |
| `icons` | `src/components/shell/icons.tsx` | Iconos SVG propios en línea (trazo de 1,5 px, 20 px): calendario, calendarios, unirme, importar, ajustes, salir, más, mas, chevrones | Sin librería de iconos (P6) | RF-16, RF-18 |
| `brand` | `src/components/brand/logo.tsx`, `public/icons/icon.svg`, `public/icons/*.png`, `src/app/icon.svg` | Marca nueva (monograma "CF" y la palabra CaFam) e iconos de la PWA regenerados desde el SVG | No sigue el acento: es negra y piedra | RF-51, RF-52 |
| `pwa` | `src/app/manifest.ts`, `src/app/layout.tsx` (`viewport`, `appleWebApp`), `public/sw.js` | `theme_color` y `background_color` en piedra, `start_url` en `/dashboard/calendar` y `CACHE_NAME` subido a `cafam-v2` para borrar la caché antigua | Sigue sin cachear HTML con sesión ni datos | RF-52, RF-53, RF-54 |
| `routes` | `src/app/dashboard/page.tsx`, `src/app/dashboard/calendars/page.tsx`, `src/app/(auth)/actions.ts`, `src/lib/auth/route-access.ts` | `/dashboard` redirige a `/dashboard/calendar`. La lista de calendarios pasa a `/dashboard/calendars` ("Mis calendarios"). Login y "solo sin sesión" llevan directamente a `/dashboard/calendar` | No cambia qué rutas están protegidas | RF-15, RF-21 |
| `agenda-range` | `src/lib/calendar/ranges.ts` | Añade la vista `agenda` (14 días desde `date`, navegación de ±14 días) y la hace vista por defecto | — | RF-15, RF-30, RF-31, RF-40, RF-41, RF-44 |
| `agenda-layout` | `src/lib/calendar/agenda.ts` | Lógica pura: días de la agenda con sus eventos ordenados (reutiliza `dayEvents`), etiquetas de continuación ("desde ayer", "hasta mañana 01:00"), posición de la línea de la hora actual y fecha completa accesible | Sin JSX | RF-32–RF-37, RF-39, RF-43 |
| `agenda-view` | `src/components/calendar/agenda-view.tsx`, `agenda-day.tsx`, `event-row.tsx` | Pinta cada día con el número gigante, la abreviatura en `accent-ink`, las filas de evento, "Sin eventos", "Crear evento este día" y la línea de la hora actual | No consulta datos | RF-32–RF-39, RF-42 |
| `clock` | `src/lib/hooks/use-now.ts` | Hook con `useSyncExternalStore`: hora actual que se actualiza cada 30 s y al volver la pestaña a primer plano (`visibilitychange`) | — | RF-39, RF-47, RF-48 |
| `mini-month` | `src/components/calendar/mini-month.tsx`, `src/lib/calendar/month-marks.ts`, acción `loadMonthMarks` en `src/app/dashboard/calendar/mini-month-actions.ts` | Mes con lunes primero, hoy en relleno de acento y hasta 3 puntos por día de los calendarios visibles. Al pulsar un día navega a `calendarHref(view, day)`. El cambio de mes es estado del cliente y pide las marcas a `loadMonthMarks` (lectura con RLS) | No cambia la vista principal al cambiar de mes | RF-23–RF-26 |
| `avatars` | `src/lib/people/avatar.ts`, `src/components/people/avatar.tsx` | Funciones puras `initials(name)` (primer carácter visible de hasta dos palabras) y `assignTints(personIds)` (6 tintes pálidos separados ≥ 60° de tono, asignados por orden de `id`, sin repetir hasta agotar). El componente es un círculo con iniciales en tinta | Sin fotos | RF-27, RF-28 |
| `filters` | `src/components/calendar/calendar-filters.tsx` (existente) | Las personas pasan a ser botones-avatar conmutables (`aria-pressed`), con calendarios y categorías debajo. La lógica de guardado de la spec 002 no cambia | — | RF-17, RF-19, RF-29 |
| `next-event` | `src/lib/calendar/next-event.ts`, `src/components/calendar/next-event-card.tsx` | `pickNextEvent(events, now, visibleCalendarIds)` y `formatCountdown(ms)`. La tarjeta (cliente) usa `useNow`, elige el siguiente, muestra título, hora, calendario y cuenta atrás, y enlaza al detalle. El servidor le pasa los eventos con hora de las próximas 48 h | Sin notificaciones | RF-45–RF-50 |
| `calendar-page` | `src/app/dashboard/calendar/page.tsx`, `calendar-workspace.tsx`, `view-toolbar.tsx` | Compone el panel (mini mes, próximo evento, filtros) y la vista. Añade "Agenda" al selector. Carga `location` y el nombre del calendario para la agenda | — | RF-17, RF-19, RF-30, RF-43 |
| `queries` | `src/lib/calendar/queries.ts` | `getEventsInRange` añade `location`. Nueva `getAccent(supabase, userId)` | — | RF-9, RF-35 |
| `ui-kit` | `src/components/ui/*` | Reestilo de `Button` (primaria: píldora en tinta con texto blanco; secundaria: borde `line` sobre `paper`; peligro: texto rojo oscuro), `LinkButton`, campos, `Select`, `TextArea`, `FormAlert` y `ConfirmDialog` con tokens | Sin variantes de un solo uso en páginas | RF-1, RF-2 |
| `restyle` | Todas las páginas de la lista de RF-1 y sus componentes (`auth`, `calendar`, `sharing`, `import`, `pwa`, `dashboard`) | Sustituye clases `brand` y colores sueltos por tokens. Los chips de mes y semana pasan a texto en tinta con barra de color (RF-4). Portada, login, registro, invitación y sin conexión usan la marca nueva | No cambia lógica, textos funcionales ni validaciones | RF-1, RF-2, RF-4, RF-5, RF-11 |
| `design-guard` | `tests/unit/design-tokens.test.ts` | Falla si `src/` usa `brand`, `#RRGGBB` en clases de Tailwind (`[#…]`), `font-mono`, `bg-gradient`, `shadow-` en elementos que no flotan (lista blanca: `dialog`, menús) o emojis en textos | — | RF-1, RNF P9 |

## Modelo de datos

- `profiles.accent text not null default 'red'`, con `check (accent in ('red','blue','green','yellow','purple','gray'))`.
  - Las filas existentes quedan en `'red'` (RF-10).
  - Leer y actualizar ya está limitado a la fila propia por `profiles_select_own` y `profiles_update_own` (RF-13). Un test de base de datos lo comprueba con dos usuarios.
  - `handle_new_user` no cambia: el valor por defecto basta.
  - `visible_people()` y `calendar_members_with_names` no exponen la columna (P3).
- Sin tablas nuevas. Se regenera `src/types/database.ts`.
- Valores de los acentos, medidos con `contrastRatio` de `lib/calendar/palette.ts` sobre `stone #E8E5DD` y `paper #F2F0EA`:

  | Acento | `fill` (relleno) | `onFill` (texto encima) | `ink` (texto y líneas sobre el fondo) | Texto sobre el relleno | `ink` sobre stone / paper |
  |--------|------------------|-------------------------|----------------------------------------|---------------|---------------|
  | Rojo (por defecto) | `#D92D20` | blanco | `#B42318` | 4,83 | 5,22 / 5,77 |
  | Azul | `#2563EB` | blanco | `#1D4ED8` | 5,17 | 5,32 / 5,88 |
  | Verde | `#1F7A4A` | blanco | `#186A3F` | 5,33 | 5,26 / 5,81 |
  | Amarillo | `#F5C518` | tinta `#141414` | `#7A5C00` | 11,30 | 4,97 / 5,49 |
  | Morado | `#7C4DCC` | blanco | `#6B3FBF` | 5,54 | 5,40 / 5,97 |
  | Gris | `#5F5C55` | blanco | `#5F5C55` | 6,67 | 5,30 / 5,85 |

- **Neutros:**
  - `stone #E8E5DD` (fondo) y `paper #F2F0EA` (paneles).
  - `ink #141414`: 14,6 sobre stone y 16,2 sobre paper.
  - `muted #66635D`: 4,76 sobre stone y 5,25 sobre paper.
  - `line #D6D1C4` (bordes de controles y separadores; P9 no exige 3:1 a lo decorativo).
  - Peligro `#B42318`, igual que el `ink` del rojo.
- **Regla de uso** (test en `accents.test.ts`):
  - Texto y líneas finas usan siempre `accent-ink`.
  - Un relleno solo lleva `on-accent` encima.
  - Si un relleno no llega a 3:1 contra la superficie (solo el amarillo: 1,30), la forma lleva un borde de 1 px en `accent-ink`.

## Contratos e interfaces

### Rutas

| Ruta | Cambio |
|------|--------|
| `/dashboard` | Redirige a `/dashboard/calendar` (para enlaces y marcadores antiguos) |
| `/dashboard/calendar?view=agenda\|month\|week\|day&date=YYYY-MM-DD` | `agenda` nueva y vista por defecto. Una `view` o `date` no válida → agenda desde hoy (RF-44; sustituye el "mes de hoy" de la spec 002 por RF-15) |
| `/dashboard/calendars` | Nueva: "Mis calendarios", con el contenido del panel actual sin saludo ni "Cerrar sesión" (pasan al marco) |
| `/dashboard/settings` | Nueva: Ajustes → "Color de acento" |
| Resto | Sin cambios de URL. Los enlaces "Volver al panel" pasan a "Volver a Mis calendarios" (`/dashboard/calendars`) o al calendario, según de dónde vengan |
| `manifest.start_url` | `/dashboard/calendar` |

### Server Actions

- `setAccent(accent: string): Promise<{ error?: string }>`:
  - Valida con `accentSchema`. Si no es válido: "Elige uno de los colores disponibles.".
  - Hace `update profiles set accent where id = userId` con `select` para contar filas.
  - Con 0 filas o error: "No se ha podido guardar el color. Inténtalo de nuevo.". Un fallo de red da el mensaje `connection` de siempre.
  - Si va bien, `revalidatePath("/dashboard", "layout")`. No redirige.
- `loadMonthMarks(month: "YYYY-MM"): Promise<{ marks: Record<string, string[]> } | { error: string }>`:
  - Devuelve, para cada fecha del mes, los ids de calendario con eventos (RLS limita las filas). Calcula los días con `eventDayKeys` en la zona del perfil, leída en el servidor.
  - Si el mes no es válido devuelve `error` y el mini calendario se queda en el mes anterior.

### Componentes (props principales)

- `AgendaView({ days, events, timeZone, today, now?, canCreate })`, donde `events` son `CalendarEventItem` con `location` y `calendarName`.
- `MiniMonth({ month, selected, today, view, initialMarks, colors, visibleCalendarIds, loadMonthMarks })`.
- `NextEventCard({ events })`, con eventos de las próximas 48 h (id, título, inicio, fin, calendarId y nombre), filtrados en el cliente por visibilidad.
- `Avatar({ name, tint, size })`.
- `AccentPicker({ current, setAccent })`.

### Textos nuevos (español)

- **Agenda:**
  - Vista "Agenda".
  - Navegación: "14 días anteriores", "14 días siguientes" y "Hoy".
  - Día vacío: "Sin eventos". Botón "Crear evento este día".
  - Continuaciones: "Todo el día", "Desde ayer" y "Hasta el {día} a las {hora}".
- **Próximo evento:**
  - Título "Próximo evento".
  - Cuenta atrás: "en menos de 1 min", "en {m} min" y "en {h} h {m} min".
  - Sin eventos: "Nada en las próximas 24 horas".
- **Ajustes:** "Ajustes", "Color de acento" y los nombres de los colores: Rojo, Azul, Verde, Amarillo, Morado y Gris.
- **Navegación:** "Calendario", "Mis calendarios", "Unirme con código", "Importar calendario", "Ajustes", "Cerrar sesión", "Más" y "+ Evento".

## Flujo principal paso a paso

1. **Entrada.** El usuario inicia sesión. `signIn` redirige a `/dashboard/calendar` (RF-15). El layout de `/dashboard` lee `profiles.accent` en el servidor y envuelve la página en `data-accent="blue"`, así que el primer HTML ya lleva su acento (RF-9). Mientras carga, el esqueleto no usa acento, de modo que nunca aparece el rojo por error.
2. **Vista por defecto.** `parseViewParams` sin parámetros devuelve `agenda` y hoy. `getVisibleRange("agenda")` da 14 días y la consulta de eventos los cubre (RF-30, RF-31, RF-43).
3. **Pintado de la agenda.** `agenda.ts` agrupa con `dayEvents`: primero los de día completo y luego por hora (RF-34). Repite los eventos de varios días (RF-36) y calcula dónde va la línea de la hora actual con `useNow` (RF-39). `AgendaView` pinta el número gigante con `aria-label` de fecha completa (RF-32, RF-33), las filas (RF-35) y "Sin eventos" (RF-37). Si hay algún calendario editable, añade "Crear evento este día", que enlaza a `/dashboard/events/new?date=` (RF-38).
4. **Panel.** En escritorio se ve siempre; en móvil, con el botón "Calendarios y filtros" (RF-17, RF-19). `MiniMonth` muestra el mes de `date` con marcas calculadas en el servidor (RF-23, RF-24). Al cambiar de mes llama a `loadMonthMarks` (RF-26) y al pulsar un día navega a esa fecha en la vista actual (RF-25).
5. **Próximo evento.** `NextEventCard` elige con `pickNextEvent` el primer evento con hora, no empezado, con inicio en menos de 24 h y en un calendario visible (RF-45). Muestra la cuenta atrás (RF-46) y la actualiza con `useNow` (RF-47). Cuando empieza, pasa al siguiente (RF-48). Si no hay ninguno, dice "Nada en las próximas 24 horas" (RF-49). Pulsarla abre el detalle (RF-50).
6. **Filtros.** Pulsar un avatar oculta o muestra sus calendarios con la acción existente `setPersonVisibility` (RF-29). La agenda, el mini mes y el próximo evento se filtran en el cliente al instante (D7 de la spec 002).
7. **Cambio de acento.** En Ajustes el usuario elige "Verde". `AccentPicker` cambia `data-accent` al momento (RF-7) y llama a `setAccent` (RF-8). Si falla, vuelve al anterior y muestra el error (RF-12). En otro dispositivo, la siguiente carga lee `profiles.accent` (RF-9).
8. **Navegación.** Desde 1024 px se usa la barra lateral; por debajo, la barra inferior. "Más" abre la hoja con el resto de destinos y la sección activa se marca con `aria-current="page"` (RF-16, RF-18, RF-20). "+ Evento" lleva a `/dashboard/events/new`, que ya trata el caso sin calendarios editables (RF-22).
9. **Instalación.** El manifest y el `viewport` anuncian el color piedra y los iconos nuevos (RF-52, RF-53). Al publicar, el service worker `cafam-v2` se activa y borra `cafam-v1` (RF-54).

## Decisiones técnicas

- D1: **Tipografía Inter Tight** (variable, 400–800) con `next/font/google`, autoalojada en el build y con cifras tabulares (`tnum`). Descartadas Geist (la que trae la plantilla, sin carácter propio), Helvetica/SF (de pago o solo de Apple) y Schibsted Grotesk (no he verificado su `tnum`). Inter Tight es la neo-grotesca gratuita más cercana a la referencia y sus pesos 800 dan el número gigante. Una tarea comprueba que `tabular-nums` cambia el ancho de los dígitos. Cubre: RF-1, RF-32, RNF.
- D2: **Acento como atributo `data-accent` sobre un contenedor**, con tres variables CSS (`--accent`, `--on-accent`, `--accent-ink`) que Tailwind expone con `@theme inline`. Descartadas las clases distintas por acento (multiplican el CSS y las pruebas) y el estilo en línea calculado en JS (rompe la regla de "solo tokens"). Cubre: RF-3, RF-7, RF-14.
- D3: **El acento se lee en el servidor en el layout de `/dashboard`**, dentro de `<Suspense>` como exige `cacheComponents`. Descartado leerlo en el cliente (se vería un destello del rojo, contra RF-9) y meter `cookies()` en el layout raíz (rompe el build, ver AGENTS §9). Las páginas públicas usan el rojo de `:root` (RF-11). Cubre: RF-9, RF-11.
- D4: **Columna en `profiles` en vez de tabla nueva**. Descartadas una tabla `user_settings` (sobra para un valor y exigiría RLS y trigger nuevos) y `localStorage` (no sigue al usuario, decisión de la entrevista). La política existente ya cumple RF-13. Cubre: RF-8, RF-10, RF-13.
- D5: **`/dashboard` redirige a `/dashboard/calendar`**, y la lista de calendarios se mueve a `/dashboard/calendars`. Descartado pintar el calendario en `/dashboard`: obligaría a reescribir la URL de todas las vistas, `calendarHref`, los `revalidatePath` y los tests de la spec 002. Login y `start_url` apuntan directamente a la URL final para no pasar por la redirección. Cubre: RF-15, RF-21.
- D6: **Agenda como cuarta vista de `ranges.ts`**, reutilizando `getVisibleRange`, `dayEvents` y `eventDayKeys`. Descartado un componente con su propia consulta: duplicaría la lógica de zonas y días completos (RF-43). Cubre: RF-30, RF-31, RF-34, RF-36, RF-40, RF-41, RF-43, RF-44.
- D7: **Marco con `layout.tsx` de `/dashboard`** en vez de repetir cabecera en cada página. Descartado envolver página a página: 13 páginas con el mismo marco. Hay que vigilar la Activity de `cacheComponents` (R3). Cubre: RF-16, RF-18.
- D8: **Barra lateral de solo iconos** con nombre accesible y tooltip visible al pasar el ratón o al enfocar. Descartada una barra con etiquetas (230 px), porque la referencia y el panel ya ocupan el ancho y son 6 destinos. Cubre: RF-16.
- D9: **Hoja "Más" con `<dialog>` nativo**, como `ConfirmDialog`. Descartado un menú propio con gestión de foco a mano. Cubre: RF-18.
- D10: **Mini calendario con mes en estado de cliente y acción `loadMonthMarks`**. Descartado un parámetro `?month=` en la URL: volvería a pintar toda la página y la vista principal por mirar otro mes (RF-26). Cubre: RF-23–RF-26.
- D11: **Tintes de avatar por orden de `id`**: se ordenan los ids y se asignan 6 tintes en ciclo. Así es estable en todos los dispositivos (RF-28) y no repite tinte hasta la séptima persona. Descartado un hash del id, que puede dar el mismo tinte a dos personas de la misma lista (caso límite de iniciales iguales). Cubre: RF-27, RF-28.
- D12: **Próximo evento calculado en el cliente** sobre los eventos de las próximas 48 h que pasa el servidor, con `router.refresh()` al volver a primer plano si se cargaron hace más de 12 h. Descartado preguntar al servidor cada minuto (red y batería). El margen de 48 h cubre que la página siga abierta. Cubre: RF-45–RF-49.
- D13: **Reloj con `useSyncExternalStore`** (AGENTS §9) a 30 s. Descartado `useEffect` con `setState` (aviso de hidratación y regla de lint). Cubre: RF-39, RF-47.
- D14: **Iconos de la PWA desde un SVG propio**, `public/icons/icon.svg`: fondo tinta `#141414` y monograma "CF" en piedra a peso 800. Los PNG (192, 512, 512 maskable con margen del 20 % y apple-touch 180) se generan una vez con `playwright-cli`, ya instalado y fuera de `package.json`, y se versionan. El favicon es `src/app/icon.svg`. Descartados `ImageResponse` en tiempo de petición (rutas dinámicas para algo estático) y añadir `sharp` (P6). Cubre: RF-51, RF-52.
- D15: **Color de calendario como barra de 4 px con contorno `ink/15`**, que mantiene visibles los pasteles claros sobre `paper`, y el nombre del calendario en el texto accesible de la fila. Descartado el chip relleno con `readableTextColor` de la spec 002, porque RF-4 pide texto siempre en tinta. Cubre: RF-4, RF-35.
- D16: **Guardia de diseño como test unitario** que recorre `src/`. Descartado añadir un plugin de ESLint (P6). Cubre: RF-1, P9.
- D17: **Breakpoint de 1024 px = `lg` de Tailwind**, sin breakpoints propios. Cubre: RF-16–RF-19.
- D18: **`CACHE_NAME` a `cafam-v2`**: el `activate` existente borra las cachés con otro nombre. Descartado un mecanismo de versión nuevo. Cubre: RF-54.
- D19 (cambio del 2026-10-22): **quitar el azul antiguo con una migración nueva `remove_old_blue`** que cambia el valor por defecto de `calendars.color` a `#A0C4FF`, redefine `merge_calendars` e `import_calendar` con ese mismo respaldo (mismo cuerpo, solo cambia el color) y actualiza los calendarios y eventos con `#2563EB` (comparando sin mayúsculas). En el código: `DEFAULT_CALENDAR_COLOR = "#A0C4FF"`, fuera "Azul marca" de la paleta y el acento Azul pasa a `fill #1D4ED8` / `ink #1E40AF` (6,7:1 con blanco encima y 6,9:1 como texto sobre piedra). La guardia de diseño prohíbe `#2563EB` en `src/`. Descartados un `check` en SQL que prohíba el color (la paleta ya se impone con `zod`, plan 002 D13) y dejar los datos como estaban (decisión del usuario). Cubre: RF-55, RF-56, RF-57, RF-58.

## Trazabilidad RF -> módulo

| RF | Módulos |
|----|---------|
| RF-1 | tokens, ui-kit, restyle, design-guard |
| RF-2 | ui-kit, restyle (tests de las specs 001–004 en verde) |
| RF-3 | tokens, accents |
| RF-4 | restyle (chips de mes y semana), agenda-view (D15) |
| RF-5 | mini-month, agenda-view, restyle (hoy en negrita o relleno, no solo color) |
| RF-6 | accents, settings, accent-picker |
| RF-7 | accent-picker |
| RF-8 | settings (`setAccent`), accent-migration |
| RF-9 | app-frame, queries (`getAccent`) |
| RF-10 | accent-migration, accents |
| RF-11 | tokens (`:root` en rojo) |
| RF-12 | accent-picker, settings |
| RF-13 | accent-migration (RLS existente + test de base de datos) |
| RF-14 | accents (test de contraste), tokens |
| RF-15 | routes, agenda-range |
| RF-16 | app-frame, side-rail, nav, icons |
| RF-17 | calendar-page, filters, mini-month, next-event |
| RF-18 | app-frame, bottom-bar, nav, icons |
| RF-19 | calendar-page (panel plegable existente), filters |
| RF-20 | nav (`activeSection`), side-rail, bottom-bar |
| RF-21 | routes (`/dashboard/calendars`) |
| RF-22 | bottom-bar, calendar-page ("+ Evento" a `/dashboard/events/new`) |
| RF-23 | mini-month |
| RF-24 | mini-month (`month-marks`) |
| RF-25 | mini-month |
| RF-26 | mini-month (`loadMonthMarks`) |
| RF-27 | avatars, filters |
| RF-28 | avatars (`assignTints`) |
| RF-29 | filters (acción existente `setPersonVisibility`) |
| RF-30 | agenda-range, calendar-page (selector) |
| RF-31 | agenda-range |
| RF-32 | agenda-layout, agenda-view, tokens (fuente) |
| RF-33 | agenda-layout (fecha completa), agenda-view |
| RF-34 | agenda-layout |
| RF-35 | agenda-view (`event-row`), queries (`location`) |
| RF-36 | agenda-layout |
| RF-37 | agenda-view |
| RF-38 | agenda-view, calendar-page (`canCreate`) |
| RF-39 | agenda-layout, agenda-view, clock |
| RF-40 | agenda-range (`navigate` ±14), view-toolbar |
| RF-41 | view-toolbar |
| RF-42 | agenda-view (enlace al detalle) |
| RF-43 | agenda-layout, calendar-page (filtros y zona del perfil) |
| RF-44 | agenda-range (`parseViewParams`) |
| RF-45 | next-event (`pickNextEvent`), calendar-page (eventos de 48 h) |
| RF-46 | next-event (`formatCountdown`) |
| RF-47 | next-event, clock |
| RF-48 | next-event, clock |
| RF-49 | next-event |
| RF-50 | next-event |
| RF-51 | brand, side-rail, restyle (portada y acceso) |
| RF-52 | brand, pwa |
| RF-53 | pwa (`theme_color`, `viewport`) |
| RF-54 | pwa (`CACHE_NAME`) |
| RF-55 | palette, design-guard (D19) |
| RF-56 | migración `remove_old_blue`, palette (D19) |
| RF-57 | migración `remove_old_blue` (D19) |
| RF-58 | accents, tokens (D19) |

## Riesgos y mitigaciones

- **R1 — Tests existentes que dependen del marcado.** Las pruebas de las specs 001–004 buscan por rol y texto, no por clase, pero algunas pueden comprobar "Volver al panel", "Nuevo evento" o la vista por defecto "mes". Mitigación: cada tarea de reestilo ejecuta `npm test` completo. Solo se cambia un test si el cambio viene de un RF de esta spec, y se cita el RF.
- **R2 — Leer el perfil en el layout ralentiza todas las páginas.** Es una consulta más por navegación. Mitigación: una sola columna por clave primaria, en paralelo con el contenido gracias a `<Suspense>`. Se mide con los logs de Vercel en la demo.
- **R3 — Activity de `cacheComponents` duplica marcos y formularios en el DOM.** Mitigación: ids con `useId()` (ya es la norma) y, en Playwright, `.locator('visible=true')` (AGENTS §10).
- **R4 — El número gigante a 360 px.** Mitigación: tamaño con `clamp()` (mínimo 64 px) y columna de eventos debajo del número en móvil y a su lado desde `sm`. Capturas a 360 y 390.
- **R5 — iOS no cambia el icono de la pantalla de inicio hasta volver a añadir la app,** y Android lo actualiza en su próxima comprobación del manifest. Esto lo decide el sistema operativo, no la app. RF-54 se cumple para los recursos que guarda el service worker. Mitigación: se dice en la demo y en `AGENTS.md`.
- **R6 — El amarillo como relleno no se distingue del fondo** (1,30:1). Mitigación: el borde en `accent-ink` del modelo de datos y la negrita de RF-5, con un test que lo exige para cualquier acento cuyo relleno quede por debajo de 3:1.
- **R7 — Inter Tight sin cifras tabulares reales.** Mitigación: la tarea de tokens lo comprueba en el navegador. Si falla, se para y se pide aprobación para la alternativa; no se cambia en silencio.
- **R8 — Pasteles de la spec 002 casi invisibles como barra.** Mitigación: el contorno `ink/15` de D15 y el nombre del calendario en el texto accesible.
- **R9 — Rendimiento de la agenda** (RNF: 500 eventos en menos de 3 s). Mitigación: misma consulta acotada que la spec 002. Se amplía `range-performance.test.ts` con la vista agenda.

## Dudas abiertas

- Ninguna bloqueante. Al aprobar el plan apruebas también tres propuestas que la spec dejó para aquí:
  1. la tipografía Inter Tight (D1);
  2. los valores de los seis acentos (tabla del modelo de datos);
  3. el icono: fondo tinta con "CF" en piedra (D14). En la tarea del icono se te enseñará una captura antes de generar los PNG.
