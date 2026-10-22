# Tasks 005 - Identidad visual

> Estado: **Aprobadas** por el usuario (2026-10-22).
> Spec: `specs/005-identidad-visual/spec.md`. Plan: `specs/005-identidad-visual/plan.md`.
> Reglas: una tarea cada vez, test primero (rojo → verde), y al cerrar cada tarea se ejecuta y reporta el checklist de "Verificación obligatoria" de la constitución (P7, P8, P9): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` si toca esquema, RLS o acceso a datos, y, si toca interfaz, capturas a 390, 768 y 1440 px revisadas contra "Identidad visual y diseño de interfaz". Un commit por tarea citándola, en la rama `005-identidad-visual`.
> Sin dependencias nuevas: ninguna tarea toca `package.json`. Las páginas siguen los patrones de AGENTS §9 (`page.tsx` síncrono, lecturas en `<Suspense>`, `revalidatePath("/dashboard", "layout")` tras escribir, `useId()`, `useSyncExternalStore` para valores del navegador). Las capturas y demos se hacen con `playwright-cli` contra `npx next start -p 3100` y `dev`, y los usuarios de prueba se borran al terminar. Los tests de las specs 001 a 004 solo se tocan cuando un RF de esta spec cambia lo que comprueban, y se cita ese RF en el test.

## Tareas

- [x] T1 Crear la migración del acento en `profiles` con su test de base de datos
  Pasos: test primero en `tests/integration/profile-accent.test.ts` con dos usuarios y `anon`. Comprueba que:
  - un usuario nuevo tiene `accent = 'red'`;
  - puede cambiar el suyo a cada uno de los seis valores;
  - un valor fuera de la lista falla con `23514`;
  - no puede leer ni cambiar el de otro usuario (0 filas);
  - `anon` no ve nada;
  - `visible_people()` y `calendar_members_with_names` siguen sin devolver la columna.

  Migración `supabase/migrations/<timestamp>_profile_accent.sql`. Antes, comprobar que el link apunta a `dev`. Después, `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- profile-accent schema rls` en verde y `src/types/database.ts` contiene `accent`. Cubre: RF-8, RF-10, RF-13 | Módulo: accent-migration

- [x] T2 Definir los acentos, los tokens, la tipografía y el reestilo de `components/ui`
  Pasos:
  - Tests primero en `tests/unit/accents.test.ts`:
    - hay exactamente seis acentos con nombre en español y el rojo por defecto;
    - `isAccent` y `accentSchema` rechazan cualquier otro valor;
    - para cada acento, `onFill` sobre `fill` da ≥ 4,5:1 y `ink` sobre `stone` y `paper` da ≥ 4,5:1;
    - todo acento cuyo `fill` quede por debajo de 3:1 contra la superficie está marcado para llevar borde;
    - los valores de `globals.css` coinciden con los de `accents.ts` (se lee el CSS).
  - Actualizar los tests de `button`, `text-field` y `form-alert` para que comprueben roles y estados, no colores.
  - Módulos:
    - `src/lib/theme/accents.ts`.
    - `globals.css` con `@theme` (`stone`, `paper`, `ink`, `muted`, `line`) y `@theme inline` (`accent`, `on-accent`, `accent-ink`). El rojo va en `:root`, hay un bloque por cada `[data-accent=…]` y `body` tiene fondo `stone`. Se mantienen `brand` y `brand-soft` hasta T11.
    - Inter Tight con `next/font` en `layout.tsx`, en lugar de Geist y Geist Mono.
    - Reestilo de `Button`, `LinkButton`, `TextField`, `TextArea`, `Select`, `FormAlert` y `ConfirmDialog` con los tokens nuevos (plan, módulo ui-kit).
  - Comprobar en el navegador que `tabular-nums` cambia el ancho de los dígitos de Inter Tight. Si no lo cambia, parar y pedir aprobación (plan R7).
  Hecho cuando: `npm test -- accents button text-field form-alert confirm-dialog` en verde. Cubre: RF-3, RF-11, RF-14 | Módulo: accents, tokens, ui-kit

- [ ] T3 Añadir la vista agenda a los rangos y su lógica de días como funciones puras
  Pasos:
  - Tests primero en `tests/unit/ranges.test.ts` (ampliado):
    - `agenda` da 14 días desde `date`;
    - `navigate` suma o resta 14 días;
    - `parseViewParams` sin vista o con vista o fecha no válidas devuelve `agenda` y hoy;
    - `calendarHref("agenda", …)` funciona.
  - Tests primero en `tests/unit/agenda.test.ts`:
    - en cada día van primero los de día completo y luego por hora;
    - un evento de varios días aparece en cada día del rango;
    - un evento que cruza la medianoche lleva "Desde ayer" el segundo día y "Hasta el {día} a las {hora}" el primero;
    - los días vacíos están presentes;
    - la línea de la hora actual queda entre los empezados y los siguientes, y solo en hoy;
    - cada día trae su fecha completa accesible ("miércoles, 3 de mayo de 2026");
    - el cambio de hora dentro de los 14 días mantiene las horas en la zona del perfil.
  - Módulos: `src/lib/calendar/ranges.ts` y `src/lib/calendar/agenda.ts`. Actualizar `view-toolbar.test.tsx` y `parseViewParams` porque la vista por defecto pasa de mes a agenda (RF-15, RF-44).
  Hecho cuando: `npm test -- ranges agenda view-toolbar` en verde. Cubre: RF-15, RF-31, RF-33, RF-34, RF-36, RF-39, RF-40, RF-43, RF-44 | Módulo: agenda-range, agenda-layout

- [ ] T4 Implementar como funciones puras el próximo evento, los avatares, las marcas del mes, la navegación y el reloj
  Pasos: tests primero.
  - `tests/unit/next-event.test.ts`:
    - elige el primer evento con hora no empezado que empiece en menos de 24 h, solo de calendarios visibles;
    - ignora los de día completo y los que están en curso;
    - devuelve `null` si no hay ninguno;
    - `formatCountdown` da "en menos de 1 min", "en 25 min" y "en 3 h 10 min".
  - `tests/unit/avatar.test.ts`:
    - `initials` de "Ana López" da "AL"; de un nombre de una palabra, de un nombre que empieza por número o símbolo y de espacios sobrantes, sin fallar;
    - `assignTints` es estable para el mismo conjunto en cualquier orden y no repite tinte hasta la séptima persona;
    - los seis tintes están separados ≥ 60° de tono y la tinta sobre cada tinte da ≥ 4,5:1.
  - `tests/unit/month-marks.test.ts`: hasta 3 calendarios distintos por día, solo de calendarios visibles, y eventos de varios días o de día completo marcados en cada día.
  - `tests/unit/nav.test.ts`: `activeSection` de `/dashboard/calendar`, `/dashboard/events/…`, `/dashboard/calendars/…`, `/dashboard/join`, `/dashboard/import` y `/dashboard/settings`.
  - `tests/unit/use-now.test.tsx`: se actualiza con temporizadores simulados y al volver de `visibilitychange`.

  Módulos: `src/lib/calendar/next-event.ts`, `src/lib/people/avatar.ts`, `src/lib/calendar/month-marks.ts`, `src/lib/shell/nav.ts` y `src/lib/hooks/use-now.ts`.
  Hecho cuando: `npm test -- next-event avatar month-marks nav use-now` en verde. Cubre: RF-20, RF-24, RF-27, RF-28, RF-45, RF-46, RF-47, RF-48, RF-49 | Módulo: next-event, avatars, mini-month, nav, clock

- [ ] T5 Crear el marco de `/dashboard` con el acento del usuario y mover las rutas
  Pasos:
  - Tests primero:
    - `tests/unit/app-frame.test.tsx`: el contenedor lleva el `data-accent` recibido y el esqueleto de carga no usa acento.
    - `tests/unit/route-access.test.ts` y `auth-next-actions.test.ts`: con sesión, `/login` y `signIn` llevan a `/dashboard/calendar` y `next=/invite/…` se sigue respetando.
    - `tests/unit/calendar-list.test.tsx` adaptado a "Mis calendarios".
  - Módulos:
    - `getAccent` en `queries.ts`;
    - `src/app/dashboard/layout.tsx` con `AppFrame` en `<Suspense>`;
    - `/dashboard/page.tsx` redirige a `/dashboard/calendar`;
    - nueva `/dashboard/calendars/page.tsx` con el contenido del panel, sin saludo ni "Cerrar sesión";
    - `PageShell` con el enlace de vuelta a "Mis calendarios".
  - Comprobar con `playwright-cli` que un usuario con `accent = 'blue'` en `dev` recibe `data-accent="blue"` en el HTML inicial, sin ejecutar JavaScript.
  Hecho cuando: `npm test -- app-frame route-access auth-next-actions calendar-list` en verde. Cubre: RF-9, RF-15, RF-21 | Módulo: app-frame, routes, queries

- [ ] T6 Implementar la barra lateral, la barra inferior, la hoja "Más" y los iconos
  Pasos:
  - Tests primero en `tests/unit/side-rail.test.tsx`: la marca y los seis destinos, cada uno con nombre accesible; la sección activa con `aria-current="page"`; "Cerrar sesión" envía el formulario de `signOut`.
  - Tests primero en `tests/unit/bottom-bar.test.tsx`:
    - Calendario, Mis calendarios, "+ Evento" (enlace a `/dashboard/events/new`) y "Más";
    - "Más" abre un `<dialog>` con Unirme, Importar, Ajustes y Cerrar sesión, se cierra con Escape y devuelve el foco;
    - la sección activa está marcada.

    `showModal` se simula como en `confirm-dialog.test.tsx`.
  - Módulos: `src/components/shell/side-rail.tsx`, `bottom-bar.tsx`, `more-sheet.tsx` e `icons.tsx`, montados en `AppFrame`. La barra lateral solo desde `lg` y la inferior por debajo. Objetivos de 44 px y tooltips visibles al enfocar.
  Hecho cuando: `npm test -- side-rail bottom-bar` en verde. Cubre: RF-16, RF-18, RF-20, RF-22 | Módulo: side-rail, bottom-bar, icons, nav

- [ ] T7 Implementar Ajustes con la elección del acento
  Pasos:
  - Tests primero en `tests/unit/settings-actions.test.ts` (`setAccent`):
    - valida con `accentSchema` y da "Elige uno de los colores disponibles." con un valor no válido;
    - actualiza solo la fila propia;
    - 0 filas o error da "No se ha podido guardar el color. Inténtalo de nuevo.";
    - un fallo de red da el mensaje de conexión;
    - si va bien, llama a `revalidatePath("/dashboard", "layout")`.
  - Tests primero en `tests/unit/accent-picker.test.tsx`:
    - seis radios con nombre y el actual marcado;
    - elegir cambia `data-accent` del contenedor antes de que responda la acción;
    - si la acción devuelve error, vuelve al anterior y muestra el mensaje con `role="alert"`;
    - se usa con teclado (flechas).
  - Módulos: `src/app/dashboard/settings/page.tsx` y `actions.ts`, y `src/components/settings/accent-picker.tsx`.
  Hecho cuando: `npm test -- settings-actions accent-picker` en verde. Cubre: RF-6, RF-7, RF-8, RF-12 | Módulo: settings, accent-picker

- [ ] T8 Pintar la vista agenda y conectarla a la pantalla de calendario
  Pasos:
  - Tests primero en `tests/unit/agenda-view.test.tsx`:
    - 14 días con el número del día y la abreviatura, y el nombre accesible con la fecha completa;
    - cada evento con hora de inicio, hora de fin, barra de color, título, lugar y enlace a su detalle;
    - "Todo el día" en los de día completo y "Sin eventos" en los días vacíos;
    - "Crear evento este día" solo con `canCreate`, enlazando a `/dashboard/events/new?date=…`;
    - la línea de la hora actual solo en hoy;
    - hoy marcado también sin color (negrita o relleno);
    - un título largo se corta sin ocultar la hora.
  - Actualizar `view-toolbar.test.tsx` con el botón "Agenda" y "14 días anteriores/siguientes".
  - Módulos:
    - `agenda-view.tsx`, `agenda-day.tsx` y `event-row.tsx` (barra de 4 px con contorno `ink/15`, D15);
    - `getEventsInRange` con `location`;
    - `calendar/page.tsx` y `calendar-workspace.tsx` con la vista agenda y `canCreate`;
    - `range-performance.test.ts` ampliado con la agenda.
  Hecho cuando: `npm test -- agenda-view view-toolbar` en verde. Cubre: RF-4, RF-5, RF-30, RF-32, RF-35, RF-37, RF-38, RF-41, RF-42 | Módulo: agenda-view, calendar-page, queries

- [ ] T9 Montar el panel con el mini calendario, el próximo evento y los filtros con avatares
  Pasos:
  - Tests primero en `tests/unit/mini-month.test.tsx`:
    - semanas que empiezan en lunes, hoy con relleno de acento y negrita;
    - puntos solo de calendarios visibles;
    - pulsar un día enlaza a `calendarHref(view, día)`;
    - cambiar de mes llama a `loadMonthMarks` y no cambia la vista principal;
    - si `loadMonthMarks` falla, el mes se queda donde estaba.
  - Tests primero en `tests/unit/next-event-card.test.tsx`:
    - título, hora, calendario y cuenta atrás;
    - pasa al siguiente cuando el actual empieza (temporizadores simulados);
    - "Nada en las próximas 24 horas" si no hay ninguno;
    - enlaza al detalle;
    - respeta los calendarios ocultos.
  - Ampliar `calendar-filters.test.tsx`: cada persona es un avatar con iniciales y nombre, con `aria-pressed`, y conmutarla llama a `setPersonVisibility`.
  - Acción `loadMonthMarks` con su test en `tests/unit/mini-month-actions.test.ts`: mes no válido da error y lee con la sesión.
  - En `calendar/page.tsx`: eventos de las próximas 48 h y `router.refresh()` al volver a primer plano si se cargaron hace más de 12 h.
  - Panel siempre visible desde `lg` y plegable por debajo.
  Hecho cuando: `npm test -- mini-month next-event-card calendar-filters mini-month-actions` en verde. Cubre: RF-17, RF-19, RF-23, RF-24, RF-25, RF-26, RF-27, RF-29, RF-45, RF-46, RF-47, RF-48, RF-49, RF-50 | Módulo: mini-month, next-event, filters, avatars, calendar-page

- [ ] T10 Crear la marca y los iconos nuevos y actualizar la PWA
  Pasos:
  - Dibujar `public/icons/icon.svg`: fondo tinta `#141414` y "CF" en piedra a peso 800.
  - Enseñar una captura al usuario y esperar su visto bueno antes de seguir (plan D14).
  - Generar con `playwright-cli` los PNG 192, 512, 512 maskable (margen del 20 %) y apple-touch 180, y crear `src/app/icon.svg`. Componente `src/components/brand/logo.tsx`.
  - Tests primero:
    - `manifest.test.ts`: `theme_color` y `background_color` `#E8E5DD`, `start_url` `/dashboard/calendar` y los mismos iconos;
    - `layout.test.ts`: `themeColor` `#E8E5DD`;
    - `sw-no-data.test.ts`: `CACHE_NAME` es `calenderfam-v2` y el `activate` borra las cachés con otro nombre.
  Hecho cuando: `npm test -- manifest layout sw-no-data` en verde y los cuatro PNG existen con sus tamaños (comprobado con `file public/icons/*.png`). Cubre: RF-51, RF-52, RF-53, RF-54 | Módulo: brand, pwa

- [ ] T11 Aplicar la identidad a todas las pantallas y activar la guardia de diseño
  Pasos:
  - Test primero en `tests/unit/design-tokens.test.ts`: falla si `src/` contiene clases `brand`/`brand-soft`, colores `[#…]` en clases, `font-mono`, `bg-gradient`, `backdrop-blur`, `shadow-` fuera de la lista blanca (`dialog` y menús) o emojis en textos.
  - Reestilar:
    - portada, login y registro (con la marca), invitación y sin conexión;
    - Mis calendarios, alta y edición de calendario, categorías y juntar;
    - alta y detalle de evento;
    - compartir, miembros, unirme e importar;
    - vistas de mes, semana y día: chips en tinta con barra de color (RF-4) y hoy con relleno o negrita (RF-5).
  - Quitar `brand` y `brand-soft` de `globals.css` al final.
  - Sin cambiar lógica, textos funcionales ni validaciones: los tests de las specs 001 a 004 siguen en verde.
  - Capturas a 390, 768 y 1440 px de cada pantalla con el acento rojo y el amarillo, revisadas contra la sección de la constitución.
  Hecho cuando: `npm test` completo en verde, incluido `design-tokens`. Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-11 | Módulo: restyle, design-guard, tokens

- [ ] T12 Validar la spec RF por RF, en producción, y cerrar la documentación
  Pasos:
  - Añadir a `tasks.md` la tabla "Trazabilidad RF → tarea → test" y la comprobación de "Fuera de alcance": sin tema oscuro, sin notificaciones, sin fotos y sin recordar la última vista.
  - Contraste de los seis acentos comprobado en capturas.
  - Actualizar `AGENTS.md`: estado de la 005; secciones 2, 5, 6 ("Identidad visual" pasa a ser la actual), 9 y 10 (riesgo R5 del icono en iOS); y §12 apuntando a la 006.
  - Preparar al usuario los comandos para aplicar la migración en prod y para el `merge --ff-only` y el `push`.
  - Demo en producción en móvil y escritorio, según los criterios de finalización de la spec.
  - Pedir al usuario la aprobación del cierre.
  Hecho cuando: el checklist de verificación completo pasa (incluido `npm run test:db`), la demo en producción cubre cada punto de los criterios de finalización y el usuario aprueba el cierre. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T11 |
| RF-2 | T11 (y los tests de 001–004 en verde en cada tarea) |
| RF-3 | T2, T11 |
| RF-4 | T8, T11 |
| RF-5 | T8, T9, T11 |
| RF-6 | T7 |
| RF-7 | T7 |
| RF-8 | T1, T7 |
| RF-9 | T5 |
| RF-10 | T1 |
| RF-11 | T2, T11 |
| RF-12 | T7 |
| RF-13 | T1 |
| RF-14 | T2 |
| RF-15 | T3, T5 |
| RF-16 | T6 |
| RF-17 | T9 |
| RF-18 | T6 |
| RF-19 | T9 |
| RF-20 | T4, T6 |
| RF-21 | T5 |
| RF-22 | T6 |
| RF-23 | T9 |
| RF-24 | T4, T9 |
| RF-25 | T9 |
| RF-26 | T9 |
| RF-27 | T4, T9 |
| RF-28 | T4 |
| RF-29 | T9 |
| RF-30 | T8 |
| RF-31 | T3 |
| RF-32 | T8 |
| RF-33 | T3 |
| RF-34 | T3 |
| RF-35 | T8 |
| RF-36 | T3 |
| RF-37 | T8 |
| RF-38 | T8 |
| RF-39 | T3 |
| RF-40 | T3 |
| RF-41 | T8 |
| RF-42 | T8 |
| RF-43 | T3 |
| RF-44 | T3 |
| RF-45 | T4, T9 |
| RF-46 | T4, T9 |
| RF-47 | T4, T9 |
| RF-48 | T4, T9 |
| RF-49 | T4, T9 |
| RF-50 | T9 |
| RF-51 | T10 |
| RF-52 | T10 |
| RF-53 | T10 |
| RF-54 | T10 |

Todos los módulos del plan tienen tarea:

| Módulo | Tareas |
|--------|--------|
| accent-migration | T1 |
| accents, tokens, ui-kit | T2 |
| agenda-range, agenda-layout | T3 |
| next-event, avatars, nav, clock | T4 |
| app-frame, routes, queries | T5 |
| side-rail, bottom-bar, icons | T6 |
| settings, accent-picker | T7 |
| agenda-view, calendar-page | T8 |
| mini-month, filters | T9 |
| brand, pwa | T10 |
| restyle, design-guard | T11 |

## Dudas abiertas

- Ninguna bloqueante. T10 se para para que el usuario dé el visto bueno al icono antes de generar los PNG, y T2 se para si Inter Tight no tiene cifras tabulares (plan R7).
