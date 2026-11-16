# Plan 030 — Estilo y usabilidad "Nexo" y Venito secretario

Spec: `specs/030-estilo-nexo/spec.md`. Aprobado dentro del encargo (2026-11-16).

## Módulos

| Módulo | Cambio |
|--------|--------|
| `docs/constitution.md` | Enmienda 11 |
| `lib/theme/accents.ts`, `globals.css` | Valores Nexo, `accent-to`, `accent-soft`, `bg-accent-gradient`, sombras teñidas, radios, Inter |
| `tests/unit/accents.test.ts`, `theme-css.test.ts`, `design-tokens.test.ts` | Contraste también del extremo del degradado; etiquetas en mayúsculas permitidas; degradado solo como token |
| `components/ui/*` | Botones, campos, chips, tarjetas, aviso |
| `components/shell/*` | `TopNav` (escritorio), `BottomBar` como píldora flotante, `FloatingActions` ("+" y Venito), `TopBar` con marca; se retira `SideRail` |
| `components/calendar/calendar-dock.tsx` → `calendar-heading.tsx` | Cabecera del calendario dentro del contenido; se retira la barra fija |
| `components/calendar/next-event-card.tsx` | Tarjeta de saludo con degradado |
| `components/notes/checklist.tsx` | Casillas redondas y tachado animado |
| `components/brand/venito.tsx` | Gafas, cuello y corbata; gesto serio |

## Decisiones

- **D1 Se sustituye Orilla entera en lugar de mezclar.** El usuario pide "cambiar totalmente"; dos lenguajes a la vez serían peores que cualquiera de los dos.
- **D2 Los nombres de los tokens se conservan** (`stone`, `paper`, `ink`…), como en la 025: solo cambian sus valores, y se añaden `accent-to` y `accent-soft`.
- **D3 "+" vuelve a ser un botón flotante**, con Venito encima, como en el prototipo. Revierte la D7 de la 025 ("+" central en la barra) por decisión expresa del usuario. Los dos flotan sobre la píldora de navegación, alineados a la derecha, y el contenido reserva sitio abajo.
- **D4 Navegación de escritorio arriba, sin barra lateral**, desde 769 px (el prototipo cambia a 768). Con cuatro destinos más "Más" cabe en una píldora centrada.
- **D5 La barra del calendario de la 026 se retira.** En el prototipo los controles del periodo están en la cabecera de la vista; se sigue ese patrón aunque queden más lejos del pulgar, porque el usuario pide esa usabilidad. Deslizar (024) sigue siendo la forma principal de cambiar de periodo con una mano.
- **D6 El identificador `red` pasa a ser Violeta.** Es el valor por defecto de `profiles.accent`; así todo el mundo ve el violeta del prototipo sin migración. `purple` pasa a ser Rosa (el segundo color del prototipo).
- **D7 El degradado es un token más** (`--accent-to`), nunca una clase suelta: la guardia sigue prohibiendo `bg-linear-*` fuera de `globals.css`.
- **D8 Venito cambia de gesto, no de dibujo base.** Mismas proporciones y expresiones; se añaden gafas, cuello y corbata y se quitan los rasgos tiernos (mofletes, brillo grande).
- **D9 Pesos**: `font-extrabold` → `font-bold` y `font-bold` → `font-semibold` en toda la app con un script, como el prototipo (500–600).

## Riesgos

- R1 Segundo cambio de marco en pocos días: muchos tests del shell se reescriben otra vez.
- R2 No se pudo ver el prototipo pintado: puede haber matices de espaciado que no coincidan. Se declara.

## Verificación

P8; capturas; `e2e-phone.mjs`; `measure.mjs`.
