# Spec 032 — Panel lateral desplazable y calendarios plegables

> Estado: **Aprobada** por el usuario el 2026-11-17, con el plan y las tareas aprobados de antemano ("Aprobada, plan y tareas incluidos"). Petición del 2026-11-17: "En la pestaña de Agenda (…) no se puede bajar, solamente el deslizable de la página sirve para bajar la agenda, y no los elementos de la izquierda", "en los calendarios, me gustaría que fuera un desplegable (…) que el usuario pudiera seleccionar cuándo ver los calendarios, cuándo ver los calendarios de un grupo" y "lo mismo para la configuración de los calendarios (…) aparece mucha información de golpe (…) sobre todo en un dispositivo móvil".

## Contexto

- **Fallo.** Desde 1024 px el panel del calendario (`#calendar-side-panel` en `calendar-workspace.tsx`) es `lg:sticky lg:top-56` sin alto máximo. Cuando la tarjeta de saludo, el mini calendario y los filtros miden más que la pantalla, la parte de abajo queda fuera y nunca se alcanza: la rueda y la barra de la página solo mueven la agenda (y en mes, semana y día no hay nada que desplazar).
- **Filtros** (`calendar-filters.tsx`): el árbol persona/grupo → calendario → categoría está siempre abierto y cada fila lleva dos botones "Subir"/"Bajar" de 44 px. Con varios grupos ocupa toda la columna y se ve recargado.
- **"Mis calendarios"** (`/dashboard/calendars`): cada calendario es una tarjeta con rol, estado de sincronización, selector de grupo y hasta cinco enlaces (Editar, Subir, Categorías, Compartir y miembros / Miembros y Salir); cada grupo, con su casilla, texto de visibilidad, Renombrar, Borrar, Subir y Bajar; y el formulario "Nuevo grupo" siempre a la vista. En el móvil es una pared de controles.

## Requisitos

### Fallo del panel lateral

- RF-1 Desde 1024 px el panel lateral del calendario tiene como alto máximo el espacio visible bajo la cabecera y **se desplaza por sí mismo** (rueda, barra o teclado) cuando su contenido no cabe, en todas las vistas. Al llegar a su final no arrastra a la página (`overscroll-behavior: contain`).
- RF-2 La agenda y la página siguen desplazándose como hoy; el panel sigue fijo a la vista mientras se desplaza la agenda.

### Calendarios plegables en los filtros

- RF-3 La sección "Calendarios" se puede **plegar entera** con su título (botón con `aria-expanded`). Plegada, muestra un resumen: "5 de 7 visibles".
- RF-4 Cada **grupo o persona** es un desplegable: una fila con la flecha (plegar/desplegar), la casilla de mostrar u ocultar todos sus calendarios (con su estado parcial, como hoy), el avatar o nombre y el número de visibles ("2/3"). Plegar **solo esconde la lista**: no cambia qué se ve en el calendario. Marcar o desmarcar la casilla sigue sin abrir ni cerrar el grupo.
- RF-5 Las **categorías** de un calendario quedan plegadas bajo él (flecha junto al calendario si tiene categorías); con alguna oculta, el calendario lo indica ("1 categoría oculta").
- RF-6 Lo plegado se recuerda **en el dispositivo** (`localStorage`, como la barra lateral de la 019), por grupo o persona. Por defecto todo desplegado salvo las categorías. Sin `localStorage`, todo funciona desplegado.
- RF-7 Los botones **Subir/Bajar desaparecen de la vista normal**. Un botón "Ordenar" junto al título activa el modo ordenar, que muestra las flechas como hoy (mismas reglas: grupos entre grupos, personas entre personas, "Sin propietario" al final) y "Hecho" para salir.
- RF-8 Lo mismo en la hoja "Calendarios" del móvil (`CalendarSheet`), que usa el mismo componente.
- RF-9 Accesible con teclado y lector de pantalla: botones con nombre ("Plegar Universidad", "Desplegar Universidad"), `aria-expanded` y `aria-controls`; 44 px de alto en cada fila.

### "Mis calendarios" más ligero

- RF-10 Cada grupo es una sección **plegable** con su nombre, el número de calendarios y la casilla de visibilidad; lo plegado se recuerda en el dispositivo (las mismas claves que los filtros, para que plegar "Universidad" en un sitio lo pliegue en los dos). "Sin grupo" también se pliega.
- RF-11 Las acciones del grupo (Renombrar, Borrar, Subir, Bajar) pasan a un **menú "Opciones del grupo"** (botón ⋯); el texto largo de visibilidad pasa a ser solo para lectores de pantalla.
- RF-12 Cada calendario es una **fila compacta**: punto de color, nombre, rol y, si es traído, "Google"/"iCloud". Tocarla despliega en el sitio sus detalles (estado de sincronización, selector de grupo) y sus acciones (Editar, Categorías, Compartir y miembros / Miembros, Subir, Salir). Solo uno abierto a la vez.
- RF-13 "Nuevo grupo" deja de ser un formulario fijo: es un chip junto a "Importar calendario", "Unirme con código"… que abre el campo en una `Sheet`.
- RF-14 Nada cambia en permisos, acciones ni base de datos: mismas Server Actions, mismos enlaces y mismas reglas de quién ve qué.

## Diseño

Identidad Nexo (enmienda 11): solo tokens y componentes de `components/ui` (`IconButton`, `Sheet`, `Chip`), `ChevronIcon` girando con los tokens de movimiento y versión reducida con `prefers-reduced-motion`. Capturas a 390, 768 y 1440 px, en claro y oscuro, con Violeta y Ámbar.

## Fuera de alcance

Ordenar arrastrando, guardar lo plegado en la base de datos (entre dispositivos), cambiar qué hace un grupo o mover calendarios entre grupos desde los filtros.

## Decisiones del usuario

1. "Configuración de los calendarios" son **las dos**: los filtros (RF-7) y "Mis calendarios" (RF-10 a RF-13).
2. Lo plegado se recuerda **en el dispositivo** (`localStorage`), sin migración.
