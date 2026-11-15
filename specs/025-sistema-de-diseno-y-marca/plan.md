# Plan 025 — Sistema de diseño y marca "Orilla"

Spec: `specs/025-sistema-de-diseno-y-marca/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-15).

## Resumen de arquitectura

La app ya pinta con tokens semánticos (`stone`, `paper`, `ink`, `muted`, `line`, `control`, `accent`…). El rediseño entra por tres capas, de abajo arriba:

1. **Valores** (`lib/theme/accents.ts` ↔ `globals.css`): cambian los colores, las elevaciones, la tipografía y los radios. Toda pantalla cambia de aspecto sin tocarla.
2. **Componentes base** (`components/ui`) y **marco** (`components/shell`): se reescriben.
3. **Pantallas**: specs 026 a 029.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `docs/constitution.md` | Enmienda 10: sección de identidad nueva |
| `src/lib/theme/accents.ts`, `globals.css` | Valores Orilla en claro y oscuro; seis acentos renombrados; `surface`/`surface-float`; radios `--radius-card` y `--radius-control`; sin cristal ni fondo en degradado |
| `tests/unit/design-tokens.test.ts`, `accents.test.ts`, `theme-css.test.ts` | Guardias reescritas para la identidad nueva |
| `src/app/layout.tsx` | Figtree |
| `src/components/ui/*` | Botones, campos y piezas nuevas (`IconButton`, `Card`, `Chip`, `Sheet`, `EmptyState`) |
| `src/components/brand/logo.tsx`, `public/icons/*`, `scripts/make-icons.mjs`, `manifest.ts`, `public/sw.js` | Marca e iconos |
| `src/components/shell/*`, `src/lib/shell/nav.ts` | Barra inferior con "+", barra lateral con nombres, cabecera fina, hoja "Más"; se retiran el cajón y el botón flotante "+" |
| `src/app/dashboard/notes/page.tsx` | Pantalla provisional hasta la 028 |

## Decisiones

- **D1 Se conservan los nombres de los tokens** (`stone`, `paper`, `ink`…). Son nombres de papel (fondo, superficie, tinta) que siguen describiendo su función; renombrarlos tocaría más de 300 archivos sin cambiar nada visible. Lo que cambia es su valor y la enmienda que los define. Alternativa descartada: `canvas`/`surface`/`text`.
- **D2 Superficies blancas sobre bruma, no dos tonos de arena.** Más contraste entre fondo y tarjeta con menos sombra, mejor lectura al sol (móvil) y distinto de lo anterior a primera vista.
- **D3 El acento es también la acción principal.** Antes el primario era tinta negra y el acento solo marcaba "hoy". Un único color vivo que sirve para "aquí se actúa" y "aquí estás" es más fácil de leer en una pantalla pequeña. El amarillo (Sol) lleva tinta encima, como ya hacía.
- **D4 Sin `backdrop-filter`.** Spec 024 H3: no medible aquí, y es la causa clásica de tirones en iOS con muchas capas. Las superficies opacas con línea fina dan la misma jerarquía. La utilidad se renombra (`surface`) para que el código no mienta.
- **D5 Figtree.** Amable y geométrica, con cifras tabulares (comprobado en el archivo de la fuente: tiene `tnum`). Descartadas: Nunito y DM Sans (sin `tnum`), Manrope (más fría), dos familias (más peso).
- **D6 Radio de control de 16 px en lugar de píldora.** Los botones anchos del móvil se leen mejor como bloques; la píldora queda para chips y selección, y así un chip no se confunde con un botón.
- **D7 Barra inferior con "+" en el centro; sin cajón.** El cajón obligaba a subir el pulgar a la esquina superior izquierda para todo. Cinco destinos caben abajo. El "+" central libera la esquina inferior derecha para Venito. Alternativas descartadas: (a) dos botones flotantes apilados (tapaban la última fila de eventos y competían), (b) "+" en la cabecera (lejos del pulgar).
- **D8 Los identificadores de los acentos no cambian** (`red`…`gray`): `profiles.accent` tiene un `check` con ellos. Cambian los nombres visibles y los valores.
- **D9 Iconos de la PWA con Playwright** (`scripts/make-icons.mjs` pinta el SVG maestro en Chromium y lo guarda en PNG). No añade dependencias: Playwright ya está en el entorno de desarrollo y el script no forma parte de la app.
- **D10 `Sheet` es un `<dialog>`** con el patrón ya probado de la app (foco, Escape, fondo inerte, devolver el foco), que entra desde abajo y se cierra deslizando; reutiliza `sheet.ts` y `useFollowDrag`.

## Riesgos

- R1 Cientos de clases repartidas por las pantallas asumen píldoras y cristal: se sustituyen con un script revisado y la guardia nueva caza lo que quede.
- R2 Tests que fijan valores o nombres ("Rojo", hex): se actualizan con la identidad.
- R3 El icono de una PWA ya instalada en iOS no cambia hasta volver a añadirla: se anota en los pasos del usuario.

## Verificación

P8; capturas de CA-2; `measure.mjs`.
