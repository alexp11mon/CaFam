# Spec 026 — Calendario móvil primero

> Estado: **En curso** (2026-11-15). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15). Tercera spec del encargo de rediseño. Sin migraciones ni dependencias.

## Contexto y objetivo

Con la base rápida (024) y la identidad Orilla (025), el calendario se reorganiza para usarlo con una mano en el iPhone, **sin perder ninguna función** de las specs 002 a 023: crear tocando o arrastrando, mover y redimensionar, tarjeta y hoja de detalle, filtros, "Ocupado", series, imágenes, comentarios, deshacer, atajos, fines de semana opcionales y tiempo real.

Qué fallaba en el móvil: para cambiar de vista o filtrar había que subir el pulgar al menú de la esquina superior izquierda y entrar en un cajón; "Hoy" estaba arriba; la última fila de la rejilla quedaba debajo de los botones flotantes.

## Diseño

**Barra del calendario**, pegada encima de la barra inferior (solo hasta 768 px), con todo lo que se hace muchas veces al día:

| Zona | Control |
|------|---------|
| Izquierda | **Vista** (botón con la vista actual; despliega hacia arriba Agenda, Día, Semana y Mes) |
| Centro | **‹ Hoy ›**: periodo anterior, hoy y periodo siguiente (en la agenda, que es continua, solo "Hoy") |
| Derecha | **Calendarios** (abre la hoja inferior con los filtros) |

- La **cabecera** queda solo con el mes (que despliega la fila de meses o el mini calendario) y el avatar.
- **Hoja "Calendarios"**: mostrar u ocultar calendarios, personas, grupos, categorías y disponibilidad; ordenar; y "Mostrar fines de semana" si están ocultos. Elegir qué se ve son dos toques: Calendarios → casilla.
- **Deslizar** cambia de periodo sin red (024), también sobre las horas.
- Las vistas ocupan justo el alto libre entre la cabecera y la barra del calendario, con las safe areas de iOS: nada queda tapado.
- **Venito** y los avisos suben por encima de la barra del calendario.
- **Estados vacíos y de error**: sin calendarios, un estado vacío con una sola acción; si falla la lectura de un periodo, aviso con "Reintentar".
- Desde 769 px no cambia la organización (barra de vistas arriba y panel lateral), solo el aspecto de la 025.

## Requisitos funcionales

- RF-1 Hasta 768 px hay una barra del calendario fija sobre la barra inferior con Vista, "‹ Hoy ›" y Calendarios, con objetivos de 44 px o más y nombre accesible en cada control.
- RF-2 "Vista" despliega las cuatro vistas, marca la actual (`aria-current`), se cierra al elegir, con Escape o al tocar fuera, y recuerda la vista elegida en la cuenta (spec 008 RF-25).
- RF-3 "Anterior" y "Siguiente" cambian de periodo en el navegador (024); no se muestran en la agenda. "Hoy" vuelve a hoy (en la agenda, desplaza) y dice la fecha completa a los lectores de pantalla.
- RF-4 "Calendarios" abre la hoja inferior con los filtros; al cerrarla, el foco vuelve al botón. La hoja ya no lleva las vistas.
- RF-5 La cabecera del móvil muestra el mes con su desplegable y el avatar; "Hoy" y los filtros ya no están arriba.
- RF-6 Mes, semana y día miden el alto libre: `100dvh` menos cabecera, barra del calendario, barra inferior y safe areas.
- RF-7 El botón del asistente y los avisos quedan por encima de la barra del calendario mientras está en pantalla.
- RF-8 Sin calendarios se muestra un estado vacío (`EmptyState`) con "Crear calendario". Si la lectura de un periodo falla, el aviso ofrece "Reintentar", que vuelve a pedirlo.
- RF-9 Todo lo demás del calendario sigue funcionando igual, en móvil y escritorio (tests existentes).

## Requisitos no funcionales

- RNF-1 Sin regresión de rendimiento frente a la 024 (`measure.mjs`).
- RNF-2 Usable solo con teclado y con lector de pantalla; contraste AA en los dos temas.

## Fuera de alcance y diferido

- **Periodos contiguos ya pintados** (para bajar de 80–110 ms al cambiar de mes con la CPU 4×): exige partir el workspace en paneles por periodo. Sigue diferido; las medidas actuales cumplen el objetivo en semana y día y rozan el del mes. Queda anotado como siguiente mejora de rendimiento.
- `lazy()` de la ventana rápida, la tarjeta y el menú contextual (diferido de la 024): no se aborda; su peso es pequeño frente al cliente de Supabase, que ya no bloquea.
- Rediseñar el formulario completo de evento y el detalle (se revisan en la 029 con el resto de pantallas).

## Criterios de aceptación

- CA-1 P8 en verde.
- CA-2 Capturas a 390 px (claro y oscuro, Coral y Sol) de agenda, mes, semana y día, y de la hoja de calendarios; y a 768 y 1440 px del mes.
- CA-3 Recorrido en el iPhone emulado: cambiar de vista desde la barra, anterior/siguiente/hoy, abrir Calendarios y ocultar uno, crear un evento tocando un hueco, deslizar.
