# Auditoría de Google Calendar con agent-desktop (specs 019 y 020)

> Fecha: 2026-11-02. Herramienta: `agent-desktop` 1.0.2 (árbol de accesibilidad de Windows, clics, teclas y arrastres físicos) sobre calendar.google.com en Brave, con la **cuenta secundaria** del usuario, que la ofreció para esto. Pantalla de 1920 × 1080 al 125 %.
> Alcance: el **comportamiento** de la web de escritorio, para compararlo con CaFam tras las specs 008, 016 y 017. No se ha copiado código, estilos, iconos ni imágenes de Google. Las 30 capturas se quedaron en el directorio temporal de la sesión y no se suben al repositorio.
> Limpieza: los dos eventos de prueba ("Prueba CaFam 1" y "Prueba CaFam 2") se borraron al terminar. Los fines de semana y la barra lateral se dejaron como estaban.

## Lo que no se pudo observar

- **La app del móvil**: no hay ningún Android conectado por ADB, y la de iPhone es nativa. Como referencia del móvil siguen valiendo las capturas del iPhone de la spec 016 (`specs/016-calendario-estilo-google/evidencias`).
- **La web de Google a anchura de móvil**: con la ventana a 520 px **no se adapta**. Mantiene la barra lateral y aprieta la semana en una columna de 150 px, porque Google manda los móviles a su app. En el móvil, CaFam (PWA, specs 016 y 017) ya va por delante de la web de Google.
- **El diálogo de atajos (?)**: con el teclado español no se pudo enviar la tecla "?". La lista del atajo está en Ajustes → "Combinaciones de teclas".
- **Los niveles de permiso al compartir un calendario**: no se abrió el diálogo, para no compartir nada por error. Según la ayuda pública, son "Ver solo libre/ocupado", "Ver todos los detalles", "Hacer cambios" y "Hacer cambios y gestionar el uso compartido".

## Hallazgos (observado)

### Crear

| # | Observación | ¿CaFam? |
|---|-------------|---------|
| A1 | Un clic en un hueco de la semana crea un **bloque provisional** de 1 h "(Sin título)" y abre la ventana rápida **junto al hueco**: a la derecha si cabe y a la izquierda si no. | Sí (008) |
| A2 | Lo que se escribe en el título aparece al momento en el bloque provisional. | Sí (008) |
| A3 | Pestañas Evento / Tarea / Agenda de citas, día y horas, "Zona horaria · No se repite", invitados, Meet, ubicación, descripción (se despliega dentro de la ventana con negrita, listas y enlaces), calendario con su punto y "No disponible · Visibilidad · Notificar". "Más opciones" y "Guardar". | Parcial: sin tareas, citas, invitados ni zona horaria por evento (fuera de alcance) |
| A4 | **Intro guarda** desde el título. | Sí: es un formulario |
| A5 | Arrastrar en la rejilla dibuja el intervalo (10:00–12:00) y abre la misma ventana. | Sí (008) |
| A6 | Al guardar sale el aviso "Evento guardado · Deshacer". | Sí (017) |
| A7 | **Duración predeterminada** configurable en Ajustes → Ajustes de eventos (por defecto 60 minutos). | **No**: siempre 1 h |

### Ver un evento

| # | Observación | ¿CaFam? |
|---|-------------|---------|
| B1 | Un clic en un evento abre una **tarjeta pequeña anclada al bloque**, **sin fondo oscuro**: la rejilla sigue a la vista. Lleva Editar, Borrar, Correo, ⋮ y Cerrar; debajo, color, título, "Lunes, 2 de noviembre · 8:30 – 9:30am", aviso y calendario. | **No**: CaFam abre una ventana centrada de hasta 672 px con fondo, que tapa el calendario |
| B2 | La tarjeta se coloca a la derecha del evento y, si no cabe, a la izquierda (miércoles, columna 4 de 7). | **No** |
| B3 | El menú ⋮ ofrece Imprimir, Duplicar, Publicar evento y Cambiar de propietario. | Duplicar sí |
| B4 | Escape cierra primero el menú abierto y después la tarjeta. | Sí, en la ventana |
| B5 | Con la tarjeta abierta, **Supr** borra el evento y sale "Evento eliminado · Deshacer". | Sí (017) |

### Mover y menú

| # | Observación | ¿CaFam? |
|---|-------------|---------|
| C1 | Arrastrar un evento lo cambia de día y de hora conservando la duración; arrastrar el borde inferior cambia el fin. Guarda sin preguntar, con "Deshacer". | Sí (017) |
| C2 | Clic derecho: Eliminar, color personalizado (lápiz), 24 colores y "Predeterminada". | Sí, con 13 colores (017) |

### Vistas y navegación

| # | Observación | ¿CaFam? |
|---|-------------|---------|
| D1 | Menú de vista con atajos: Día D, Semana W, Mes M, Año Y, Agenda A, 4 días X. Debajo, "Mostrar fines de semana", "Mostrar eventos rechazados" y "Mostrar tareas completadas". | Vistas D/S/M/A sí; Año y 4 días no (fuera de alcance, §11) |
| D2 | **Sin fines de semana**, la semana pasa a lunes–viernes con columnas más anchas y la franja de día completo desaparece si está vacía. El mini calendario sigue mostrando la semana entera. | **No** |
| D3 | El botón ≡ **pliega la barra lateral**: la rejilla ocupa todo el ancho, "Crear" pasa a un botón redondo "+" y el título gana una flecha que despliega el mini calendario. | **No** en escritorio (sí en el móvil, spec 016) |
| D4 | La vista mes solo pinta las semanas que necesita (5 filas en noviembre de 2026). Los eventos con hora salen como punto + hora + título y los de día completo como barra. | Parcial: CaFam usa bloques rellenos (016) |
| D5 | La agenda del escritorio solo lista los días con eventos, con la línea de ahora. | CaFam muestra también "Sin eventos" por semana (016) |
| D6 | Vista año: los 12 meses en miniatura con hoy marcado. | No (fuera de alcance) |
| D7 | **Búsqueda** (lupa): los resultados salen como agenda en `/search?q=`, con un desplegable de filtros avanzados. | No (hoja de ruta "Futura") |
| D8 | La URL refleja la vista: `/r/week`, `/r/month`, `/r/year`, `/r/agenda`. | Sí (`?view=`) |

### Ajustes (leídos del árbol de accesibilidad)

| # | Ajuste | ¿CaFam? |
|---|--------|---------|
| E1 | Duración predeterminada (60 minutos) y "Reuniones rápidas" (acabar 5 o 10 minutos antes). | **No** |
| E2 | Notificaciones: "Alertas", posponer y sonidos; por calendario, avisos por defecto ("30 minutos antes", "El día antes a las 5pm") y correos de cambios y de agenda diaria. | No (recordatorios push en la hoja de ruta) |
| E3 | Opciones de visualización: fines de semana, eventos rechazados, tareas completadas, **números de semana**, **mostrar los eventos cortos como de 30 minutos**, **atenuar los eventos pasados**, **calendarios en paralelo en la vista de día**, día de inicio de semana (Domingo), vista personalizada (4 días) y calendarios alternativos. | Ninguna (CaFam empieza siempre en lunes) |
| E4 | Combinaciones de teclas activables y "Acceso sin conexión" de "Mis calendarios". | Atajos siempre activos; sin conexión no (fuera de alcance) |
| E5 | Por calendario: compartir públicamente, compartir con personas, etiquetas y colores de evento ("Editar etiquetas"), avisos por defecto, dirección secreta en formato iCal y eliminar. | Compartir y categorías sí; exportar a `.ics` no (fuera de alcance) |

## Lo que se lleva a las specs

- **Spec 019** (escritorio, móvil y tiempo real): tarjeta de detalle anclada (B1, B2), barra lateral plegable con el mini calendario en el título (D3), ocultar los fines de semana (D2), duración predeterminada (A7, E1), atajo C, bloque provisional ajustable en el móvil y cambios de otros miembros al momento. Lo último no es de Google: es la queja más repetida de sus usuarios ("Sync and lost data", el 12 % de las 510 reseñas de `replica/feedback.md`).
- **Spec 020** (disponibilidad en la rejilla y sincronización rápida): "Ocupado" de otras personas en semana y día (el nivel "solo libre/ocupado" de Google) y los cambios de Google en minutos.
- **Candidatos sin spec**, para que el usuario decida: atenuar los eventos pasados, números de semana, calendarios en paralelo en la vista de día (una columna por persona, muy útil en familia), vista año, vista de 4 días y búsqueda.
