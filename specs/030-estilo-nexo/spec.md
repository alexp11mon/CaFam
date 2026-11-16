# Spec 030 — Estilo y usabilidad "Nexo" y Venito secretario

> Estado: **Cerrada** (2026-11-16). Pedida por el usuario en mitad del encargo de rediseño (mensaje del 2026-11-16 con el prototipo `prototipo_DiseñoVisualYUsabilidad.html` adjunto): "cambiar totalmente el estilo visual y de usabilidad de la aplicación para que se parezca más a este" y "cambiar la mascota: una foca con gafas, como si fuera una foca secretario; no hace falta que sea adorable". El cambio de estilo es el prioritario. La aprobación de las fases es la del encargo (sin preguntas de diseño; se documentan las decisiones). Sin migraciones ni dependencias.

## Contexto

La spec 025 definió la identidad "Orilla" (bruma, coral, Figtree, barra inferior con "+" central, barra lateral). El usuario la ha visto y prefiere otra dirección, la de su prototipo "Nexo". Esta spec **sustituye la identidad Orilla** (enmienda 11 de la constitución) conservando todo lo funcional de las specs 024 a 028 (ventana de eventos, chat de Venito, Notas).

El prototipo no se pudo ver pintado en esta sesión (carga Tailwind desde un CDN que la red no permite): se ha interpretado leyendo su código (variables, clases y cómo construye cada vista). Lo que se toma de él:

| Del prototipo | En CaFam |
|---------------|----------|
| Fondo lavanda `#f3f2fa`, paneles blancos, línea `#e9e7f5`, tinta `#1d1b2e`, texto secundario `#6f6c86`; versión oscura `#0f0e1a` / `#18172a` | Valores nuevos de `stone`, `paper`, `line`, `ink`, `muted` en los dos temas |
| Acento violeta `#6d5bf0` con **degradado** hacia azul en la acción principal y en la pestaña activa, con sombra teñida | `accent` por defecto Violeta; utilidad `bg-accent-gradient`; cada acento elegible tiene su degradado |
| Variante suave del acento (`--accs`) para lo activo de la navegación, chips y avatar | Token `accent-soft` |
| Inter, pesos 500–600, títulos `font-semibold tracking-tight` | Inter con `next/font`; títulos en semibold |
| Tarjetas de 20 px con borde fino y sombra suave teñida; botones y campos de 12 px; píldoras para pestañas y chips | Radios `card` 20 px, `control` 12 px, `block` 8 px |
| **Móvil**: cabecera fina con la marca y el nombre, tema y avatar; **navegación inferior flotante** en píldora (icono y nombre, la activa con fondo suave); **botones flotantes** a la derecha, encima: asistente (pequeño) y "+" (grande, degradado) | Igual: Calendario, Notas, Calendarios y Más en la píldora; Venito y "+" flotantes |
| **Escritorio**: barra superior con la marca, **pestañas en píldora centradas** y, a la derecha, "Nueva…", asistente, tema y avatar. Sin barra lateral | Igual, desde 769 px |
| Cabecera de cada vista dentro del contenido: título grande, subtítulo y "Hoy ‹ ›" a la derecha | El calendario lleva ahí su título, "Hoy ‹ ›" y el selector de vista en píldora; desaparece la barra del calendario de la 026 |
| Tarjeta "hero" con degradado, fecha, saludo y resumen | Tarjeta de saludo y próximo evento en la agenda (móvil) y en el panel (escritorio) |
| Hoja inferior en el móvil y ventana centrada en escritorio para crear | Ya era así (`Sheet`, `QuickCreate`); toman el estilo |
| Casillas redondas con "pop" y texto tachado con una línea que avanza | Listas de Notas |
| Etiquetas pequeñas en mayúsculas con espaciado (`.lbl`) para cabeceras de columnas y secciones | Permitidas de nuevo (la guardia las prohibía) |
| Aviso oscuro, pequeño, centrado sobre la navegación | `Toast` |

## Requisitos funcionales

- RF-1 **Enmienda 11** de la constitución: la identidad "Nexo" sustituye a "Orilla" (color, tipografía, radios, elevación, navegación, botones flotantes, etiquetas en mayúsculas y degradado del acento).
- RF-2 Tokens nuevos en `lib/theme/accents.ts` y `globals.css`, en claro y oscuro, con el contraste AA comprobado por test: texto 4,5:1, bordes de control 3:1 y **texto sobre los dos extremos de cada degradado** 4,5:1 (por eso algunos tonos son algo más oscuros que en el prototipo).
- RF-3 Seis acentos con los mismos identificadores guardados y nombres nuevos: **Violeta** (por defecto, `red`), **Azul**, **Verde**, **Ámbar**, **Rosa** (`purple`) y **Grafito**. Sin migración.
- RF-4 Tipografía **Inter** con cifras tabulares; títulos en semibold con interlineado ajustado.
- RF-5 **Navegación del móvil** (≤ 768 px): cabecera con la marca "CaFam" (en el calendario, además el mes desplegable), tema y avatar; píldora flotante abajo con Calendario, Notas, Calendarios y Más; botones flotantes a la derecha sobre la píldora: Venito (44 px) encima de "+" (56 px, degradado). Safe areas de iOS.
- RF-6 **Navegación de escritorio** (≥ 769 px): barra superior con marca, pestañas en píldora centradas (icono y, desde 1024 px, nombre; la activa con degradado), botón "Nuevo evento" / "Nueva nota", Venito, tema y avatar (que lleva a Ajustes). Desaparecen la barra lateral y la barra inferior de tableta. "Más" es un menú con Cuentas conectadas, Unirme, Importar, Ajustes y cerrar sesión.
- RF-7 **Calendario**: cabecera dentro del contenido con el título del periodo, "Hoy ‹ ›" y el selector de vista en píldora (Agenda, Día, Semana, Mes), más el botón de calendarios (filtros) en el móvil. Se retira la barra fija del calendario de la 026; deslizar sigue cambiando de periodo.
- RF-8 **Tarjeta de saludo**: degradado del acento con la fecha, "Buenos días/tardes/noches, <nombre>" y el próximo evento con su cuenta atrás (o "Nada en las próximas 24 horas"). En el móvil, sobre la agenda; en escritorio, en el panel lateral en lugar de "Próximo evento".
- RF-9 Componentes base con el estilo nuevo: botón primario con degradado y sombra teñida; secundario con borde fino; campos de 12 px de radio y 16 px de texto; chips y pestañas en píldora; tarjetas de 20 px; casillas redondas en las listas de Notas con "pop" y tachado animado; aviso oscuro.
- RF-10 **Venito secretario**: la misma foca de frente, ahora con **gafas redondas**, cuello de camisa y corbata, gesto serio (sin mofletes, ojos pequeños tras las gafas). Mismas seis expresiones y mismas reglas (SVG propio, tokens, movimiento reducido).
- RF-11 Se conserva todo lo funcional: ventana de eventos y rendimiento (024), chat de Venito con sugerencias (027), Notas (028), accesibilidad (foco visible, teclado, lectores, `prefers-reduced-motion`), temas y acentos. Los tests que fijaban la identidad Orilla o la estructura del marco se actualizan a conciencia.

## Requisitos no funcionales

- RNF-1 Sin `backdrop-filter` (se mantiene la decisión de la 024/025: el prototipo tampoco lo usa).
- RNF-2 Objetivos táctiles de 44 px o más en el móvil, aunque el prototipo use controles más pequeños.
- RNF-3 Sin regresión de rendimiento (`measure.mjs`).

## Diferencias deliberadas con el prototipo

- Los controles del móvil no bajan de 44 px ni los campos de 16 px.
- Los extremos de los degradados se oscurecen lo justo para que el texto blanco cumpla AA.
- El prototipo pone las vistas (Día, Semana, Mes) como destinos de la navegación; CaFam tiene además Notas, calendarios y ajustes, así que las vistas quedan como selector dentro del calendario.
- Se conserva el acento elegible (el prototipo solo tiene violeta).

## Criterios de aceptación

- CA-1 P8 en verde.
- CA-2 Capturas a 390, 768 y 1440 px, claro y oscuro, con Violeta y Ámbar, del calendario, Notas, el chat y Ajustes.
- CA-3 Recorrido completo en el iPhone emulado (`scripts/e2e-phone.mjs`).
