# Spec 028 — Notas

> Estado: **Cerrada** (2026-11-15). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15). Quinta spec del encargo de rediseño. Migraciones nuevas, aplicadas solo en el Supabase local de esta sesión (ver "No probado").

## Contexto y objetivo

El usuario quiere apuntar listas de tareas, deberes de clase y pendientes del trabajo dentro de CaFam, rápido y con el móvil. Sección nueva, **Notas**, en la navegación principal.

## Usuarios / actores

- **Usuario con sesión**: crea notas personales (por defecto, privadas) o las vincula a un calendario suyo o compartido.
- **Miembros de un calendario**: ven las notas vinculadas a él; **Propietario y Editores** las cambian; **Lectores** solo leen.

## Modelo

- Una **nota** es una **lista** (elementos con casilla) o un **texto**. Tiene título (hasta 100), color opcional (de la paleta de calendarios), puede estar **fijada** y **archivada**, y lleva **fecha límite** opcional.
- Una **lista** tiene hasta 200 **elementos** (texto de 1 a 300, hecho o no, orden). Un **texto** tiene cuerpo de hasta 10.000 caracteres.
- **Personal** (sin calendario): solo la ve y la cambia su autor. **Compartida** (vinculada a un calendario): la ven los miembros; la cambian Propietario y Editores; la borran su autor (si aún puede escribir) y el Propietario del calendario. El permiso sale de **RLS**, nunca del código.
- Hasta **500** notas por autor.

## Requisitos funcionales

### Lista de notas (`/dashboard/notes`)

- RF-1 Destino "Notas" en la barra inferior y en la barra lateral. La pantalla muestra las notas en **tarjetas**: color, título, calendario si es compartida, fecha límite, y en las listas "X de Y" con sus tres primeros pendientes; en los textos, el comienzo.
- RF-2 **Fijadas** primero; después, por última modificación. Filtro por chips: Todas, Listas, Textos y Archivadas (las archivadas solo salen ahí). **Buscador** que filtra al escribir por título, cuerpo y elementos, sin distinguir mayúsculas ni tildes.
- RF-3 Estados vacíos con Venito: sin notas (con "Nueva nota"), sin resultados de búsqueda y sin archivadas.
- RF-4 "+" de la barra inferior (y "Nueva nota" en escritorio) abre `/dashboard/notes/new`: tipo (Lista o Texto), título opcional y dónde guardarla (Personal o un calendario en el que pueda escribir). Crear lleva a la nota.

### Una nota (`/dashboard/notes/[id]`)

- RF-5 Título editable en el sitio; se guarda al salir del campo.
- RF-6 **Lista**: "Añadir elemento" con Intro añade y deja el foco para el siguiente; marcar como hecho tacha con una animación corta y **baja el elemento** con los hechos; editar el texto en el sitio; **reordenar con botones** "Subir" y "Bajar" (accesibles; sin arrastre, ver plan D6); borrar un elemento avisa con **"Deshacer"**; "completadas X de Y" y "Borrar los completados".
- RF-7 **Texto**: área que se guarda sola (al dejar de escribir y al salir) y lo dice ("Guardado").
- RF-8 Acciones de la nota: fijar, archivar, color, fecha límite, vincular a un calendario o hacerla personal (solo su autor), y borrar (con confirmación).
- RF-9 **Edición optimista**: marcar, añadir, editar, mover y borrar se ven al instante; si el servidor falla, el cambio se revierte y se avisa.
- RF-10 Un Lector ve la nota compartida sin controles de edición y con el motivo ("Solo lectura: eres Lector de <calendario>").
- RF-11 Nota inexistente o ajena: 404.

### Tiempo real y datos

- RF-12 Los cambios de otra persona o de otro dispositivo aparecen sin recargar, por el mismo canal privado del calendario (`live_notify`); mientras se escribe en un campo, el refresco espera.
- RF-13 Todas las tablas nuevas tienen RLS y permisos por columna; los límites se imponen en la base de datos con `CF429` (`notes`, `items`) y se traducen al español.
- RF-14 **Borrar la cuenta** borra las notas personales; las compartidas se quedan en su calendario, sin autor. **Salir o ser expulsado** de un calendario deja allí las notas que se escribieron (como los eventos) y su autor deja de verlas. **Borrar un calendario** borra sus notas. **Juntar calendarios** mueve las notas al calendario resultante. Las **copias de un calendario sin propietario** copian sus notas.
- RF-15 `/privacy` explica qué se guarda de las notas y quién las ve.

## Requisitos no funcionales

- RNF-1 Abrir la lista hace como mucho 4 consultas; cada cambio, una escritura.
- RNF-2 Móvil primero: controles de 44 px o más, campos de 16 px, barra de añadir al alcance del pulgar.
- RNF-3 Accesible con teclado y lector de pantalla; los cambios se anuncian.
- RNF-4 Sin dependencias nuevas.

## Fuera de alcance (no incluido, documentado)

- Fecha límite **por elemento** (se deja por nota: suficiente para "deberes para el jueves" sin llenar cada fila de controles).
- Reordenar **arrastrando** (ver plan D6).
- Vencimientos en la agenda o en una tarjeta del calendario, y "notas de este evento".
- Crear o cambiar notas desde el asistente.
- Uso sin conexión.

## Criterios de aceptación

- CA-1 P8 con `test:db` en verde.
- CA-2 `tests/integration/notes.test.ts`: otro usuario no ve ni escribe; Lector lee y no escribe; Editor escribe; límites; orden; salir del calendario; borrar cuenta; juntar; copia.
- CA-3 Capturas de la lista y de una nota a 390 y 1440 px, claro y oscuro.
- CA-4 Recorrido en el iPhone emulado: crear una lista, añadir tres elementos con Intro, marcar uno, deshacer un borrado, fijar, buscar.

## No probado

Supabase dev y producción (sin credenciales en esta sesión): las migraciones se aplicaron y probaron en un Supabase local con las mismas 60 migraciones anteriores. `src/types/database.ts` se regeneró desde ese Supabase local. El usuario debe aplicar las migraciones a dev y a prod.
