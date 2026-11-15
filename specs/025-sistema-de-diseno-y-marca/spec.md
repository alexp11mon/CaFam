# Spec 025 — Sistema de diseño y marca "Orilla"

> Estado: **En curso** (2026-11-15). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15): spec, plan, tareas, implementación y cierre. Segunda spec del encargo de rediseño (tras la 024). Límites: sin dependencias nuevas, sin migraciones, nada sobre producción.

## Contexto y objetivo

El usuario ha decidido cambiar **todo el frontend**: aspecto, organización, logo, iconos, tipografía, color, formas y movimiento, con el móvil (iPhone) primero y una mascota, Venito, como parte de la marca. La identidad actual (piedra y papel, tinta negra, Inter Tight, píldoras, cristal) la fija la constitución (P9), así que el cambio empieza por una **enmienda** y por las guardias que la hacen cumplir.

Esta spec deja la base sobre la que se rehacen las pantallas: identidad escrita, tokens, guardias, tipografía, componentes base, logo e iconos de la PWA y el **marco de navegación**. Las pantallas se rediseñan en las specs 026 (calendario), 027 (Venito y asistente), 028 (Notas) y 029 (resto).

## Dirección visual: "Orilla"

**Moodboard en texto.** Una mañana clara en la orilla del Cantábrico: bruma pálida sobre el agua, arena mojada, el azul profundo del mar al fondo y una boya de color coral. Venito, una foca pequeña, asoma la cabeza. Limpio y luminoso, con un único toque de color vivo; amable sin ser infantil; herramienta de uso diario, no una página de marketing.

| Aspecto | Decisión |
|---------|----------|
| Fondo y superficies | Fondo **bruma** (`stone`, gris azulado muy claro) y superficies **blancas** (`paper`) que se separan por tono y por una línea fina; en oscuro, **mar de noche** y superficies azul pizarra |
| Tinta | **Azul mar profundo** (`ink`), no negro: texto, iconos y botones secundarios |
| Acento | El usuario sigue eligiendo entre seis, con nombre nuevo: **Coral** (por defecto), **Mar**, **Alga**, **Sol**, **Lavanda** y **Roca**. El acento marca hoy, ahora, la selección **y la acción principal de cada pantalla** (botón primario y "+") |
| Calendarios | La paleta pastel de la spec 002 no cambia (son datos del usuario) |
| Tipografía | **Figtree** (400–800, con cifras tabulares), una sola familia. Títulos en 700–800 con interlineado ajustado; cuerpo de 16 px; nunca menos de 16 px en un campo (iOS amplía la página si no) |
| Forma | Tres radios: **tarjeta** 24 px, **control** 16 px (botones, campos, filas pulsables) y **círculo** (avatares, "+", Venito, píldoras de selección y chips). Los botones dejan de ser píldoras |
| Elevación | Dos niveles: **reposo** (línea fina y sombra mínima) y **flotante** (sombra amplia y suave). **Sin desenfoque de fondo** en ninguna superficie: no se pudo medir en iOS y es el sospechoso habitual de los tirones (spec 024, H3) |
| Densidad | Objetivos táctiles de 48 px (mínimo 44), 16 px de margen lateral en el móvil, aire entre bloques mayor que dentro de ellos |
| Iconos | SVG propios de trazo de 1,75 px con extremos redondos, en rejilla de 24 px; rellenos solo para el estado activo de la navegación |
| Movimiento | Los tokens de la spec 021 se conservan (curvas y duraciones); se añade el principio "lo que el dedo arrastra no espera": nada que responda a un gesto usa una transición con captura previa |
| Mascota | Venito aparece en el botón del asistente, estados vacíos, errores y la pantalla sin conexión (spec 027) |

## Marco de navegación (móvil primero)

| Anchura | Marco |
|---------|-------|
| Hasta 768 px | **Barra inferior fija** con cinco huecos, en la zona del pulgar y con la safe area de iOS: Calendario · Notas · **"+"** (centro, en acento) · Calendarios · Más. Arriba, una cabecera fina con el título de la pantalla (en el calendario, el mes) y las acciones de esa pantalla. Desaparece el cajón lateral (≡): sus destinos van a la barra y a "Más", y los filtros del calendario pasan a una hoja inferior (spec 026) |
| 769–1023 px | La misma barra inferior, centrada |
| Desde 1024 px | **Barra lateral** con el logo, los destinos con su nombre y, abajo, el tema y la cuenta |

- **"+"** crea lo propio de la pantalla: un evento en el calendario y en las demás pantallas; una nota en Notas (spec 028). Sustituye al botón flotante "+" que ocupaba la esquina inferior derecha.
- **El asistente** (Venito) se queda solo en la esquina inferior derecha, por encima de la barra (spec 027). Así se resuelve el conflicto entre el "+" y el asistente: el "+" baja a la barra, que es donde el pulgar lo espera, y la esquina es de Venito.
- **"Más"** abre una hoja inferior con el resto: Conexiones, Unirme con código, Importar, Ajustes, tema y cerrar sesión.
- Notas aparece en la navegación desde esta spec; hasta la 028 su pantalla dice que está en camino.

## Requisitos funcionales

- RF-1 La constitución recibe la **enmienda 10**, que sustituye la sección "Identidad visual y diseño de interfaz" por la identidad Orilla y deja escrito qué se conserva (interacción del calendario, accesibilidad, temas, acentos elegibles).
- RF-2 Los valores de los tokens (neutros en claro y oscuro, seis acentos, elevaciones, radios, tipografía) viven en `src/lib/theme` y `globals.css`, con un test que los mantiene iguales y otro que comprueba el contraste (4,5:1 para texto y 3:1 para bordes de controles) en los dos temas y con los seis acentos.
- RF-3 No queda ningún `backdrop-filter` en la app. Las utilidades `glass` y `glass-float` se sustituyen por `surface` y `surface-float` (opacas).
- RF-4 La guardia de diseño se reescribe para la identidad nueva: sigue prohibiendo colores sueltos, hex en clases, paleta de Tailwind, `text-white`, `text-black`, `dark:`, degradados y sombras que no sean tokens, duraciones y curvas fuera de los tokens y emojis; y además prohíbe `backdrop-blur`/`backdrop-filter`, las utilidades de cristal y los radios sueltos (`rounded-[…]`).
- RF-5 La tipografía es Figtree, cargada con `next/font`, con `tabular-nums` donde ya se usaba.
- RF-6 Componentes base en `src/components/ui`: `Button` y `LinkButton` (primario en acento, secundario, discreto y de peligro; 48 px de alto, radio de control), `IconButton`, `TextField`, `TextArea`, `Select`, `Switch`, `FormAlert`, `Card`, `Chip`, `Sheet` (hoja inferior accesible) y `EmptyState`. Todo campo de texto mide 16 px o más.
- RF-7 Logo nuevo (marca y nombre), favicon e iconos de la PWA (192, 512, maskable y apple-touch-icon) generados desde un SVG maestro con un script; manifest con los colores nuevos; `CACHE_NAME` del service worker sube.
- RF-8 Marco de navegación de la tabla anterior, con `aria-current`, foco visible, "Saltar al contenido", safe areas (`env(safe-area-inset-*)`) y sin tapar el contenido (el área principal reserva el alto de la barra).
- RF-9 Los nombres de los acentos cambian en Ajustes; sus identificadores guardados (`red`, `blue`, …) no, así que no hay migración y nadie pierde su elección.
- RF-10 Tema claro, oscuro y "como el sistema" siguen funcionando igual (cookie, script de arranque, revelado).
- RF-11 Todo lo que funcionaba sigue funcionando: los tests existentes se actualizan a conciencia donde prueban textos, clases o estructura que cambian; no se borran para que pasen.

## Requisitos no funcionales

- RNF-1 Contraste AA en los dos temas y los seis acentos (test).
- RNF-2 Objetivos táctiles de 44 px o más en la navegación y los componentes base.
- RNF-3 Sin dependencias nuevas. Sin `backdrop-filter`. Animaciones solo de `transform`, `opacity` o recorte.
- RNF-4 El rendimiento de la spec 024 no empeora (`scripts/perf/measure.mjs`).

## Fuera de alcance

Rediseño de cada pantalla (026 a 029), Venito (027), Notas (028), cambiar la paleta de los calendarios o los identificadores de los acentos.

## Criterios de aceptación

- CA-1 P8 completo en verde con las guardias reescritas.
- CA-2 Capturas a 390, 768 y 1440 px, en claro y oscuro, con Coral y Sol, del marco con el calendario y de Ajustes.
- CA-3 `measure.mjs` sin regresión frente a "después" de la 024.
