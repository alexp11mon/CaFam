<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CaFam — guía para agentes

Contexto completo del proyecto para cualquier IA que empiece a trabajar en él. Léelo entero antes de tocar código. El bloque de arriba lo gestiona `next dev`: no lo edites; todo lo de debajo es documentación del proyecto y `next dev` lo respeta.

> Última actualización: 2026-11-19, al cerrar las specs 043 (exportar y suscripción `.ics`) y 044 (importar a un calendario existente y mantenerlo actualizado desde su enlace), en la rama `044-importar-y-actualizar-ics`.

## 0. Mapa del proyecto: graphify (obligatorio)

El proyecto tiene un **grafo de conocimiento** generado con [graphify](https://github.com/safishamsi/graphify) en `graphify-out/` (constitución, enmienda 13): cada archivo, componente, función, test y doc es un nodo, con sus relaciones (importa, llama, prueba…) y agrupado en comunidades ("Offline Mode", "Sync Engine", "Recurring Events"…). Es la **primera fuente** para saber dónde está algo y cómo se relaciona, en lugar de recorrer las carpetas una a una.

**Cómo usarlo** (en esta máquina el lanzador `graphify` no está en el PATH: usa siempre `python -m graphify`):

```
python -m graphify query "¿cómo se envía la cola sin conexión?"   # subgrafo para una pregunta (BFS); --dfs para seguir un camino; --budget N limita tokens
python -m graphify explain "flush()"                              # un nodo y sus vecinos (función, componente, archivo)
python -m graphify path "EventPanel" "applyOfflineChange"         # camino más corto entre dos conceptos
python -m graphify update .                                       # re-extrae el código cambiado (AST, sin API ni coste, ~25 s)
python -m graphify update . --force                               # igual, pero acepta que el grafo encoja (tras borrar código)
python -m graphify hook status                                    # comprueba los hooks de git
```

Reglas:

1. **Antes de buscar o abrir archivos** para entender el código (Grep, Glob, Read, `rg`, `find`), consulta el grafo con `query`, `explain` o `path`. Lee después solo los archivos y líneas que te señala. Los hooks `PreToolUse` de `.claude/settings.json` (`python -m graphify hook-guard`) te lo recuerdan y añaden lo que el grafo sabe del término buscado. Si lanzas subagentes que exploran código, ponles esta regla en el prompt.
2. `graphify-out/GRAPH_REPORT.md` (nodos dios, comunidades, conexiones sorprendentes) solo para una revisión amplia de la arquitectura o si `query` no basta. `graphify-out/graph.html` es la vista interactiva para el usuario (agregada por comunidades: hay más de 5.000 nodos).
3. **Mantenlo al día:** los hooks de git (`post-commit`, `post-checkout`, `post-merge`, `post-rewrite`, instalados con `python -m graphify hook install`) lo regeneran en segundo plano tras cada commit, cambio de rama o merge (log en `~/.cache/graphify-rebuild.log`; no se ejecutan en los worktrees ni a mitad de un rebase o merge). Además, si en la tarea creas, mueves o borras archivos o carpetas, ejecuta `python -m graphify update .` antes de cerrarla (con `--force` si borraste código: sin él, graphify se niega a encoger el grafo). Forma parte de la verificación obligatoria.
4. `update` solo re-extrae **código** (AST). Los cambios en docs y specs (`.md`) no entran en el grafo sin una extracción semántica (`/graphify . --update` en Claude Code, que gasta tokens del agente); hazla solo si el usuario la pide.
5. **No se versiona:** `graphify-out/` está en `.gitignore` (pesa más de 10 MB, guarda rutas absolutas y caché y cambia en cada commit). En una máquina o sesión nueva sin grafo: instala `graphifyy` (`pip install graphifyy`), ejecuta `python -m graphify update .` (crea el grafo de código) y `python -m graphify hook install`.
6. El grafo describe el código; **no sustituye** a la constitución, las specs ni este archivo, que mandan sobre las decisiones.

## 1. Qué es

**CaFam** es una PWA de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso **estrictamente personal** entre familia y amigos. Cada usuario se registra, ve sus calendarios en un panel, crea eventos, los comparte con roles Lector/Editor (por enlace o por ID y PIN) e importa calendarios externos (Google, iCloud, Outlook) desde un enlace o archivo `.ics`.

- **Nombre único: CaFam** en todas partes (constitución, enmienda 3). Los nombres anteriores del proyecto (listados en la spec 010) no se usan; los impide `tests/unit/project-name.test.ts`. Solo se conservan la URL de Vercel y las migraciones ya aplicadas.
- Sin ánimo de lucro, sin publicidad ni analítica, y **coste cero**: solo capas gratuitas (Supabase Free, Vercel Hobby, GitHub Free, Brevo y, desde la 015, un proveedor LLM gratuito).
- Producción: <https://calendario-familia-five.vercel.app>
- Repositorio (privado): <https://github.com/alexp11mon/CaFam> (renombrado en la spec 010; GitHub redirige el nombre anterior)
- Idioma: **español** en todo lo visible para el usuario, docs, specs y mensajes de commit; **inglés** en identificadores, nombres de archivos y comentarios técnicos.

## 2. Estado actual

| Spec | Alcance | Estado |
|------|---------|--------|
| 001-base-aplicacion | Proyecto base, auth email/contraseña, esquema con RLS, panel esqueleto, PWA, despliegue | **Cerrada** (2026-10-21), T1–T12 hechas |
| 002-calendarios-y-eventos | CRUD de calendarios, categorías y eventos; vistas mensual, semanal y diaria; filtros por persona con orden guardado; juntar calendarios | **Cerrada** (2026-10-21), T1–T12 hechas |
| 003-comparticion | Enlace de invitación, ID de calendario + PIN, roles Lector/Editor, lista de miembros, aviso al juntar | **Cerrada** (2026-10-22), T1–T12 hechas |
| 004-importacion-ics | Importación única de un `.ics` (enlace o archivo) a un calendario propio editable y compartible | **Cerrada** (2026-10-22), T1–T11 hechas |
| 005-identidad-visual | Identidad visual propia en todas las pantallas, acento elegido por el usuario (6 colores), marco con barra lateral e inferior, vista agenda, mini calendario y próximo evento | **Cerrada** (2026-10-22), T1–T13 hechas |
| 006-gestion-de-cuenta | Recuperar y cambiar contraseña, cambiar email, editar perfil, borrar cuenta con calendarios sin propietario, autor del evento | **Cerrada** (2026-10-23), T1–T26 hechas; aplicada y validada en producción |
| 007-sincronizacion-oauth | Sincronización de solo lectura (proveedor → CaFam) con **Google** por OAuth 2.0, actualización automática y manual, y grupos de calendarios. Microsoft se quitó el 2026-10-27 (Enmienda 1: exige tarjeta); la bidireccional y Microsoft quedan para una versión futura | **Cerrada** (2026-10-28), T1–T15 hechas; aplicada y validada en producción con la aplicación de Google en "Prueba" (Enmienda 2; publicada desde la 009) |
| 008-mejoras-de-experiencia | Calendario al estilo Google Calendar (analizado con REA): ventana de evento sobre el calendario, ventana rápida, arrastrar para crear, selector de hora, atajos, vista recordada, avisos y esqueletos | **Cerrada** (2026-10-24), T1–T23 hechas; aplicada y validada en producción |
| 009-sincronizacion-bidireccional | Escribir en Google lo que se crea, cambia, mueve o borra en los calendarios traídos (propietario y Editores), renombrar, crear y subir calendarios, política de privacidad y publicar la aplicación de Google | **Cerrada** (2026-10-29), T1–T14 hechas; aplicada y validada en producción, con la aplicación de Google publicada sin verificar |
| 010-renombrar-cafam | Renombrar todo el proyecto a CaFam (interfaz, PWA, correos, configuración, tests, documentación, specs cerradas y repositorio) | **Cerrada** (2026-10-29), T1–T8 hechas; migración `rename_cafam` aplicada en prod, paneles de correo revisados y repositorio renombrado |
| 011-rediseno-visual | Modo oscuro con selector, transparencias (glassmorphism), animaciones, microinteracciones y transiciones entre vistas | **Cerrada** (2026-10-30), T1–T13 hechas; migración `profile_theme` aplicada en prod |
| 012-imagenes-en-eventos | Imágenes en los eventos con Supabase Storage, también de Lectores y en calendarios traídos de Google | **Cerrada** (2026-10-30), T1–T13 hechas; migraciones aplicadas en prod |
| 013-eventos-recurrentes | Eventos repetidos con reglas personalizables y edición de una repetición, de las siguientes o de toda la serie | **Cerrada** (2026-10-31), T1–T16 hechas; 6 migraciones aplicadas en prod |
| 014-comentarios-en-eventos | Comentarios en los eventos por cualquier miembro, Lectores incluidos | **Cerrada** (2026-11-01), T1–T11 hechas; 2 migraciones aplicadas en prod |
| 015-asistente-de-chat | Asistente de chat sobre los eventos y la disponibilidad común, con un proveedor LLM gratuito (no Gemini) | **Cerrada** (2026-11-04), T1–T16 hechas, con la ampliación de comentarios y botón flotante (T14–T16, sin migraciones); migración `assistant` y `GROQ_API_KEY` en prod |
| 019-escritorio-movil-tiempo-real | Tarjeta de detalle junto al evento en el ordenador, barra lateral plegable, ocultar fines de semana, duración de un evento nuevo, tecla C, bloque provisional ajustable en el móvil y calendario en tiempo real con Supabase Realtime (enmienda 7) | **Cerrada** (2026-11-02), T1–T14 hechas; migraciones `live_changes` y `profile_view_options` aplicadas en prod |
| 016-calendario-estilo-google | Calendario como Google Calendar en el móvil: bloques rellenos, cabecera con cajón y "+", deslizar, agenda continua y fila de meses (enmienda 4 de la constitución) | **Cerrada** (2026-10-30), T1–T13 hechas; sin migraciones. La prueba en el iPhone se hace en producción |
| 017-mover-eventos-y-menu | Mover y redimensionar arrastrando, menú contextual en el ordenador, "Deshacer" en los avisos, detalle en hoja inferior en el móvil, pellizcar para ampliar y atajos nuevos (enmienda 5) | **Cerrada** (2026-11-01), T1–T16 hechas; 2 migraciones aplicadas en prod |
| 018-sincronizacion-icloud | Calendarios de iCloud (iPhone) por CalDAV con contraseña específica de app, con el mismo alcance que Google en la 007 y la 009 (leer, escribir, renombrar, crear y subir). Dependencia `tsdav` aprobada; se instala en la primera tarea | **Cerrada** (2026-11-01), T1–T15 hechas; 2 migraciones aplicadas en prod; enmienda 6 aplicada |
| 020-disponibilidad-y-sincronizacion-rapida | Bloques "Ocupado" de otras personas (con su consentimiento) en semana y día, avisos de Google en minutos, iCloud cada 15 minutos y comprobación de versión antes de leer | **Cerrada** (2026-11-09), T1–T13 hechas; migraciones `busy_grid` y `sync_fast` aplicadas en prod, `SYNC_PUSH_URL` en Vercel y pruebas de Google e iPhone en producción correctas |
| 021-animaciones-y-microinteracciones | Movimiento con intención en toda la app: curvas y duraciones como tokens, desplegables que nacen del disparador, listas escalonadas, interruptor, pulso de guardado, regreso en arco, evento → detalle, seguir al dedo con goma, selector de vista y revelado del tema | **Cerrada** (2026-11-08), T1–T19 hechas; sin migraciones ni dependencias nuevas. Pendientes del usuario la prueba en el iPhone (plan R2) y la medida con la CPU ralentizada |
| 022-eventos-desde-imagen | Adjuntar hasta 3 imágenes (un horario de trabajo) al asistente, que devuelve una propuesta de eventos sueltos editable y corregible por chat; nada se crea hasta pulsar "Crear", en cualquier calendario escribible (también Google e iCloud) | **Cerrada** (2026-11-09), T1–T12 hechas; sin migraciones ni dependencias. Pendiente la prueba del usuario en el iPhone en producción |
| 023-auditoria-y-correcciones | Auditoría completa (seguridad, lógica, rendimiento, accesibilidad, diseño y repositorio) y corrección de 25 hallazgos: `restore_event` y `assistant_busy` acotados, `join_with_code` serializado, cabeceras de seguridad, secreto en tiempo constante, series movidas de fecha y con cambio de hora, eventos de las 23:46–23:59, comentarios al convertir en serie, lectura de más de 1.000 eventos, lecturas en paralelo, páginas de error en español, accesibilidad con teclado, Ctrl/⌘+Z (enmienda 9) y coherencia visual de las pantallas secundarias | **Cerrada** (2026-11-12), T1–T16 hechas; 3 migraciones aplicadas solo en dev (pendiente `db push` a prod), sin dependencias. Aprobada de antemano por el usuario en el prompt de arranque |
| 024-rendimiento | Medir y arreglar: el calendario lee una ventana ancha de eventos y cambia de periodo en el navegador sin red (`pushState`), precarga de los periodos contiguos, sin precargas de enlaces, deslizar sobre la rejilla, asistente en streaming con progreso real y herramientas en paralelo | **Cerrada** (2026-11-15), T1–T9; sin migraciones. Medidas antes y después en la spec (mes 601 → 80–110 ms con la CPU 4×) |
| 025-sistema-de-diseno-y-marca | Identidad "Orilla" (enmienda 10), sin `backdrop-filter`, radios y elevaciones como tokens, componentes base nuevos (`IconButton`, `Card`, `Chip`, `Sheet`, `EmptyState`), marca nueva. **Su identidad la sustituyó la 030**; quedan sus componentes y sus guardias | **Cerrada** (2026-11-15), T1–T7 |
| 026-calendario-movil-primero | Hoja inferior de calendarios (filtros), alto libre de las vistas, estado vacío y "Reintentar". Su barra fija del calendario la sustituyó la cabecera de la 030 | **Cerrada** (2026-11-15), T1–T4 |
| 027-venito-y-asistente | Venito, la mascota (SVG propio con seis expresiones); chat como conversación (burbujas, hora, "escribiendo…", barra de entrada, sugerencias contextuales) en un panel que se abre sin navegar | **Cerrada** (2026-11-15), T1–T6; sin migraciones. `eval:assistant` y `eval:schedule` no ejecutados (prompt y herramientas sin cambios) |
| 028-notas | Sección Notas: listas de tareas y notas de texto, personales o compartidas por calendario con sus roles, edición optimista, "Deshacer", búsqueda, fijar, archivar, fecha límite y tiempo real | **Cerrada** (2026-11-15), T1–T6; **2 migraciones aplicadas solo en un Supabase local** (pendiente `db push` a dev y a prod) |
| 029-pantallas-restantes-y-cierre | Revisión de las pantallas secundarias, recorrido completo en móvil (`scripts/e2e-phone.mjs`), capturas y esta documentación | **Cerrada** (2026-11-16), T1–T4 |
| 030-estilo-nexo | Identidad "Nexo" pedida por el usuario con su prototipo (enmienda 11): lavanda, violeta con degradado, Inter, navegación en píldora (flotante abajo en el móvil con "+" y Venito flotantes; arriba en escritorio), cabecera del calendario en el contenido, tarjeta de saludo y Venito secretario con gafas | **Cerrada** (2026-11-16), T1–T6; sin migraciones |
| 031-venito-morsa | Venito pasa de foca a morsa de línea con gafas, colmillos y bigotes, como la referencia del usuario (enmienda 12) | **Cerrada** (2026-11-16), T1; sin migraciones |
| 032-calendarios-plegables | Panel lateral del calendario que se desplaza por sí mismo (fallo: con muchos calendarios no se llegaba a los de abajo), grupos y personas plegables en los filtros con modo "Ordenar", y "Mis calendarios" con grupos plegables, opciones tras "⋯", calendarios en filas que se despliegan y "Nuevo grupo" en una hoja | **Cerrada** (2026-11-17), T1–T5; sin migraciones. Spec, plan y tareas aprobados de antemano por el usuario |
| 033-vulnerabilidades | `next` y `eslint-config-next` 16.4.2 → 16.4.6 (GHSA-mfr8-8qww-v76h) y `npm audit fix` de las herramientas de desarrollo (`minimatch`, `typescript-eslint`): `npm audit` con 0 vulnerabilidades | **Cerrada** (2026-11-17), T1; sin migraciones ni dependencias nuevas |
| 034-modo-sin-conexion | Copia del dispositivo (IndexedDB) con los eventos de 1 mes atrás a 3 meses adelante y todas las notas; la app se abre sin red desde `/offline`; cambios de eventos y notas en una cola que se envía en orden al volver la red; conflictos con las dos versiones, "Cambios no enviados", y borrado de los datos al cerrar sesión | **Cerrada** (2026-11-18), T1–T12; sin migraciones ni dependencias. Pendiente la prueba del usuario en el iPhone |
| 035-sin-conexion-fase-2 | Sin conexión también en calendarios de Google e iCloud (se escribe primero en el proveedor al volver la red), series con sus tres alcances y "Repetir", comentarios, miniaturas e imágenes (añadir y borrar), envío con la app cerrada (Background Sync, Chromium) y "Volver a conectar" para la cuenta retenida | **Cerrada** (2026-11-18), T1–T12; sin migraciones ni dependencias. Pendientes del usuario las pruebas con cuentas reales de Google e iCloud, Chrome de Android y el iPhone |
| 036-venito-crea-y-edita | Venito crea eventos (hora fija o relativa a otro evento, "justo cuando acabe PIAE") y propone cambios que se confirman; calendario y evento por su nombre, "Deshacer", nunca borra, 3 por mensaje | **Hecha** (2026-11-18), T1–T10; sin migraciones ni dependencias. Pendientes del usuario: `EVAL_PART=write npm run eval:assistant` contra Groq y el cierre. |
| 037-boton-crear-en-el-chat | En `/dashboard/assistant` el "+" flotante del móvil tapaba "Enviar", y desde 1024 px la página medía toda la pantalla bajo la barra superior (barra de entrada cortada). `CreateButton` flotante no se pinta en el asistente; la página pierde `lg:h-dvh` | **Cerrada** (2026-11-18), T1; sin migraciones. Pendiente la prueba en el iPhone tras el merge |
| 038-sincronizacion-sin-borrar-fuera-de-ventana | La sincronización solo borra los eventos traídos que solapan la ventana leída (6 meses atrás, 12 adelante) y no omitidos por el límite de 2.000; lo antiguo queda como copia con la nota "Copia antigua: ya no se actualiza desde Google/iCloud" | **Cerrada** (2026-11-18), T1–T4; migración `sync_apply_window` aplicada en dev (pendiente `db push` a prod **antes** de desplegar) |
| 040-recordatorios-y-notificaciones | Hasta 3 recordatorios personales por evento con aviso por defecto, avisos sociales (unirse, acceso, comentarios, cambios), Web Push con VAPID y cifrado `aes128gcm` propios (`node:crypto`), Ajustes "Notificaciones" y "Avisarme" en el detalle | **Cerrada** (2026-11-18), T1–T8; migración `push` aplicada en dev (pendiente `db push` a prod y claves VAPID en Vercel). Pendiente del usuario la prueba en el iPhone y Android |
| 041-alta-en-lenguaje-natural | "Escribe el evento" en el alta rápida y en el formulario: un analizador propio en español, sin IA (fechas, horas, duración, lugar, `@calendario`, repetición sencilla), con vista previa en vivo y "Aplicar" | **Cerrada** (2026-11-18), T1–T6; sin migraciones ni dependencias |
| 042-vistas-de-ano-y-4-dias | Vista "Año" (12 meses con puntos por calendario, leídos agregados con `calendar_day_marks`) y "4 días" (la rejilla de la semana con 4 columnas), atajos Y y X, "Más vistas" en el móvil y sin conexión desde la copia | **Cerrada** (2026-11-19), T1–T6; migración `views_year` aplicada en dev (pendiente `db push` a prod **antes** de desplegar) |
| 043-exportar-y-suscripcion-ics | "Exportar (.ics)" de cada calendario y "Exportar los visibles" en los filtros (`/api/ics/export`, con sesión), y enlace secreto de suscripción de solo lectura por calendario (`/api/ics/<token>.ics`, solo el propietario lo crea) con su `.ics` escrito a mano (series con `RRULE`, `VTIMEZONE` y excepciones) | **Cerrada** (2026-11-19), T1–T5; migración `ics_feeds` aplicada en dev (pendiente `db push` a prod) |
| 044-importar-y-actualizar-ics | Importar un `.ics` a un calendario que ya existe sin repetir eventos (identidad `UID` en `external_id`), y "Mantener actualizado desde este enlace": cada 6 horas se añaden, cambian y quitan los eventos del enlace (URL en Vault, `pg_cron` y `/api/ics/refresh`), con "Actualizar ahora", "Reintentar", "Dejar de actualizar" y aviso a los 3 fallos | **Cerrada** (2026-11-19), T1–T6; migraciones `ics_import_into` e `ics_subscriptions` aplicadas en dev (pendiente `db push` a prod) |
| 039-busqueda-de-eventos | Búsqueda por título, lugar, descripción y comentarios en todos los calendarios (también los ocultos), sin tildes ni mayúsculas, con series por repetición, agrupada por día, en `/dashboard/search`, con la lupa en las cabeceras, la tecla `/` y sin conexión sobre la copia | **Cerrada** (2026-11-18), T1–T6; migración `event_search` aplicada en dev (pendiente `db push` a prod) |

Las specs 001–004 (cerradas, no se editan) citan la gestión de cuenta como "spec 005" y OAuth como "spec 006": hoy son la 006 y la 007.

> Las secciones "Añadido por la spec NNN" cuentan lo que añadió cada spec **en su momento**. Lo visual y el marco de la 005, la 011, la 016, la 019 y la 025 (piedra, Inter Tight, cristal, barra lateral, cajón, barra inferior entre 769 y 1023 px) lo sustituyeron la identidad **Nexo** y su marco (030, ver §6 "Identidad visual"); el asistente pasó a ser un panel con Venito (027) y responde en streaming (024). Ante una contradicción manda la spec más reciente.

Lo que hay hoy: registro, login, logout, protección de rutas, portada, pantalla offline, PWA instalable y cron de keep-alive (spec 001), y además (spec 002):

- Panel con los calendarios en el orden guardado por el usuario, con accesos a crear, editar, categorías y juntar.
- CRUD de calendarios (nombre, descripción, color de una paleta pastel cerrada) y de categorías por calendario.
- CRUD de eventos (hora, día completo, varios días, descripción, lugar, color propio y categoría).
- Vistas mensual, semanal y diaria que mezclan todos los calendarios, con panel de filtros por persona → calendario → categoría. La visibilidad y el orden se guardan por usuario.
- Juntar calendarios propios en uno (fusión real, irreversible, con confirmación).

Añadido por la spec 003:

- Compartir por **enlace** (`/dashboard/calendars/[id]/share`): rol Lector o Editor, 1 a 20 usos, caduca a los 7 días, se muestra una sola vez y se puede revocar. La ruta pública `/invite/[token]` enseña una vista previa y solo se une al pulsar "Unirme".
- Compartir por **ID y PIN**: ID de 8 caracteres y PIN de 6 a 10 dígitos que elige el propietario (nadie puede volver a verlo), con límite de 5 fallos por persona y 20 por ID cada 15 minutos. Se usa en `/dashboard/join`.
- Lista de miembros (`/members`, solo nombre y rol, nunca email): el propietario cambia roles y expulsa; los demás pueden salir. El propietario no puede salir ni ser expulsado.
- Al juntar calendarios, la confirmación nombra a quien pierde el acceso y a quien pasa a ver eventos de otros calendarios.

Añadido por la spec 004 (`/dashboard/import`):

- Importar un `.ics` **una sola vez**, desde un enlace (`https://` o `webcal://`) o un archivo, y crear un calendario **nuevo** del usuario, editable y compartible. No se guarda el enlace ni el archivo y no se vuelve a sincronizar.
- Cada repetición de un evento repetido se crea como evento suelto (la app no tiene recurrentes propios): las series sin fin llegan hasta 1 año desde el día de la importación, y se respetan `EXDATE` y las repeticiones modificadas (`RECURRENCE-ID`). Los eventos cancelados no se importan.
- Límite de **2 MB y 2.000 eventos**. Los eventos con zona horaria no reconocida (típicamente los nombres de Windows de Outlook) o con fin anterior al inicio se omiten y se cuentan en el resumen.

Añadido por la spec 005:

- **Identidad visual propia** (constitución P9): fondo piedra, paneles papel, tinta casi negra, Inter Tight, botones negros redondos e iconos SVG propios. Una guardia de diseño (`tests/unit/design-tokens.test.ts`) impide volver a colores sueltos, `bg-white`, monoespaciada, degradados, sombras en reposo o emojis.
- **Color de acento** a elegir en **Ajustes** (`/dashboard/settings`) entre rojo (por defecto), azul, verde, amarillo, morado y gris. Se guarda en `profiles.accent` y se ve igual en todos los dispositivos; sin sesión, rojo. Solo marca hoy, la hora actual, los días de la semana, la vista elegida y el próximo evento.
- **Marco de la app** (`src/app/dashboard/layout.tsx`): barra lateral de iconos desde 1024 px; por debajo, barra inferior con Calendario, Mis calendarios, "+ Evento" y la hoja "Más" (Unirme, Importar, Ajustes, Cerrar sesión).
- **El calendario es la pantalla de inicio**: `/dashboard` redirige a `/dashboard/calendar` y la lista de calendarios pasa a `/dashboard/calendars` ("Mis calendarios").
- **Vista agenda** (por defecto): 14 días seguidos desde la fecha, con el número del día gigante, filas de evento (horas, barra de color, título, lugar), "Sin eventos", crear en cada día y la línea de la hora actual.
- **Panel del calendario**: tarjeta "Próximo evento" con cuenta atrás (siguiente evento con hora en 24 h), mini calendario mensual con puntos por calendario y filtros con avatares de iniciales.
- **Marca e iconos nuevos** ("CF" en piedra sobre tinta) y PWA en color piedra.

Añadido por la spec 006:

- **Recuperar contraseña** desde `/login` ("¿Olvidaste tu contraseña?" → `/forgot-password`): la respuesta es la misma exista o no la cuenta, con un límite de 3 enlaces cada 15 minutos por cuenta. El enlace del correo pasa por `/auth/confirm` y lleva a `/reset-password`; al guardar se cierran las demás sesiones.
- **Ajustes** (`/dashboard/settings`): perfil (nombre y zona horaria), cambio de email (pide la contraseña; queda pendiente hasta confirmar el enlace del email nuevo), cambio de contraseña (verifica la actual y cierra las demás sesiones) y borrar cuenta (email y contraseña).
- **Borrar la cuenta** borra los calendarios propios sin otros miembros. Los compartidos quedan **sin propietario** 15 días: sus miembros reciben un aviso en "Mis calendarios" y por correo, y deciden **Conservar** o **Salir**. Al decidir todos o vencer el plazo: con un solo conservador pasa a ser suyo; con varios, cada uno recibe una copia completa (con los autores originales); sin nadie, se borra. Mientras tanto aparecen en un grupo **"Sin propietario"** de los filtros y de "Mis calendarios", con los permisos de cada miembro sin cambios.
- **Autor del evento**: el detalle muestra "Creado por <nombre>", "Cuenta borrada" si el autor ya no existe y "un antiguo miembro" si salió del calendario.
- **Correo**: Brevo (plan gratuito, 300 al día). Auth envía recuperación y cambio de email por SMTP; los avisos de cuenta salen de Postgres con `pg_net` a la API de Brevo, con la clave en Vault.

Añadido por la spec 008 (comportamiento estudiado en Google Calendar con REA; análisis en `specs/008-mejoras-de-experiencia/analisis-google-calendar.md`):

- **Ventana de evento sobre el calendario** (rutas interceptadas `@modal`): "+ Evento", "Nuevo evento", "Crear" de la agenda y la tecla N abren el alta; pulsar un evento abre su detalle con **Editar**, **Duplicar** y **Borrar**. Botón de pantalla completa (siempre a pantalla completa a ≤ 768 px), Escape y "Cerrar" vuelven atrás, y si hay cambios sin guardar se pide confirmación. Guardar o borrar cierra la ventana en la misma vista y fecha. Una recarga o un enlace a `/dashboard/events/...` muestran la página completa.
- **Ventana rápida junto al hueco**: pulsar un día vacío del **mes** crea un evento de **día completo** (con "Añadir hora"); pulsar una franja de **semana o día** propone esa media hora y 1 h; **arrastrar con el ratón** dibuja el intervalo en pasos de 15 min (Escape cancela; con el dedo no se arrastra, un toque es un clic). Lleva título, día, horas y calendario (con su color), "Guardar" y "Más opciones" (pasa lo escrito al formulario completo). En el móvil es una hoja inferior. Mientras está abierta, el hueco se marca con un bloque discontinuo con el título que se escribe.
- **Horas con lista** (`TimeField`): de 00:00 a 23:30 cada 30 min, se pueden escribir a mano; la de fin empieza en la de inicio, muestra la duración ("11:00 (1 h)") y se mueve con el inicio hasta que se toca a mano, sin pasar de las 23:59.
- **Atajos**: N (nuevo), T (hoy), ← → (periodo), A, M, S, D (vistas; desde la 042 también Y año y X 4 días); nunca con modificadores, escribiendo o con una ventana abierta. Los botones de vista muestran su tecla.
- **Vista recordada** en `profiles.last_view`: `/dashboard/calendar` sin `?view` abre la última vista con la fecha de hoy.
- **Mes al estilo Google**: eventos con hora como punto + hora + título; de día completo o varios días como barra rellena del color pastel (enmienda de P9). **Rejilla** de semana y día a toda la altura de la pantalla.
- **Agenda**: botón fijo "Hora actual". **Avisos** breves ("Evento creado", "Cambios guardados", "Evento borrado"), **esqueleto** con la forma de la vista mientras carga y **actualización** al volver a la app tras más de 60 s.

**No hay** actualización de lo importado (la añade como opción la spec 044).

Añadido por la spec 007 (en producción desde el 2026-10-28). Hasta la 009 la aplicación de Google estuvo en "Prueba" (Enmienda 2); desde el 2026-10-29 está **publicada sin verificar**: conecta cualquier cuenta pasando por el aviso de "aplicación no verificada", con un tope de 100 usuarios, y la autorización ya no caduca a los 7 días:

- **Cuentas conectadas** (`/dashboard/connections`, en "Más" y en "Mis calendarios"): lista de cuentas con su estado; "Conectar Google" pasa por un aviso previo (`/new`, explica la pantalla de "app no verificada") y luego por el OAuth. Hasta 5 cuentas.
- **Ficha de la cuenta** (`/dashboard/connections/[id]`): elegir hasta 20 calendarios con casillas (al desmarcar uno se pide conservarlo o borrarlo), estado de cada calendario traído (última actualización correcta, último resumen, fallo o "ya no existe en la cuenta"), **Actualizar ahora** (como mucho cada 5 minutos) y **Desconectar** (revoca el permiso en Google y pide conservar o borrar sus calendarios, nombrando los compartidos).
- **Actualización automática** (cada hora hasta la 020; hoy cada 15 minutos o en cuanto avisa Google): `pg_cron` llama a `/api/sync/run`, que reconcilia los eventos desde 6 meses atrás hasta 12 meses adelante.
- **Solo lectura en la interfaz** (hasta la 009; hoy solo para las cuentas sin permiso de escritura y los calendarios que Google solo deja leer): los calendarios traídos no se ofrecen como destino al crear, editar o duplicar; el detalle de sus eventos no tiene botones y explica que vienen de Google; no se pueden juntar. En "Mis calendarios" todos los miembros ven la última actualización y solo el propietario la cuenta de origen.
- **Avisos** en "Mis calendarios": Google retiró el permiso (`sync_revoked`, con "Volver a conectar") y 3 fallos seguidos (`sync_failing`).
- **Grupos de calendarios** en "Mis calendarios" y en los filtros: crear, renombrar, borrar (los calendarios se quedan), meter cada calendario en un grupo con su selector, subir y bajar, y ocultar o mostrar todos sus calendarios a la vez ("parcialmente visible" si hay de los dos). Son privados de cada usuario y valen para cualquier calendario, también los sin propietario. El orden de los calendarios dentro de un grupo solo se cambia desde los filtros.

Añadido por la spec 009 (en producción desde el 2026-10-29):

- **Escritura en Google**: crear, cambiar, mover (solo entre calendarios de la misma cuenta) y borrar eventos de los calendarios traídos, por el propietario y los Editores, con la cuenta de Google del propietario. Primero se escribe en Google y, si lo acepta, en CaFam; si Google lo rechaza no se guarda nada (sin cola de cambios). Un `PATCH` solo envía lo que cambió. Las repeticiones se tocan una a una; nunca se envían series, invitados, color ni categoría.
- **Permisos**: conectar pide además `calendar.events` y `calendar.calendars`. `calendar_connections.can_write` dice si se concedieron; si no, la cuenta es de solo lectura y hay un aviso con "Volver a conectar" (`reconnect-notice`) en la ficha y en "Mis calendarios". Los calendarios que Google solo deja leer (`google_access = reader`) salen como "Solo lectura en Google".
- **Calendarios**: renombrar un calendario traído lo renombra en Google; en la ficha de la cuenta se crea un calendario nuevo en Google; "Subir a Google" (`/dashboard/calendars/[id]/upload`, solo propietario de un calendario normal) crea el calendario en Google con los eventos de la ventana de sincronización (hasta 2.000) y lo convierte en traído. Si algo falla a medias, se borra en Google lo que se acababa de crear: es el único caso en que CaFam borra un calendario en Google.
- **Política de privacidad** pública en `/privacy`, enlazada desde la portada y el aviso previo a conectar.



Añadido por la spec 011 (en producción desde el 2026-10-30):

- **Tema** claro, oscuro o "Como el sistema" (por defecto) en Ajustes, guardado en `profiles.theme` y en la cookie `cafam-theme` (la escriben `signIn` y `setTheme`; `signUp`, `signOut` y el proxy sin sesión la borran). Un script en `<head>` (`THEME_SCRIPT`, `lib/theme/theme.ts`) pinta `data-theme` antes del primer fotograma; sin sesión, la página sigue al sistema. Acceso directo (`ThemeToggle`) en la barra lateral y en la hoja "Más".
- **Cristal**: utilidades `glass` (barras, paneles del calendario y secciones de Ajustes) y `glass-float` (ventanas, hojas, diálogos y avisos), con respaldo opaco si no hay `backdrop-filter`. El contraste se calcula sobre el peor fondo (`lib/theme/contrast.ts`, `composite`).
- **Movimiento**: `press` en botones y controles; View Transitions de React (`<ViewTransition>`, `addTransitionType`) al cambiar de vista, periodo o filtro (`lib/calendar/transition-types.ts`); ventanas, hoja y avisos entran y salen con `@starting-style`. Todo con tokens `--motion-*` y versión reducida para `prefers-reduced-motion`.
- **El logotipo se invierte en oscuro** (piedra clara con letras en tinta); el icono de la PWA no cambia.

Añadido por la spec 012 (en producción desde el 2026-10-30):

- **Imágenes en los eventos**: "Añadir imágenes" en el detalle para **cualquier miembro, Lectores incluidos**, también en calendarios traídos de Google (las imágenes nunca se envían a Google), y en el alta completa (página y ventana). En el móvil ofrece cámara y galería.
- **En el dispositivo** cada imagen se reduce a 2048 px (y una miniatura de 400 px) y se recomprime a JPEG con canvas, lo que quita el EXIF y la ubicación. Se aceptan JPEG, PNG, WebP y HEIC/HEIF si el navegador los lee; más de 20 MB antes de reducir se rechaza. Se suben dos a la vez, con progreso, "Cancelar" y "Reintentar".
- **Límites**: 10 por evento, 300 por usuario y 800 MB en total (`images_total_limit()`), comprobados al reservar con el evento bloqueado.
- **Galería** en el detalle (miniaturas en orden de subida, `alt` "Título, imagen 2 de 5") y **visor** a pantalla completa (imagen con esquinas redondeadas y un marco fino de papel) con anterior/siguiente (botones, flechas, deslizar), autor y fecha, "Descargar" y "Borrar imagen" (quien la subió, propietario y Editores).
- **Icono** en las vistas para los eventos con imágenes (`imageCount` de `getEventsInRange`); en semana y día solo en bloques de 30 min o más.
- Borrar el evento, el calendario o la cuenta, o que la sincronización quite un evento traído, borra sus imágenes (por la cola de purga). Mover, juntar, copiar calendarios sin propietario y subir a Google las conservan; duplicar no las copia.

Añadido por la spec 016 (en producción desde el 2026-10-30, sin migraciones; comportamiento tomado de las capturas de Google Calendar en el iPhone):

- **Bloques rellenos** (`EventBlock`, formas `line`, `grid` y `card`): todos los eventos de todas las vistas son un bloque del color pastel con el texto en `pastel-ink` (4,5:1 con cada pastel) y el título en negrita. Sustituye a `EventChip` y `EventRow`, retirados.
- **Marco del móvil (≤ 768 px)**: cabecera `TopBar` en todas las pantallas del panel (menú ≡, título, "Hoy" con el número del día, avatar → Ajustes) y **sin barra inferior**. El menú abre `NavDrawer` (un `<dialog data-drawer>` desde la izquierda): en el calendario, las cuatro vistas y los filtros; después los destinos, el tema y cerrar sesión. Se cierra al elegir, en el fondo, con Escape o deslizando a la izquierda, y devuelve el foco al menú. En el calendario no hay barra de herramientas ni "Próximo evento", y hay un botón flotante "+" (`Fab`) si se puede crear. Entre 769 y 1023 px sigue la barra inferior, y desde 1024 px la lateral: el escritorio no cambia.
- **Título del calendario**: el mes visible con una flecha. En la vista mes despliega una fila de meses (`MonthStrip`, con el año entre diciembre y enero); en las demás, el mini calendario, que se pliega al elegir un día.
- **Deslizar** en mes, semana y día cambia de periodo (50 px, más horizontal que vertical, nunca con una ventana o el cajón abiertos), con la transición de la 011.
- **Mes** a toda la altura: iniciales L M X J V S D, hoy en círculo de acento, eventos en carriles de una línea (los de varios días cruzan la semana) y "+N" que lleva a la vista día.
- **Semana y día**: cabecera fija con inicial y número grande, franja de día completo, horas "9:00", bloques redondeados con título y lugar que parten el texto en varias líneas, y línea de ahora con un punto. Al abrir en hoy se desplaza a la hora actual.
- **Agenda continua en todas las anchuras**: bandas de mes con degradado (`bg-agenda-band`), separadores de semana ("2–8 de noviembre", "Sin eventos"), día a la izquierda y bloques "A las 11:15–14:15 en <lugar>". Carga tramos de 28 días al llegar a un extremo con `loadAgendaEvents` (como mucho 120 días en memoria, sin saltos al cargar hacia arriba), el título de la cabecera sigue el mes visible y "Hoy" (botón, cabecera o T) vuelve a hoy sin recargar si puede.

Añadido por la spec 013 (en producción desde el 2026-10-31):

- **"Repetir"** en el alta y la edición (`RepeatField`): "No se repite", opciones rápidas calculadas con la fecha (cada día, semana, mes por día o por posición, último, año, laborables) y "Personalizado…" (`RecurrenceEditor`: cada N días, semanas, meses o años, días de la semana, fin Nunca, El <fecha> o Tras <n>, con resumen en español). El campo envía `repeat` (`none`, el tipo de opción rápida o `custom:<RRULE>`) y el servidor lo resuelve con la fecha. Deshabilitado en calendarios traídos de Google, con su motivo.
- **Una serie es una fila** de `events` con `recurrence`; sus repeticiones se expanden al leer (`getEventsInRange`, `getEvent`) con `ical.js`, a la hora de reloj de `recurrence_tz` (la zona del perfil de quien la creó). Una repetición sin fila propia tiene el id `<uuid de la serie>_<YYYYMMDDTHHMMSSZ>` (`occurrenceId`, `parseEventId`). Una **excepción** es una fila con `series_id` y `original_start`; si no difiere de la serie solo existe para guardar imágenes y se muestra como una repetición normal.
- **Marcas**: icono de repetición con "Se repite" para lectores de pantalla donde cabe (las mismas reglas que el de imágenes, prop `icons` de `EventBlock`); el detalle muestra "Se repite" con el resumen y "Cambiado solo en este evento".
- **Alcance** al guardar o borrar una repetición (`SeriesScopeDialog`, dentro del formulario): "Solo este evento", "Este y los siguientes" y "Todos los eventos". Sin "Solo este evento" si cambió el calendario; deshabilitado a las 100 excepciones. Si se pierden cambios o imágenes, pide confirmar ("Se perderán 2 cambios y 3 imágenes." → "Guardar igualmente" / "Borrar igualmente").
- **Convertir**: un suelto pasa a serie eligiendo una regla (con imágenes, el original queda como primera repetición de una serie nueva); "No se repite" con "Todos los eventos" deja solo la primera repetición.
- **Imágenes en una repetición**: la primera imagen crea su fila (excepción idéntica) con `materialize_occurrence`; cada repetición tiene las suyas.
- **Duplicar** una repetición crea un evento suelto en su fecha. Juntar, copiar calendarios sin propietario y subir a Google conservan o convierten las series (subir: cada repetición de la ventana como evento suelto, con aviso).
- Límites: 500 series por calendario y 100 excepciones (contando las fechas borradas) por serie.

Añadido por la spec 014 (en producción desde el 2026-11-01):

- **Sección "Comentarios"** al final del detalle (`EventComments` en `EventPanel`, ventana y página completa): cualquier miembro, Lectores incluidos y también en calendarios traídos (nunca se envían a Google), escribe con "Comentar" (Ctrl/⌘+Intro también). Se cargan **después** de abrir el detalle, con su esqueleto: los 50 más recientes en orden cronológico y "Ver anteriores".
- Cada comentario: avatar, nombre ("un antiguo miembro" o "Cuenta borrada" como el autor del evento), fecha relativa ("hace 5 min", "ayer a las 18:30") con la completa para lectores de pantalla, "(editado)" y texto plano con saltos de línea; solo los `https://` son enlaces (`linkify`, nunca HTML). De 1 a 1.000 caracteres sin los espacios de los extremos.
- **Permisos**: edita solo el autor; borran el autor y el propietario del calendario (en uno sin propietario, nadie borra lo ajeno). Un expulsado deja de verlos y los suyos se quedan.
- **Actualización**: con el detalle abierto y la pestaña visible se piden cada 20 s (y al volver a la pestaña) desde el comentario más antiguo cargado, así llegan también lo editado y lo borrado; los nuevos de otros se anuncian en una región `aria-live`.
- **Marcas**: icono de bocadillo con el número y "N comentarios" para lectores de pantalla en todas las vistas, con las reglas de cabida de las imágenes.
- **Repeticiones**: comentar una repetición sin fila la materializa (`materialize_occurrence`); cada repetición tiene los suyos. El aviso de pérdidas de la 013 los cuenta ("Se perderán 2 cambios, 3 imágenes y 4 comentarios.").
- Borrar el evento (también desde la sincronización) los borra; moverlo y juntar calendarios los conservan; las copias de calendarios sin propietario los copian; duplicar no los copia.

Añadido por la spec 017 (en producción desde el 2026-11-01):

- **Mover y redimensionar con el ratón** en semana y día (`DraggableEvent` y `use-event-drag.ts`): se levanta a los 4 px, se mueve en cuartos de hora conservando la duración, cambia de día, muestra las horas nuevas y se autodesplaza cerca del borde. El borde inferior cambia el fin (como mínimo 15 min; sin tirador si cruza la medianoche). Escape o soltar en el mismo sitio o fuera no guardan, y el clic que sigue a un arrastre no abre el evento. Solo en los eventos que se pueden escribir (`canWriteEvents`); en los demás el bloque es un enlace normal.
- **Franja de día completo** siempre visible en semana y día: soltar ahí un evento con hora lo pasa a día completo, y un día completo de un solo día soltado en la rejilla dura 1 h desde ese punto. En el **mes** se mueve de día conservando la hora y la duración.
- **Con el dedo**: mantener pulsado 500 ms levanta el evento (moverse antes desplaza o desliza; un segundo dedo cancela). Queda levantado con un tirador que cambia el fin hasta tocar en otro sitio. Sin menú del sistema.
- **Guardado** (`quick-actions.ts`: `quickChange`, `deleteForUndo`, `undoAction`, `pasteEvent`, `deleteFromDetail`): el evento se mueve en el acto y vuelve a su sitio con el motivo si falla. En calendarios traídos se escribe primero en Google (spec 009). En una **repetición** se pregunta el alcance de la 013 (`SeriesScopeChoice`); cancelar la devuelve a su sitio.
- **"Deshacer" en los avisos** durante 10 s tras mover, redimensionar, cambiar el color, borrar o pegar (en una repetición, solo con "Solo este evento"). Deshacer no pisa un evento que cambió entretanto. El borrado guarda una copia en `event_trash` (con imágenes y comentarios) y se puede restaurar durante 1 minuto; en un traído se vuelve a crear en Google. Borrar desde el detalle ya no pide confirmar: avisa con "Deshacer".
- **Menú contextual** (`EventMenu`, clic derecho, tecla Menú o Mayús+F10): los 13 colores de la paleta, "Color del calendario", Duplicar y Borrar, todo con el teclado.
- **Teclado sobre un evento enfocado** (`use-event-keys.ts`): Alt+flechas lo mueven 15 min o un día (guarda 600 ms después de la última tecla), Supr o Retroceso lo borran, Ctrl+C lo copia y Ctrl+V lo pega en el último hueco pulsado o en la fecha de la vista (portapapeles en `EventClipboardProvider`, dentro de `AppFrame`). Una repetición se pega como evento suelto.
- **Atajos nuevos**: E (editar el detalle abierto), G (`GoToDateDialog`, ir a una fecha) y ? (`ShortcutsHelp`, sale de la tabla `SHORTCUTS` de `shortcuts.ts`). En el detalle, E, Supr y Ctrl+C.
- **Detalle en hoja inferior en el móvil** (`EventModal variant="sheet"`, solo el detalle interceptado a ≤ 768 px): abre a media altura, el asa (o deslizar 60 px o a 0,5 px/ms, `sheet.ts`) amplía, reduce o cierra, tocar el fondo cierra, y "Editar" o E la amplían.
- **Pellizcar o Ctrl + rueda** cambian la altura de las horas en semana y día (24–144 px, `zoom.ts` y `use-grid-zoom.ts`), con la hora bajo el gesto fija; se recuerda en el dispositivo (`localStorage` `cafam-hour-px`).

Añadido por la spec 018 (en producción desde el 2026-11-01):

- **Conectar iCloud** (`/dashboard/connections/new?provider=icloud`, botón "Conectar iCloud" junto a "Conectar Google"): aviso con los pasos para crear una contraseña específica de app en account.apple.com (hace falta la verificación en dos pasos) y lo que abre esa contraseña, y formulario con Apple ID y contraseña. `connectIcloud` normaliza (Apple ID en minúsculas, contraseña `abcd-efgh-ijkl-mnop`), la comprueba con un descubrimiento CalDAV real en 10 s (`verifyIcloudCredential`) y la guarda con `connect_account('icloud', …)`: en Vault va el JSON `{"v":1,"username","password"}` en lugar del token de Google, y `can_write` siempre es `true`. La contraseña nunca vuelve al navegador. Cuenta en el límite de 5 cuentas junto a las de Google.
- **Proveedores** (`lib/sync/providers/`): `types.ts` define `ProviderSession` (listar calendarios y eventos, crear, cambiar, mover y borrar eventos, crear, renombrar y borrar calendarios); `index.ts` abre la sesión de cada conexión (`openSession`: Google renueva su token, iCloud lee la credencial) y `revokeAccess` (iCloud no revoca nada: se hace en Apple). El motor, la escritura, la subida y la creación de calendarios ya no saben qué proveedor hay detrás.
- **iCloud por CalDAV** (`providers/icloud.ts`, único que importa `tsdav`): un `fetch` propio (`icloudFetch`) que solo habla con `caldav.icloud.com` y `pNN-caldav.icloud.com` por https, sigue las redirecciones a mano dentro de ellos, manda la autenticación Basic solo ahí y convierte las respuestas en `ProviderError` (`401` → `revoked`, `404`/`410` → `missing`, `429`/`5xx`/red/plazo → `transient`, el resto → `rejected`, con el estado en `IcloudHttpError`). Descubrimiento raíz → principal → `calendar-home-set`; los calendarios sin `VEVENT` (Recordatorios) no se ofrecen; el permiso sale de `current-user-privilege-set` (`owner`, `writer` si es compartido con escritura, `reader`) y se guarda en `google_access`.
- **`.ics` de iCloud** (`lib/sync/icloud-ics.ts`, con `ical.js`): `expandObject` expande cada recurso en la ventana con `EXDATE`, repeticiones cambiadas y canceladas; un suelto se identifica por su `href` y una repetición por `href#<RECURRENCE-ID>` (`20261102T080000Z` o `20261015`). Al escribir, `patchIcs` cambia solo los campos que cambiaron y conserva alarmas, invitados, adjuntos y lo desconocido; una repetición se cambia en su propio `VEVENT` con `RECURRENCE-ID` y se borra con `EXDATE` (`removeOccurrence`), escritos como el `DTSTART` de la serie (misma `TZID`), como el iPhone. Cambiar lee el recurso y lo reescribe con `If-Match`; un `412` vuelve a leer una vez. Mover usa `MOVE` y, si iCloud no lo deja (403/405/501/502), copia y borra; una repetición no se mueve sola.
- **Textos con el proveedor** (`lib/sync/provider-labels.ts`): errores de escritura (`writeErrorText`), del motor (`syncErrorText`), solo lectura, "Traído de iCloud", "Solo lectura en iCloud", la ficha de la cuenta ("Cuenta conectada"), crear calendario, desconectar (en iCloud recuerda revocar la contraseña en account.apple.com y que allí no se borra nada), la subida (elige cuenta de Google o iCloud) y el aviso de evento borrado (`done: "goneIcloud"`). El aviso `sync_revoked` de iCloud explica que cambiar la contraseña del Apple ID invalida las específicas de app y enlaza a `new?provider=icloud&reconnect=<id>` (`getNotices` busca la conexión por el correo). "Repetir" sigue deshabilitado en los calendarios traídos de los dos.
- **Privacidad**: sección "Calendarios de iCloud" en `/privacy`.

Añadido por la spec 015 (proveedor **Groq**, capa gratuita; elegido en el plan D1):

- **Pantalla "Asistente"** (`/dashboard/assistant`, en `NAV_ITEMS`: barra lateral, hoja "Más" y cajón): frase de privacidad con enlace a `/privacy` y tres ejemplos en la conversación vacía, hilo en `role="log"`, "Pensando…" con "Cancelar" (aborta y devuelve la pregunta al campo), error con "Reintentar", "Nueva conversación" y lista de eventos citados que abren su detalle (`AssistantChat`, `CitedEvents`). Intro envía y Mayús+Intro salta de línea. La conversación vive solo en el componente: no se guarda en ningún sitio.
- **Botón flotante "Asistente"** (`AssistantFab` en `AppFrame`, T16): redondo y de cristal (`glass-float`) en todas las pantallas del panel salvo la del asistente; en el móvil, encima del "+" (el `Fab` marca el marco con `data-has-fab` en un efecto, porque Activity deja el calendario oculto en el DOM y `:has()` lo vería), entre 769 y 1023 px encima de la barra inferior y desde 1024 px en la esquina. Los avisos suben a `bottom-40` cuando hace falta.
- **`POST /api/assistant`** (`maxDuration` 30): valida el hilo (`assistantRequestSchema`, preguntas de 1 a 500 caracteres, últimos 20 mensajes), cuenta las preguntas del día en la zona del perfil (30, tabla `assistant_questions`; 429 con `QUOTA_TEXT`), ejecuta `runAssistant` y responde `{answer, events, remaining}`. 503 si falla el proveedor, 499 si se cancela; solo cuenta las respondidas.
- **Bucle** (`lib/assistant/run.ts`): prompt con la fecha, los 14 días siguientes con su día de la semana, esta semana, la que viene y el fin de semana (`dateContext`); hasta 3 rondas de herramientas y luego respuesta obligada. Las herramientas (`list_events`, `search_events`, `find_free_time` y `get_comments`, solo lectura) se atan en la ruta a la sesión del usuario: el hilo no puede cambiar quién consulta (RF-29). El modelo cita eventos con referencias `[e1]` (`createRefs`, `extractCitations`), nunca con ids; las inventadas se descartan. El `notice` de una herramienta (persona sin permiso) lo añade el servidor si el modelo lo omite. En la ronda final se añade el mensaje de sistema `FINAL_ROUND` (sin herramientas), y cada evento lleva `source` ("Google" o "iCloud") si es traído.
- **Comentarios** (T14–T15): los eventos llevan `comments` (número) si tienen; `get_comments` recibe hasta 10 referencias y devuelve los 5 más recientes de cada uno (300 caracteres, con autor, fecha y hora; usa `listComments` de la 014, así que respeta RLS y resuelve repeticiones). `search_events` también busca en `event_comments.body` y devuelve `matchedComment`. Los comentarios de quien pregunta llevan `byUser: true`, porque el prompt no tiene su nombre y el modelo le hablaba de sí mismo en tercera persona. El prompt trata "¿iré a…?" o "¿qué se dijo de…?" como preguntas del calendario y el texto de los comentarios como datos, nunca instrucciones (RF-38).
- **Proveedor** (`lib/assistant/provider.ts`, único que lee `GROQ_API_KEY`): `fetch` a la API compatible con OpenAI de Groq, plazo de 8 s, `openai/gpt-oss-120b` y, si responde 429, una vez `qwen/qwen3.8-27b` (`ASSISTANT_MODELS`). Groq no entrena con los datos y la retención cero está activada en su consola (`PROVIDER_TRAINS_ON_DATA = false`; si fuera `true`, se excluirían los calendarios traídos, RF-31).
- **Disponibilidad**: `find_free_time` calcula los huecos en TypeScript (`freeSlots`, franjas por defecto mañana 08–14, tarde 16–21 y noche 21–24, o las pedidas; como mucho 31 días). De otras personas solo usa sus eventos privados si activaron en Ajustes "Permitir que el asistente de otros consulte mi disponibilidad" (`profiles.share_availability`, desactivado por defecto; `AvailabilitySetting` y `setShareAvailability`), y solo como libre u ocupado (`assistant_busy`). Las personas se buscan por nombre (`matchPerson`: ambigua o no encontrada).
- **Calidad**: `npm run eval:assistant` siembra un usuario `@cafam.test` en dev, hace 39 preguntas a Groq de verdad (4 de comentarios, con la serie "EOI Inglés") (`tests/assistant-eval/questions.ts`) y exige el 90 % de aciertos, ningún evento inventado ni revelado y el 90 % por debajo de 10 s. Tarda unos 9 minutos por la pausa entre preguntas (8K tokens por minuto). No corre en `npm test` ni en `test:db`. `EVAL_ONLY=36-39` hace solo esas preguntas (numeradas desde 1), para comprobar un cambio del prompt sin gastar una ejecución entera.
- **Privacidad**: sección "Asistente de chat" en `/privacy`.

Añadido por la spec 019 (migraciones aplicadas en prod el 2026-11-02):

- **Tarjeta de detalle** (`EventCard`, desde 769 px): un clic izquierdo sin modificadores en un evento abre junto a él un `<dialog open>` **no modal** (`placeCard` en `popover.ts`: derecha, izquierda, debajo o encima, dentro de la pantalla) con lo que ya tiene la vista y, al llegar, descripción, autor, repetición y motivo de solo lectura (`loadEventCard`, `events/card-actions.ts`). Editar (`/dashboard/events/<id>?edit=1`, que abre el detalle ya en edición), Duplicar, Borrar (con "Deshacer") y Abrir. Se cierra con Escape, "Cerrar", un clic fuera o al estrechar la ventana, y devuelve el foco al evento; E, Supr y Ctrl+C como en el detalle. Con Ctrl/⌘/Mayús o en el móvil el bloque sigue siendo un enlace. La abre `openCard` de `useEventInteractions()`.
- **Barra lateral plegable** (desde 1024 px): botón ≡ "Plegar el panel" en `ViewToolbar`; plegada, la columna del panel (`calendar-side-panel`) desaparece y junto al título hay una flecha "Elegir fecha" con el mini calendario flotante. Se recuerda en el dispositivo (`localStorage` `cafam-sidebar`, `use-sidebar-collapsed.ts`).
- **Ajustes → Calendario**: "Mostrar fines de semana" (`profiles.show_weekends`) y "Duración de un evento nuevo" (`profiles.default_event_minutes`: 15, 30, 45, 60, 90 o 120; `view-options.ts`). Sin fines de semana, semana y mes van de lunes a viernes (`visibleDays`) y hay un acceso "Mostrar fines de semana" (`WeekendToggle`) en la barra de vista y en el cajón; día, agenda y mini calendario no cambian. La duración se usa al pulsar un hueco (`clickRange`), en "+", N y C (`parseNewEventQuery`).
- **Tecla C** crea un evento, como N (`SHORTCUTS`).
- **Bloque provisional en el móvil**: con la hoja de `QuickCreate` abierta en semana o día, el bloque se mueve con el dedo y se estira desde su tirador en cuartos de hora (`draft-drag.ts`, `DraftBlock` en `time-grid.tsx`), y las horas de la hoja y el bloque van a la par. En el móvil la hoja se abre **sin modal** (`show()`) para que la rejilla siga usable, y la rejilla se desplaza para dejar el bloque por encima.
- **Tiempo real**: cuando cambia un evento, un calendario o sus miembros, Postgres manda un mensaje privado `changed` con `{actor}` (sin datos del evento) al tema `user:<id>` de cada miembro (`live_notify`, un mensaje por usuario y transacción). `useLiveCalendar` (en el workspace) escucha solo con la pestaña visible, ignora los cambios propios, junta los mensajes 400 ms y hace `router.refresh()`; refresca también al reconectar. Mientras el usuario arrastra, crea o edita, el refresco espera (`holdLive`/`useHoldLive`, `live-hold.ts`). Si el evento abierto desaparece por un cambio ajeno, se avisa "Otra persona ha borrado este evento". Una región `aria-live` dice "Calendario actualizado a las HH:MM:SS". Medido en dev: percentil 95 de 985 ms.

Añadido por la spec 020 (en producción desde el 2026-11-09; migraciones `busy_grid` y `sync_fast`):

- **Disponibilidad en el calendario**: en Ajustes, sección "Disponibilidad", "Mostrar a los demás cuándo estoy ocupado en su calendario" (`profiles.share_busy`, desactivada por defecto y **separada** de `share_availability` del asistente; `BusySetting`, `setShareBusy`). En los filtros, sección "Disponibilidad" (`AvailabilityFilter`) con las personas que comparten calendario y consienten (`busy_people()`), todas desmarcadas; se marcan como mucho 8 y se guarda en `person_preferences.show_busy` (`setShowBusy`).
- **Bloques "Ocupado"** (`BusyBlock`, `busy-block.tsx`) solo en semana y día: rayados (`bg-busy-hatch`) con el borde del color del avatar, "Ocupado · <nombre>" y las horas; los de día completo en la franja de arriba. Pulsar abre una nota con el nombre y las horas, sin enlace; no se mueven, copian, borran ni tienen menú. La página lee `grid_busy(p_from, p_to)` (`getBusyIntervals` en `lib/availability/queries.ts`, que expande las series con `expandRows`) y el navegador quita los que coinciden exactamente con un evento visible y junta los que se solapan o tocan (`busyBlocks`, `lib/availability/busy.ts`), porque los filtros deciden qué se ve (plan D3).
- **Sincronización rápida**: el cron `sync-run-due` corre **cada minuto** (solo llama a la app si hay trabajo). Un calendario toca cada 15 minutos o, si Google avisó, 1 minuto después del último intento (los que fallan esperan los 15). Antes de leer se pide la **versión** (`calendarVersion`: Google `events?maxResults=1&fields=updated`, iCloud `getctag`); si no cambió, no hay aviso y la última lectura completa tiene menos de 6 h, solo se llama a `sync_mark_checked` (cuenta como actualización correcta). "Actualizar ahora" no trae versión y siempre lee todo.
- **Avisos de Google**: `syncOne` crea o renueva (a menos de 24 h de caducar, TTL de 7 días) un canal por calendario con `watchCalendar` si hay `SYNC_PUSH_URL`; el token se guarda solo como SHA-256 (`sync_channels`). `POST /api/sync/google-push` lee las cabeceras (`pushHeaders`), llama a `sync_push` y responde siempre `200` vacío. Borrar un canal (dejar de traer, desconectar, borrar el calendario, reconectar o sustituirlo) lo encola en `sync_channel_stops` por trigger, y `runDue` lo cancela con `stopChannel`.

Añadido por la spec 021 (cerrada el 2026-11-08; sin migraciones ni dependencias):

- **Tokens de movimiento** en `globals.css`: `--ease-out` (entrar y salir) y `--ease-in-out` (moverse), duraciones `--motion-*-in`/`-out` (la salida es el 80 % de la entrada), `--motion-move` 300 ms, `--motion-pulse`, `--motion-reveal`, `--pulse-scale` 1,04, `--pop-scale` 0,95 y `--motion-distance`. Con `prefers-reduced-motion` se quedan en fundidos cortos y sin escala, arco ni goma. En JavaScript se leen con `motionMs()` y `motionToken()` (`EASE_OUT` y `EASE_IN_OUT` son los respaldos).
- **Utilidades** (`@utility`): `press` y `press-quiet` (pulsar al 97 %), `pop` (desplegable desde `--pop-origin`, al cerrar `data-leaving`), `stagger` (filas 2 a 8 con 30 ms, solo bajo `data-entering`), `row-in`, `settle` (detalle 50 ms después), `swap` y `reveal-down`. Los `<dialog>` entran desde el 95 %; `[data-sheet]` desde abajo y `[data-drawer]` desde la izquierda.
- **Componentes**: `Switch` (`ui/switch.tsx`, `role="switch"` con bolita que se estira), `SwapLabel` (el texto pendiente de un botón no cambia su tamaño), `IconSwap`, `CrossfadeText` y `StaggerList`; el selector de vista desliza una píldora que recorta el color del texto, y el tema se revela con un círculo desde el botón (View Transitions).
- **`lib/motion/`**: `play.ts` (`play` con WAAPI, que fija y cancela lo que corre antes y devuelve `null` sin `animate` o con movimiento reducido; `pulse`), `origin.ts` (`originFrom`), `marks.ts` (`markPulse`, `captureReturn`, `takeMark`: lo que deja un cambio para el bloque que se pinte después), `flight.ts` (arco de regreso), `morph.ts` (bloque → tarjeta, hoja o ventana con `translate` y `clip-path`), `release.ts` (`releaseDecision`, `lockAxis`, `trackVelocity`) y `rubber-band.ts` (`rubberBand`, `banded`, 64 px como mucho).
- **Hooks**: `use-presence.ts` (desmontar tras la salida), `use-enter-once.ts`, `use-pulse-on.ts` (un pulso por resultado) y `use-follow-drag.ts` (seguir al dedo en horizontal: la vista del calendario, el cajón y el visor de imágenes). `use-swipe.ts` y `lib/calendar/swipe.ts` se borraron.
- **Goma** en la hoja de detalle, el pellizco de las horas (24–144 px, vuelve con `scale`) y el borde de un evento por debajo de 15 min.

Añadido por la spec 022 (cerrada el 2026-11-09; sin migraciones ni dependencias):

- **Adjuntar imágenes** en `/dashboard/assistant` (`ImageAttach`, `image-attach.tsx`): "Adjuntar imagen" (`image/*`, `multiple`, sin `capture`: el móvil ofrece cámara y galería), pegar con Ctrl/⌘+V, miniaturas con "Quitar imagen", hasta 3 (`checkAttachments`, `lib/assistant/attachments.ts`) y nota con enlace a `/privacy`. `prepareForAssistant` (`lib/images/prepare-image.ts`) las reduce a 1600 px JPEG 0,8 (1280 px si pasan de 1,2 MB) y las manda como `data:` URL. **No se guardan en ningún sitio**: viajan en la petición y se olvidan.
- **Petición** (`assistantRequestSchema`): solo el último mensaje lleva `images`; una corrección manda `proposal` (las filas como las dejó el usuario). Si la respuesta a un mensaje con imágenes es una pregunta ("¿de qué semana es?"), el navegador vuelve a adjuntar las mismas imágenes al siguiente mensaje (plan D2). La ruta tiene `maxDuration` 60 y un mensaje con imágenes cuenta como una pregunta de las 30.
- **Modelo**: con imágenes, `visionChat` (`qwen/qwen3.8-27b`, `VISION_MODEL`, 20 s, sin reserva ni herramientas; ante un 429 que pide esperar 35 s o menos, espera y reintenta una vez) con `response_format: json_object` y el prompt corto `proposalPrompt`; las correcciones sin imagen usan `jsonChat` con `ASSISTANT_MODELS`. Las herramientas con imágenes fallaban en Groq (T1).
- **Propuesta** (`lib/assistant/proposal.ts`, `buildProposal`): valida el JSON con zod, elige el calendario por nombre entre los escribibles (o pregunta), turno de noche al día siguiente, sin horas = día completo, título "Trabajo" por defecto, ordena, quita repetidas, pide un recorte si el modelo dice que el cuadrante tiene más de 10 personas (`people`, `PROPOSAL_TEXTS.cropNeeded`: con 20 confundía las filas), corta en 50 y marca **duplicados** con `getEventsInRange` (también repeticiones de series; `markDuplicates`, `duplicates.ts`). `runProposal` (`run.ts`) la monta; nunca escribe.
- **Tarjeta** (`ProposalCard`, `proposal-card.tsx`): filas editables (casilla, título, fechas, horas con `TimeField`, "Todo el día" y calendario), duplicado sin seleccionar, error por fila (`rowError`, `proposal-rows.ts`), `checkProposal` 500 ms después de editar, "Crear N eventos" con bloqueo de doble pulsación, enlaces a lo creado, filas fallidas para reintentar y estados "Sustituida" y "Creada". Las filas viven en el mensaje del chat (`ChatProposal`).
- **Crear** (`app/dashboard/assistant/actions.ts`: `checkProposal`, `createProposedEvents`; lógica en `proposal-writes.ts`): valida con `proposalSchema`, usa la zona del perfil y crea fila a fila con `createSingle` (`event-writes.ts`, extraída de `pasteEvent`): en un traído, primero el proveedor. Un fallo deja las demás.
- **Calidad**: `npm run eval:schedule` manda los 12 horarios sintéticos de `tests/fixtures/schedules/` (`cases.ts`, imágenes generadas con `scripts/make-schedules.mjs`) al modelo de verdad, con 60 s entre casos y `EVAL_ONLY`; exige el 90 % de filas bien y el 90 % en 20 s o menos. Sin base de datos; gasta cuota de Groq.
- **Privacidad**: sección "Imágenes en el asistente" en `/privacy`.

Añadido por la spec 023 (cerrada el 2026-11-12; migraciones `restore_event_guard`, `assistant_busy_scope` y `join_code_lock`, aplicadas solo en dev):

- **Seguridad en la base de datos**: `restore_event` da `CF404` si `p_event_id` no es de un evento del calendario de la copia (antes un Editor podía pisar cualquier evento de otro calendario). `assistant_busy` usa el filtro de `grid_busy` (calendarios propios de la persona y eventos que creó donde sigue siendo miembro): el consentimiento de una persona ya no expone el calendario de un tercero. `join_with_code` toma `pg_advisory_xact_lock` por ID y por usuario antes de contar fallos, así los intentos simultáneos no superan el límite.
- **Cabeceras** (`next.config.ts`, primera regla `/:path*`): `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin` y `X-Robots-Tag: noindex, nofollow`. Las reglas posteriores de `/invite/*` (`no-referrer`) y `/sw.js` ganan porque en Next manda la última que coincide. `next-config-headers.test.ts` lo comprueba.
- **`hasCronSecret(request)`** (`lib/auth/cron-secret.ts`): compara los SHA-256 con `timingSafeEqual`; lo usan `keep-alive`, `sync/run` e `images/purge`. Una ruta nueva con `CRON_SECRET` debe usarlo.
- **Series**: mover una repetición de fecha con "Todos" o "Este y los siguientes" desplaza también la regla (`shiftRule` en `lib/recurrence/rule.ts`: días de la semana, día del mes, posición o mes), y el inicio de "Todos" se calcula en hora de reloj de la zona de la serie, así un cambio en invierno de una serie que empezó en verano no la corre una hora.
- **Arrastre**: al mover de día sin cambiar la hora, el tope es 23:59 (antes 23:45 recortaba los eventos de última hora); Alt+↓ que no cabe en el día no mueve nada.
- **Convertir en serie** un evento con comentarios sigue el camino de las imágenes (el original queda como primera repetición) y los conserva.
- **`getEventsInRange`** pagina sus tres consultas de 1.000 en 1.000 (`allRows`, orden estable con `id`, como mucho 20 páginas).
- **Lecturas en paralelo** en `load-event.ts`, `card-actions.ts`, `agenda-actions.ts` y `listComments`.
- **Páginas de error** (`app/not-found.tsx`, `error.tsx`, `global-error.tsx`, con `ErrorScreen` de `components/ui/error-screen.tsx`): "No encontramos esta página" y "Algo ha fallado" con "Reintentar" (prop `retry` de Next 16.2) e "Ir al calendario". `global-error` lleva su `<html lang="es">` e importa `globals.css`.
- **Teclado y lectores de pantalla**: enlace "Saltar al contenido" en `AppFrame` (primer Tab, lleva a `#contenido`); "Seguir editando" recibe el foco en "¿Descartar los cambios?"; botón "Cerrar" en el cajón; la tecla de la vista elegida en `text-on-accent` sin transparencia; prop `hint` de `TextField` ("Mínimo 8 caracteres" en registro, cambio y recuperación de contraseña, enlazada con `aria-describedby`).
- **Ctrl/⌘+Z** deshace mientras un aviso ofrece "Deshacer" (en `ToastProvider`, nunca escribiendo en un campo; fila en la ayuda de atajos). Enmienda 9 de la constitución.
- **Pantallas secundarias**: el `h1` pasa a `max-tab:sr-only` donde la cabecera del móvil ya muestra el mismo título (`PageShell` lo decide comparando con `NAV_ITEMS`); radios en tinta del tamaño de las casillas; botones de Ajustes con su ancho; títulos de sección en `font-semibold`; avatares en la lista de miembros; etiquetas en `text-muted`; tarjetas de lista `rounded-3xl p-4`; `ChevronIcon` admite `up` y `down` y sustituye a los glifos ↑ ↓ ←, y `CloseIcon` a ×; contorno único `ring-pastel-ink/20` para el punto de color de un calendario en las listas.
- **Diferido** (ver la tabla de la spec 023): lo más importante es que la sincronización borra los eventos creados en CaFam fuera de la ventana de 12 meses; también `events.created_by` elegido por el cliente, la carrera en la cuota del asistente, la CSP completa y el timeout de los helpers de `test:db`.

Añadido por la spec 024 (rendimiento; sin migraciones):

- **El calendario cambia de periodo en el navegador.** `page.tsx` lee una vez una **ventana ancha** (`serverWindow`: de la primera semana del mes anterior a la última del siguiente) y `CalendarClient` (`components/calendar/calendar-client.tsx`) es dueño de `{view, date}`: `go()` cambia el estado y escribe la dirección con `window.history.pushState` (Next la integra en su router: `router.refresh()` usa la dirección nueva); `popstate` y las props nuevas del servidor lo vuelven a sincronizar. `useEventWindow` (`lib/hooks/use-event-window.ts`, lógica pura en `lib/calendar/event-window.ts`) lee con `loadCalendarWindow` lo que falta (al instante si el periodo no está cargado, en reposo el contiguo) y descarta respuestas viejas. Un refresco (tiempo real, foco, escritura) trae una ventana nueva que sustituye la del navegador.
- **`CalendarLink` y `useCalendarGo`** (`calendar-nav.tsx`): todo enlace o salto a una vista y fecha del calendario pasa por ahí. Dentro del calendario navega sin red; fuera, es un `Link` con `prefetch={false}`. Los enlaces de evento tampoco precargan (eran 85 peticiones por mes).
- Anterior, siguiente y deslizar pintan el periodo **sin View Transition** (retrasaba 60 ms) y con un deslizamiento corto de `transform`; cambiar de vista conserva la transición. La lista del periodo conserva su identidad entre precargas (`useStableList`, `memo` del workspace).
- La rejilla de horas lleva `touch-pan-y` (antes `touch-pan-x touch-pan-y` impedía deslizar sobre ella). Días de la agenda memorizados.
- Perfil del calendario en una consulta (`getCalendarProfile`), categorías sin cascada (`getMyCategories`): 12 consultas al cargar (antes 21–30). Los "Ocupado" se piden aparte (`loadBusy`) y solo con alguien marcado.
- El cliente de Supabase se importa con `import()` en `useLiveCalendar`; los esquemas zod de tema, acentos, opciones de vista y deshacer viven en módulos aparte (`lib/theme/schemas.ts`, `view-options-schema.ts`, `undo-schemas.ts`).
- **Asistente en streaming**: `POST /api/assistant` responde NDJSON (`lib/assistant/stream.ts`): líneas `status` con el paso real ("Buscando «dentista»…"), `done` con la respuesta o `error`. 400, 401 y 429 siguen siendo respuestas JSON previas al flujo; un fallo del proveedor llega como línea `error` (ya no 503) y cancelar termina el flujo (ya no 499). `GET /api/assistant` (204) precalienta la función. Las herramientas de una ronda van en paralelo.
- **Medición**: `scripts/perf/` (proxy con latencia, Groq simulado, `measure.mjs`, `paint.mjs`, resultados y README).

Añadido por las specs 025, 026 y 030 (identidad y marco; la 030 sustituye la identidad de la 025):

- **Identidad Nexo** (constitución, enmienda 11; ver §6 "Identidad visual"). Sin `backdrop-filter`: las utilidades son `surface` y `surface-float`.
- **Marco** (`components/shell/`): en el móvil (≤ 768 px), `TopBar` (marca, título o mes, tema y avatar), `BottomBar` (píldora flotante con Calendario, Notas, Calendarios y "Más") y dos botones flotantes a la derecha: `CreateButton` ("+", degradado) y encima `AssistantFab` (Venito). Desde 769 px, `TopNav` (marca, pestañas en píldora, "Nuevo evento"/"Nueva nota", tema y avatar); Venito flota en la esquina inferior derecha. No hay barra lateral ni cajón. `createHref` (`lib/shell/nav.ts`) decide qué crea "+".
- **Calendario en el móvil**: `CalendarHeading` (pestañas de vista, "Calendarios" y "Hoy ‹ ›", fija bajo la cabecera) y `CalendarSheet` (hoja inferior con los filtros, que el workspace monta con `createPortal` en `drawerSlot`; se abre con `openSheet` del contexto de la cabecera). Las vistas miden `h-calendar`. `NextEventCard` es la tarjeta de saludo con degradado: en el panel de escritorio y, en el móvil, sobre el primer día desde hoy de la agenda (`todayBanner`).
- **Componentes base** (`components/ui/`): `button-styles.ts` (primario con `bg-accent-gradient`, secundario, discreto, peligro), `IconButton`, `Card`, `Chip`/`ChipLink`, `Sheet` (`<dialog>` desde abajo en el móvil, centrado desde 769 px), `EmptyState` (con Venito por defecto).
- **Marca**: `LogoMark` y `public/icons/icon.svg` (ficha violeta con la "C" y el punto); `node scripts/make-icons.mjs` regenera los PNG; `CACHE_NAME` `cafam-v5`.

Añadido por la spec 027 (Venito y el chat; sin migraciones):

- **`Venito`** (`components/brand/venito.tsx`): un SVG con `mood` (`idle`, `wave`, `thinking`, `happy`, `confused`, `sleeping`), colores `walrus-line` y `walrus-body` propios, gestos en `globals.css` (`venito-*`, anulados con `prefers-reduced-motion`). Desde la 031 es una **morsa** de línea con gafas, colmillos y bigotes (enmienda 12); con `compact` (48 px o menos: botón flotante y chat) pierde los bigotes y engorda el trazo.
- **El chat es un panel del marco**: `AssistantFab` pinta el botón y un `<dialog>` modal con `AssistantChat` (cargado con `lazy()` y montado en reposo; su contexto se pide con `loadAssistantContext` al abrirlo). Ocupa la pantalla en el móvil (su alto sigue a `visualViewport` para que el teclado no tape el campo) y flota en la esquina desde 769 px. Se cierra con su botón, Escape, tocando fuera o arrastrando la cabecera hacia abajo. La conversación vive en memoria mientras la app esté abierta. `/dashboard/assistant` muestra el mismo chat a página completa.
- **Chat**: cabecera con Venito y su estado, burbujas con hora, "escribiendo…" con el paso real, barra de entrada con adjuntar y enviar, y **sugerencias** (`lib/assistant/suggestions.ts`): se envían, rellenan el campo o abren el selector de imagen. `ImageAttach` se partió en botón, `AttachNote` y `AttachPreview`.

Añadido por la spec 028 (Notas; migraciones `notes` y `notes_calendar_functions`, aplicadas solo en local):

- **Rutas**: `/dashboard/notes` (lista con buscador, filtros y tarjetas), `/dashboard/notes/new` y `/dashboard/notes/[id]`.
- **Modelo**: `notes` (`kind` `list|text`, título, cuerpo, color, `pinned`, `archived`, `due_date`, `owner_id`, `calendar_id`) y `note_items` (texto, `done`, `done_at`, `position`). Una nota sin calendario es **personal** (solo su autor); con calendario es **compartida**: la leen los miembros y la escriben Propietario y Editores (`can_read_note`, `can_write_note`). Permisos por columna: el cliente no escribe `owner_id`, fechas ni `done_at`. `CF429` con mensaje `notes` (500 por autor) o `items` (200 por lista).
- **Triggers**: `notes_rules`, `note_items_rules`, `note_items_touch` (un cambio en un elemento actualiza la nota), `live_notes_changed` (`live_notify(calendar_id, owner_id)`), `notes_member_left` (al salir del calendario sus notas de allí quedan sin autor) y `notes_profile_deleted` (borra las personales antes del perfil). `merge_calendars` mueve las notas y `copy_calendar_for_owner` las copia.
- **Código**: `lib/notes/` (puro: `order`, `search`, `progress`, `permissions`, `schemas`, `error-messages`; `queries.ts`), `app/dashboard/notes/actions.ts` (una escritura por acción; los elementos no revalidan) y `components/notes/` (`NotesBoard`, `NoteCard`, `NoteForm`, `NoteEditor`, `Checklist`, `TextNote`). `NoteEditor` es dueño de la nota en pantalla: cada cambio se ve al instante y se revierte con aviso si falla; los ids de los elementos los crea el navegador.


Añadido por la spec 032 (sin migraciones):

- **Panel lateral** (`#calendar-side-panel`, desde 1024 px): `sticky` con alto máximo `calc(100dvh-15rem)` y desplazamiento propio (`overscroll-contain`).
- **Plegado recordado en el dispositivo**: `lib/calendar/folded.ts` (puro; `foldId` da las ids compartidas `group:<id>`, `person:<id>`, `section:calendars`, `section:ungrouped`, `categories:<calendarId>`) y `useFolded(id, porDefecto)` (`lib/hooks/use-folded.ts`, `localStorage` `cafam-folded`, solo elecciones explícitas). Las categorías empiezan plegadas; lo demás, desplegado. `tests/setup-unit.ts` limpia el almacén tras cada test.
- **Filtros** (`CalendarFilters`): título plegable con "N de M visibles", flecha "Plegar/Desplegar <grupo>" y "2/3" por grupo o persona, categorías bajo "Mostrar las categorías de <calendario>" con "1 categoría oculta", y las flechas Subir/Bajar solo tras "Ordenar" (que despliega todo sin guardarlo) hasta "Hecho".
- **"Mis calendarios"**: `GroupSection` se pliega con la misma id que en los filtros y guarda Renombrar, Borrar, Subir y Bajar tras "Opciones de <grupo>"; "Sin grupo" es un `FoldSection`; `CalendarList` (ahora cliente) pinta filas que despliegan detalles y acciones, una a la vez; "Nuevo grupo" es un chip que abre `GroupForm` en una `Sheet` (`NewGroupButton`; el campo se llama "Nombre del grupo"). `FoldChevron` (`components/ui/fold-chevron.tsx`) es la flecha de todo lo plegable.

Añadido por la spec 034 (modo sin conexión; sin migraciones ni dependencias):

- **Copia del dispositivo** (`lib/offline/db.ts`, IndexedDB nativo, base `cafam-offline` con `meta`, `snapshot`, `outbox`, `conflicts` y `rejected`): `loadOfflineSnapshot` (`app/dashboard/offline-actions.ts`) lee con RLS perfil, calendarios con rol, categorías, grupos, personas, preferencias, los eventos del rango (de hoy −1 mes a +3 meses en la zona del perfil, `range.ts`; repeticiones calculadas) y todas las notas con sus elementos. Nunca imágenes, comentarios, asistente, "Ocupado", emails ni credenciales. `OfflineProvider` (en `AppFrame`) la lee al abrir y si tiene más de 15 minutos (`COPY_MAX_AGE_MS`), y funde en ella lo que la página vuelve a leer (`snapshot-store.ts`). Otra cuenta en el dispositivo borra lo anterior sin enviarlo.
- **Conexión** (`connection.ts`, `useConnection`): `navigator.onLine`, fallos de red de las acciones y un plazo de 10 s (`withTimeout`); sin red comprueba cada 30 s. `ConnectionAnnouncer` lo anuncia y `ConnectionBadge` dice "Sin conexión · datos de las HH:MM" con los pendientes, y abre la hoja `ChangesSheet`.
- **Cola** (`outbox.ts`, `with-outbox.ts`, `flush.ts`, `queue-store.ts`): `event-actions.ts` y `note-actions.ts` envuelven las acciones de siempre; sin red, `describe.ts` convierte la escritura en un cambio (`OfflineChange`) con la base de la copia, se guarda y se ve al instante (`overlay.ts`, `PendingMark` "Pendiente de enviar"). Al volver la red (o al abrir con red) se envía en orden con `applyOfflineChange`, que lo vuelve a comprobar todo con RLS: `applied`, `conflict` (`conflict.ts`, por tres versiones; elementos distintos de una lista no chocan; el orden nunca), `rejected` (a "Cambios no enviados", con los que dependen de él), `retry` o `unauthenticated` (se conservan). Crear + borrar sin red no envía nada; varios cambios de lo mismo se funden.
- **La app sin red** (`/offline?from=<ruta>`): `sw.js` (`cafam-v6`) redirige ahí una navegación de `/dashboard` que falla; `OfflineApp` monta `AppFrame offline` con un enrutador local (`offline-router.tsx`, `pushState`) para calendario, detalle, alta de evento y notas, con los datos de la copia (`offline-sources.ts`). Fuera del rango: "Estas fechas no están disponibles sin conexión"; el resto: "Necesita conexión". En la app con red, sin red un enlace del panel carga la página completa (`loadPage`) para que la vea el service worker.
- **Lo que necesita red** (`gates.ts`): destinos con `needsNetwork` (`NavLink` deshabilitado con su motivo), solo "Solo este evento" en las series, "Repetir" bloqueado, calendarios traídos de solo lectura ("Sin conexión no se puede escribir en Google"), imágenes y comentarios "Disponible con conexión", y los filtros cambian solo en el dispositivo sin guardarse. `SignOutGuard`: sin red deshabilitado; con pendientes avisa "Tienes N cambios sin enviar…"; cerrar sesión o borrar la cuenta llaman a `forgetDevice()`.
- **Conflictos** (`changes.ts`, puro; `ChangesSheet`): las dos versiones con solo lo que difiere, "Conservar la mía" (`force`), "Conservar la suya", "Volver a crearlo" (alta con el mismo id), "Descartar mi cambio", "Borrarlo igualmente" y "Conservar el suyo". Sobreviven a cerrar la app.
- **`/privacy`**: sección "Datos guardados en este dispositivo".
- **Pruebas en el navegador**: `scripts/e2e-offline.mjs` (un usuario) y `scripts/e2e-offline-conflicts.mjs` (dos usuarios, conflictos y capturas), con Edge y `context.setOffline`; `scripts/perf/offline-measure.mjs` mide RNF-2 y RNF-3 (`PROFILE=1` con `next build --no-mangling` da el perfil).

Añadido por la spec 035 (sin conexión, fase 2; sin migraciones ni dependencias). Lo de la 034 sobre "Lo que necesita red" que dejaba de solo lectura los traídos, con un solo alcance en las series, sin "Repetir" y con imágenes y comentarios "Disponible con conexión" ya no vale:

- **Copia de formato 2** (`SNAPSHOT_FORMAT`, base `cafam-offline` versión 2 con `thumbs`, `images` y `pending-images`): `offline-reads-detail.ts` añade las series con sus totales (`series`, `exceptions`), los 50 comentarios más recientes de cada evento del rango y las imágenes `ready`. `syncThumbs` (`thumbs.ts`) baja las miniaturas que faltan y borra las que sobran al leer la copia; `image-cache.ts` guarda las 30 imágenes grandes abiertas con red (la más antigua sale).
- **Traídos de Google e iCloud**: se escriben sin red con las reglas de siempre (`canWriteOffline`, `offlineReadOnly`, `offlineMoveTargets`: solo dentro de la misma cuenta). Al enviar, `readEvent` (`lib/sync/read-event.ts`) lee el evento en el proveedor y lo compara con la base del cambio: cambiado o borrado allí → conflicto. Si la cuenta necesita volver a conectarse, el resultado es `held` con su `connectionId`. El cambio y los que dependen de él se conservan y la hoja "Cambios" ofrece "Volver a conectar" (`/dashboard/connections/<id>`).
- **Series sin red**: `series.update` y `series.delete` con `scope` (`describe.ts`: `seriesUpdateOf`, `seriesDeleteOf`). La pérdida se cuenta en la copia (`series-loss.ts`, `lossInCopy`) y se pide confirmar como con red. `series-overlay.ts` (con `ical.js`, siempre con `import()`) y `usePendingSeries` pintan las repeticiones como quedarán. Al enviar, `applySeries` compara la serie y sus totales con la base del cambio (`sameSeries`); si otra persona cambió algo, el conflicto lleva `recurrence` y `loss`, y la hoja lo enseña con "Ahora se repite…" y "Se perderán…".
- **Comentarios sin red**: `OfflineComments` (`comment-view.ts`: los de la copia con la cola encima), con "Ver anteriores" deshabilitado. Añadir, editar y borrar van a la cola con "Pendiente de enviar" y "Deshacer". El `client_id` evita duplicados al reenviar.
- **Imágenes sin red**: `addImagesOffline` (`image-actions.ts`) reduce como siempre y guarda en `pending-images`. Caben como mucho 10 por evento (guardadas + pendientes) y 20 en el dispositivo (`image-limits.ts`). La galería y el visor leen del dispositivo (`useImageBlob(path, local)`): sin la imagen grande, la miniatura con "La imagen completa necesita conexión". Al enviar, `uploadPendingImage` (`image-upload.ts`) reserva y pide URL firmadas a `POST /api/offline/image` y sube los dos objetos directamente a Storage. Una imagen rechazada queda en "Cambios no enviados" con "Descargar".
- **Envío con la app cerrada** (Background Sync, solo Chromium): encolar registra la etiqueta `cafam-offline` (`background.ts`). `sw.js` (`cafam-v7`) atiende `sync` con su propia copia del bucle de `flush.ts` y llama a `POST /api/offline/apply` y `/api/offline/image` con la cookie de sesión (`offline-session.ts`; sin sesión `401` y se conserva todo). Escribe en `meta` `lastBackgroundSync`, y al abrir la app `OfflineProvider` avisa "N cambios sincronizados". El cerrojo `cafam-offline-flush` (Web Locks) impide enviar a la vez desde la app y el service worker. Safari y Firefox envían al abrir.
- **`/privacy`**: la sección del dispositivo cuenta los comentarios, las miniaturas, las imágenes abiertas, lo pendiente y que las imágenes pendientes se pierden si el navegador borra los datos del sitio.
- **Pruebas en el navegador**: `scripts/e2e-offline-detail.mjs` (detalle sin red a 390 y 1440 px), `scripts/e2e-offline-background.mjs` (envío con la app cerrada), `scripts/screenshots-035.mjs` y `scripts/perf/offline-measure-035.mjs` (RNF-2), todos con Edge.

Añadido por la spec 038 (migración `sync_apply_window`):

- **`sync_apply_events`** recibe `p_from`, `p_to` (la ventana que se pidió al proveedor) y `p_keep` (los `external_id` que `limitEvents` dejó fuera, `omittedIds`). Solo borra eventos con `external_id` que **solapan** la ventana y no están en `p_keep`; sin `p_from` borra como antes (llamadas viejas durante el despliegue). El resumen no cuenta lo conservado.
- **Copia antigua**: un evento traído que empezó antes de la ventana (`isOutsideWindow`, `lib/sync/window.ts`) ya no se actualiza; si se borró en el proveedor, CaFam lo conserva con imágenes y comentarios. El detalle lo dice con `StaleCopyNote` (`staleCopyText` de `provider-labels.ts`). Si vuelve a entrar en la ventana, se actualiza por `external_id` sin duplicarse.
- **Capturas**: `scripts/capture-kit.mjs` (registro, siembra con la clave secreta, 390 y 1440 px en claro y oscuro, borrado del usuario) lo usan los `scripts/screenshots-0NN.mjs` desde la 038.

Añadido por la spec 039 (migración `event_search`):

- **Ruta `/dashboard/search?q=`** (`app/dashboard/search/`, acción `runSearch`) con `SearchScreen` (`components/search/search-screen.tsx`): campo enfocado, busca 350 ms después de la última tecla desde 2 caracteres, últimas 5 búsquedas del dispositivo (`localStorage` `cafam-recent-search`), "Buscando…", vacío con Venito confundido, error con "Reintentar", resultados por día ("Próximos" y "Pasados"), "Oculto en el calendario", extracto del comentario con `<mark>`, "Hay más resultados: afina la búsqueda" (100 como mucho), "Buscar más atrás" (2 años más cada vez) y el número en `aria-live`. Escape o "Cerrar" vuelven atrás.
- **Accesos**: lupa "Buscar" en `CalendarHeading` (móvil) y `TopNav` (desde 769 px) y la tecla `/` (`SHORTCUTS`, `shortcut: "search"`).
- **Lógica pura** en `lib/search/`: `normalize` (sin tildes ni mayúsculas, ñ conservada, igual que `search_text`), `group`, `highlight` (`excerpt`), `recent` y `limits`. `searchEvents` (`queries.ts`, solo servidor) llama a `search_events`, lee las filas con RLS y expande las series con `expandRows` en el periodo (`searchRange`: −1 año, +2 años); una excepción solo sale si coincide ella.
- **Sin conexión**: `searchOffline` y `OFFLINE_SEARCH_NOTE` (`offline-sources.ts`) buscan en los eventos y comentarios de la copia; `matchRoute` conoce `search` y `OfflineApp` la pinta. No busca en lo que espera en la cola.

Añadido por la spec 040 (migración `push`):

- **Ajustes → "Notificaciones"** (`NotificationSettings`, `push-actions.ts`): "Activar en este dispositivo" (pide permiso solo al pulsar; `subscribeDevice` en `lib/push/browser.ts`), "Dispositivos con avisos" con "Quitar", "Enviar un aviso de prueba", el aviso de iOS sin instalar y del permiso bloqueado (`pushSupport`, `device.ts`), "Aviso por defecto" (con hora y de todo el día) y "Avisarme cuando…" (cuatro tipos). Cerrar sesión quita la suscripción del dispositivo (`forgetPushSubscription` en `SignOutGuard`).
- **Recordatorios** (`event_reminders`, personales, como mucho 3): `ReminderField` en el alta y la edición (campo `reminders`, "none" o "10,60", que `createEvent`/`updateEvent` guardan después del evento con `writeReminders`) y `EventReminders` ("Avisarme") en el detalle para cualquier miembro, guardado al momento con `setEventReminders`. Los de una serie van en la fila de la serie (`reminderRowId`). Sin conexión no se ofrecen. El aviso por defecto lo pone el trigger `event_reminders_default` en toda alta con sesión (plan D2): las acciones no lo calculan.
- **Opciones** (`lib/push/options.ts`, puro): `REMINDER_OPTIONS` (con hora; días completos en minutos antes de las 9:00 del día: 0, 1440 y 10080), `parseReminders`, `validFor`. Por defecto 10 y 1440.
- **Envío** (`POST /api/push/run`, `lib/push/run.ts`): `push_due_reminders` → `dueReminders` (`reminders.ts`: series con `expandRows`, días completos a las 9:00 en la zona del perfil, ventana [ahora − 15 min, ahora + 1 min]) → `push_mark_sent` (solo envía lo que marcó esta ejecución) → `push_claim_notifications` → `push_subscriptions_for` → `sendPush` (`send.ts`: `aes128gcm` de `encrypt.ts` y JWT ES256 de `vapid.ts`, `TTL` 24 h); 404/410 → `push_drop_subscription`. Textos en `payload.ts` ("Hoy a las 18:30 · en …"; sociales).
- **Service worker** (`cafam-v8`): `push` muestra la notificación con su `tag`; `notificationclick` lleva una ventana abierta de la app a la URL (solo del mismo origen) o abre una.
- **Pruebas en el navegador**: `scripts/e2e-push.mjs` (Edge con ventana y el servicio de push real) y `scripts/screenshots-040.mjs`.

Añadido por la spec 041 (sin migraciones):

- **Analizador** (`lib/nl/`, puro, sin dependencias, menos de 1 ms por frase): `tokenize.ts` (`Scan`: el texto normalizado tiene la misma longitud que el original, así cada coincidencia es un tramo del texto escrito; una máscara impide que dos reconocedores usen lo mismo), `dates.ts` (relativas, días de la semana, `d/m` en orden español, rangos de días), `times.ts` (horas, franjas, rangos, "hasta", duraciones; de 1 a 7 sin aclarar es de la tarde y se marca), `extras.ts` (`@calendario`, repetición, todo el día, lugar tras " en ") y `parse.ts` (`parseEventText(text, today)`: el título es lo que sobra, limpio y con mayúscula). Orden: calendario, repetición, fechas, horas, todo el día, lugar. "10-12" sin año es un rango de horas, no una fecha.
- **Al formulario** (`resolve.ts`, `resolveParsed`): la duración de Ajustes o la dicha, el hueco del formulario si no hay fecha ni hora, fin al día siguiente pasada la medianoche, `matchCalendar` de la 036 (ambiguo, solo lectura o desconocido dan aviso) y las horas que el cambio de hora se salta pasan a la siguiente con aviso. `preview.ts`: `previewText` y `highlight` (tramos sobre el texto original).
- **Interfaz** (`components/calendar/nl-field.tsx`): `NlField` ("Escribe el evento", campo `phrase` con `form="none"`: nunca se envía) con la vista previa en una región `aria-live="polite"` y lo reconocido subrayado; "Aplicar" o Intro rellenan. `QuickCreate` lo lleva primero y enfocado (recibe `timeZone` y `defaultMinutes`) y envía también `location` y `repeat` ocultos; `EventForm` lo pinta con la prop `phrase` (alta nueva, no al duplicar ni editar) y rellena sus campos no controlados con `fillField` (el setter nativo y el evento, para que corran sus `onChange`). Lo tocado a mano no se pisa (`touched`). La app sin conexión lo usa igual.
- **Capturas**: `scripts/screenshots-041.mjs`.

Añadido por la spec 042 (migración `views_year`):

- **Vistas nuevas** (`CalendarView` gana `year` y `4days`, en `VIEWS`, la URL y `profiles.last_view`): `ranges.ts` (año: del 1 de enero al 31 de diciembre, ±1 año con el 29 de febrero pasando a 28; 4 días: la fecha y 3 más, ±4), `formatPeriodTitle` ("2026", "20 nov – 23 nov 2026") y atajos **Y** (año) y **X** (4 días) en `SHORTCUTS`.
- **4 días**: el workspace pinta `WeekView` con los 4 días (crear, mover, tarjeta y "Ocupado" como en la semana; nunca quita el fin de semana). La página y el cliente piden "Ocupado" también ahí.
- **Año** (`YearView`, `year-view.tsx`): 12 meses en 1, 2, 3 o 4 columnas (`grid-cols-1 tab:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`), hasta 3 puntos por día de los calendarios visibles (`visibleMarks`), hoy en acento; un día abre la vista día y el nombre del mes la vista mes. No lee eventos: `useEventWindow` no planea nada en el año. Las marcas vienen de `useYearMarks` (`lib/hooks/use-year-marks.ts`: caché por año y el siguiente en reposo, "Reintentar") → `loadYearMarks` (`calendar/year-actions.ts`) → `getYearMarks` (`queries.ts`: `calendar_day_marks` más las series con `expandRows`; `exceptionKeys` se comparte con `getEventsInRange`). `lib/calendar/year.ts`: `yearMonths`, `yearOf`, `mergeMarks`. Un solo `Intl.DateTimeFormat` para las 365 etiquetas (RNF-1: 65–78 ms con CPU 4×; con uno por día, 158 ms).
- **Selector**: `ViewToolbar` con las 6 vistas; en el móvil `CalendarHeading` deja 4 pestañas y "Más vistas" (4 días y Año; se cierra al elegir, con Escape o al salir el foco). En el año el título del móvil es el año.
- **Sin conexión**: `offlineCalendarProps.loadYearMarks` saca las marcas de la copia; en el año los meses fuera de la copia quedan atenuados (`data-away`) con "Estas fechas no están disponibles sin conexión", y el aviso general no sale en el año.
- **Capturas y medida**: `scripts/screenshots-042.mjs` (también mide RNF-1 con `Emulation.setCPUThrottlingRate`).

Añadido por la spec 043 (migración `ics_feeds`):

- **Escritura del `.ics`** (`lib/ics/write-ics.ts`, puro y sin `ical.js`; `fold.ts` con los escapes y el plegado a 75 octetos; `vtimezone.ts` con las transiciones de `Intl` del año ±2): `writeIcs({name, rows, now})` recibe filas de `events` (`IcsRow`). Sueltos en UTC, días completos con `VALUE=DATE` y fin exclusivo, series con `DTSTART;TZID=`, `RRULE` (el `UNTIL` de reloj pasa a UTC), `EXDATE` en la hora de reloj de la serie y excepciones con `RECURRENCE-ID` igual que el `DTSTART` de su serie. `UID` = `<id>@cafam` (la serie para sus excepciones). Sin imágenes, comentarios, colores, categorías ni autores; con `category` escribe `CATEGORIES`. `parse-ics` lo lee de vuelta (prueba de ida y vuelta en `write-ics.test.ts`).
- **Exportar** (`GET /api/ics/export?calendar=<id>` o `?visible=1`, con sesión; 401 sin ella, 404 si no se ve): `exportIcs` (`lib/ics/export-queries.ts`) lee con RLS todo el historial paginado con `allRows` (ahora exportada de `calendar/queries.ts`); "los visibles" mira `calendar_preferences.visible` y nombra el archivo `cafam.ics` con `X-WR-CALNAME:CaFam` y el calendario en `CATEGORIES`. Enlaces `<a download>` "Exportar (.ics)" en cada fila de "Mis calendarios" (cualquier rol) y "Exportar los visibles" bajo los filtros (oculto sin conexión).
- **Suscripción** (`GET /api/ics/<token>.ics`, pública): `calendar_feeds` guarda solo el SHA-256 del token (43 caracteres); `create_ics_feed` (solo propietario, `CF404` si no; sustituye al anterior), `disable_ics_feed` e `ics_feed(p_token)` (a `anon`: eventos desde hace 6 meses sin fin y las series vivas, 60 llamadas por hora → `CF429`; sin propietario → `CF404`). La ruta responde `text/calendar`, `private, max-age=900` y `noindex`, y 404/429 sin cuerpo. `next.config.ts` añade `no-referrer` y `noindex` a `/api/ics/:path*`. En "Compartir", sección "Suscripción (.ics)" (`IcsFeedPanel`, acciones `createIcsFeed` y `disableIcsFeed`, `hasIcsFeed`, `buildFeedUrl`): el enlace se ve una sola vez con "Copiar", "Abrir en Google Calendar" y `webcal://`, y el aviso de que cualquiera con él ve todo.
- **Capturas y prueba real**: `scripts/screenshots-043.mjs` (también comprueba la suscripción sin sesión, un token falso y la descarga).

Añadido por la spec 044 (migraciones `ics_import_into` e `ics_subscriptions`):

- **Identidad** (`parse-ics.ts`, `convert-events.ts`): cada `EventRow` lleva `external_id` = `UID`, `UID#<YYYYMMDDTHHMMSSZ>` en una repetición (o `UID#<YYYYMMDD>` de día completo; el instante es el `RECURRENCE-ID` en las cambiadas) y `sin-uid:<título>#<inicio>` sin `UID` (`externalIdOf`). `runImport` deja una sola vez cada identidad (las repetidas cuentan como omitidas) y acepta `window` (solo lo que solapa, antes del límite de 2.000).
- **Importar a uno existente** (`/dashboard/import`): "Destino" con "Un calendario nuevo" o "Un calendario que ya tengo" (calendarios normales donde es Propietario o Editor) → `import_into_calendar` (`{added, existing}`); el resumen dice "Se han añadido N eventos a «X»." y "N ya estaban.". Las importaciones anteriores a la 044 no tienen `external_id` y no se deduplican (plan D5).
- **Mantener actualizado** (casilla, solo con enlace): `create_ics_subscription(calendario, url, ids)` guarda la URL en Vault y las identidades del enlace en `feed_ids`, las únicas que una actualización puede borrar (lo importado de otro archivo y lo creado en CaFam no se toca). Si falla, el resumen lo dice y los eventos se quedan.
- **Motor** (`lib/ics/refresh.ts`, dependencias inyectadas; `refresh-engine.ts` con la clave publicable y `CRON_SECRET`): `ics_get_url` → `fetchIcs` (anti-SSRF de la 004; 404/410 → `gone`) → `runImport` con la ventana de la 038 (`syncWindow`) → `ics_apply_events`, o `ics_fail` (`transient` | `gone`). Una ventana vacía se aplica (el enlace quitó los eventos). `runRefresh` toma tandas de 4 durante 50 s.
- **Ruta** `POST /api/ics/refresh` (`hasCronSecret`, `maxDuration` 60), despertada por `ics_trigger()` desde `pg_cron` `ics-refresh-due` cada 15 minutos solo si hay algo vencido (6 horas).
- **Interfaz**: en "Mis calendarios", `IcsSubscriptionStatus` ("Actualizado desde un enlace · hace 2 h", "en pausa" con el último fallo) con "Actualizar ahora"/"Reintentar" y "Dejar de actualizar" (Propietario y Editores; acciones `refreshIcsSubscription` y `stopIcsSubscription` en `calendars/ics-actions.ts`; `ics_claim_one` con la sesión y 5 minutos como mínimo). Aviso `ics_failing` ("No se pudo actualizar «X» desde su enlace." con el motivo de `account_notices.detail`).
- **Capturas y prueba real**: `scripts/screenshots-044.mjs` importa el `.ics` público de festivos de España de Google (un `.ics` en `localhost` lo rechaza la protección anti-SSRF), simula cambios y pulsa "Actualizar ahora".

Añadido por la spec 036 (sin migraciones):

- **Herramientas de escritura** (`WRITE_TOOL_DEFINITIONS`): `create_events` (crea en el acto de 1 a 3) y `propose_changes` (prepara de 1 a 3 cambios sin escribir nada). Solo se ofrecen si `wantsWrite(hilo)` (`lib/assistant/write-intent.ts`) ve un verbo de crear o cambiar en el último mensaje del usuario, o en uno anterior de la misma petición mientras Venito pregunta. El texto de eventos, comentarios o imágenes nunca abre la escritura. `runAssistant` las recibe con `deps.write` y el prompt nombra los calendarios escribibles; una ronda con escritura va en serie.
- **El servidor resuelve, el modelo nombra** (`app/dashboard/assistant/assistant-writes.ts`, `writeTools`):
  - `matchCalendar` (`calendar-match.ts`): sin mayúsculas ni tildes, una parte del nombre o un correo; da ambiguo, de solo lectura con su motivo o pregunta cuál.
  - `findEventsByTitle` (en `tools.ts`, la lectura de `search_events`) y `pickEvent` (`event-pick.ts`): el del día dicho, el próximo que no ha terminado o, si no hay, el último.
  - `resolveTimes` (`write-times.ts`): `after` empieza al acabar X, `before` acaba al empezar X, la duración de Ajustes al crear y la del evento al editar.
  - Los fallos (fin antes del inicio, solo lectura, más de 3, el proveedor) llevan `notice`, que el bucle añade a la respuesta aunque el modelo lo calle.
- **Acciones** (`lib/assistant/actions.ts`): `created` (con su `anchor` y la ficha `uncreate`) y `change` (antes, después, alcance, pérdida de la serie y `PendingChange` con el `updated_at`). La ruta las manda como líneas NDJSON `action` en cuanto existen y en `done.actions`. `describeAction` da su texto para lectores de pantalla y el resumen que vuelve al modelo dentro del mensaje de Venito.
- **Confirmar y deshacer** (`write-actions.ts`, Server Actions; lógica en `change-writes.ts`): `confirmChange` aplica un cambio solo si el `updated_at` no cambió (de su serie si la repetición no tiene fila) y devuelve la ficha `unchange`. `undoAssistantAction` borra lo creado o devuelve los valores anteriores, salvo si alguien lo tocó. Un cambio a varias repeticiones no se deshace (como la 017). Reutilizan `createSingle`, `updateSingle`, `changeOccurrence` y `deleteSingle`; `seriesValues` de `quick-writes.ts` se exporta.
- **Chat**:
  - `ActionCard` (`components/assistant/action-card.tsx`, `runCardStep`).
  - "sí" y "no" (`isYes`, `isNo`) confirman o cancelan el cambio pendiente sin llamar a la API; otro texto lo cancela, o lo sustituye si llega un cambio nuevo.
  - Al cancelar con tarjetas ya recibidas, se conservan.
  - `onChanged` hace `router.refresh()` desde `AssistantFab`, porque lo escrito en la ruta no refresca la vista y el tiempo real ignora los cambios propios.
- **Eval**: `tests/assistant-eval/write-questions.ts` (15 peticiones) y la prueba "writes only what is asked" de `scripts/assistant-eval.ts` (`EVAL_PART=read|write`). `scripts/assistant-cards.mjs` prueba las tarjetas en el navegador sin Groq y hace las capturas.

La fuente de verdad es [`docs/constitution.md`](docs/constitution.md). Resumen de lo que más afecta a un agente:

- **Flujo SDD (P7):** no se escribe código sin `spec.md` → `plan.md` → `tasks.md` aprobados explícitamente por el usuario, en ese orden. Cada spec vive en `specs/NNN-nombre/`. Se implementa **una tarea `Tn` cada vez y con el test primero** (rojo → verde). Cada commit cita su tarea.
  - Hay skills para redactarlos: `spec-generator`, `plan-generator`, `tasks-generator` y `constitution-generator`.
- **Verificación obligatoria (P8):** ninguna tarea se da por hecha sin ejecutar y **reportar la salida** de:
  ```
  npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
  npm run test:db   # obligatorio si la tarea toca esquema, RLS o acceso a datos
  ```
  más una prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Al cerrar una tarea se marca `[x]` en `tasks.md`.
- **Privado por defecto (P3):** toda tabla de `public` tiene RLS. La base de datos es la frontera de seguridad; el código nunca decide permisos por sí solo.
- **Secretos solo en el servidor (P4):** `SUPABASE_SECRET_KEY` y `CRON_SECRET` nunca llevan prefijo `NEXT_PUBLIC_`, nunca se importan en `src/` ni se suben a git. `tests/unit/no-secrets.test.ts` falla si `src/` menciona `SUPABASE_SECRET_KEY` o `service_role`.
- **Stack cerrado (P6):** solo las dependencias de la sección 4. Cualquier otra exige aprobación del usuario registrada en la spec que la introduce (incluidas la librería de vistas de calendario de la 002 y la de parseo `.ics` de la 004).
- **Prohibido:** servicios de pago, SDK de analítica/tracking/telemetría (GA, Sentry…), librerías PWA (`next-pwa`, Serwist, Workbox), ORMs (Prisma, Drizzle), backends paralelos, y otro gestor de paquetes que no sea npm.
- **Aprobaciones del usuario:** pasar de fase (spec → plan → tareas → implementación) y cerrar una spec exigen su aprobación explícita. No la des por supuesta.
- **Identidad visual (P9, enmienda 11):** toda pantalla nueva o rediseñada sigue la sección "Identidad visual y diseño de interfaz" de la constitución (identidad **Nexo**), usa solo tokens y componentes de `components/ui` (la guardia `design-tokens.test.ts` lo comprueba) y se revisa con capturas a 390, 768 y 1440 px, en claro y oscuro, con Violeta y Ámbar (`scripts/screenshots.mjs`). Móvil primero. Ver §6 "Identidad visual".
- **Enmienda 3 (2026-10-29):** la constitución ya permite tema oscuro, transparencias con desenfoque, sombras suaves, degradados suaves (siempre como tokens) y animaciones de hasta 400 ms con alternativa para `prefers-reduced-motion`; Supabase Storage; `ical.js` también para repeticiones; y un proveedor LLM gratuito sin tarjeta para el asistente, llamado con `fetch` y sin SDK. La 011 ya actualizó la guardia de diseño (`design-tokens.test.ts`): solo `shadow-soft`/`shadow-float`, cristal y sombra de flotar solo en lo que flota, sin `text-white`, `text-black` ni `dark:`, y duraciones de 400 ms como mucho.
- **Mapa del proyecto (enmienda 13):** consulta el grafo de graphify antes de explorar el código y regenéralo (`python -m graphify update .`) si creas, mueves o borras archivos. Ver §0.
- **Acciones externas:** el usuario ejecuta él mismo (con `!` en Claude Code) las acciones sobre producción: `supabase db push` a prod, `git push` y merges a `main`. Prepárale los comandos exactos.

## 4. Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript 5 `strict`, sin `any` explícito (ESLint en error); Node.js 24 |
| Framework | **Next.js 16.4.6** (App Router, Turbopack, Server Components, Server Actions), React 19.3 |
| Estilos | Tailwind CSS 4 vía `@tailwindcss/postcss` (`postcss.config.mjs`) |
| Datos y auth | Supabase Free: PostgreSQL 17 con RLS + Supabase Auth (email/contraseña) con `@supabase/ssr` (sesión en cookies) |
| Validación | `zod` 4 |
| Hosting | Vercel Hobby (incluye el cron diario), repo en GitHub |
| PWA | `src/app/manifest.ts` nativo + service worker propio en `public/sw.js` |
| Tests | Vitest 5 (proyectos `unit` con jsdom y `db` con node), Testing Library |
| Calidad | ESLint 9 (`eslint-config-next` + `eslint-config-prettier`), Prettier 3 |
| BD | Supabase CLI (`supabase` como devDependency) para migraciones y tipos |
| Mapa para agentes | graphify (`graphifyy` de Python, instalado en la máquina, fuera de `package.json`; enmienda 13, ver §0) |

Dependencias de producción: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod` y `ical.js` (2.2.1, MPL-2.0, aprobada en la spec 004; solo se importa en `src/lib/ics/parse-ics.ts`, desde la 013 en `src/lib/recurrence/expand.ts` y desde la 018 en `src/lib/sync/icloud-ics.ts`, todos solo del servidor) y `tsdav` (2.5.0 exacta, MIT, aprobada en la spec 018 con la enmienda 6; solo se importa en `src/lib/sync/providers/icloud.ts`). `no-secrets.test.ts` comprueba las dos. El `package.json` no debe crecer sin aprobación.

## 5. Estructura del repositorio

```
.
├── AGENTS.md                  # este archivo (CLAUDE.md lo importa)
├── docs/constitution.md       # principios, stack permitido/prohibido, convenciones, verificación
├── specs/NNN-nombre/          # spec.md, plan.md, tasks.md de cada spec (con trazabilidad RF → tareas → evidencia)
├── src/
│   ├── proxy.ts               # "middleware" de Next 16: refresca sesión y aplica getRouteAccess
│   ├── app/
│   │   ├── layout.tsx         # <html lang="es">, metadata (título, appleWebApp), viewport, ServiceWorkerRegister
│   │   ├── globals.css        # @import "tailwindcss" + tokens (@theme) y los seis [data-accent]
│   │   ├── page.tsx           # portada pública "/" (con sesión redirige a /dashboard/calendar) + ayuda de instalación iOS
│   │   ├── manifest.ts        # /manifest.webmanifest
│   │   ├── icon.svg           # favicon (copia de public/icons/icon.svg)
│   │   ├── (auth)/            # grupo sin segmento de URL
│   │   │   ├── actions.ts     # Server Actions signUp, signIn, signOut
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── forgot-password/ # pedir enlace + actions.ts (requestRecovery) — spec 006
│   │   │   └── reset-password/  # contraseña nueva + actions.ts (resetPassword) — spec 006
│   │   ├── auth/confirm/route.ts  # verifica el token_hash de los correos de Auth (spec 006)
│   │   ├── dashboard/         # layout.tsx (marco con el acento + slot `modal`), page.tsx (redirige al calendario); protegido por getRouteAccess. También assistant/ (chat a página completa, spec 015/027) y notes/ (lista, new y [id], spec 028)
│   │   │   ├── @modal/        # spec 008: default.tsx y [...catchAll] (null), (.)events/new y (.)events/[id] (ventana sobre el calendario)
│   │   │   ├── calendar/      # vistas agenda/mes/semana/día/4 días/año (?view=&date=) + year-actions.ts (loadYearMarks, spec 042) + preferences-actions.ts (incl. saveLastView) + mini-month-actions.ts + agenda-actions.ts (loadAgendaEvents, spec 016)
│   │   │   │                  # events/ también: quick-actions.ts, quick-writes.ts y event-writes.ts (spec 017: cambios rápidos, deshacer y pegar)
│   │   │   ├── calendars/     # page.tsx ("Mis calendarios"), new, [id]/edit, [id]/categories, merge + actions.ts (calendarios y juntar)
│   │   │   ├── settings/      # Ajustes: acento + actions.ts (setAccent) y cuenta + account-actions.ts (spec 006)
│   │   │   ├── connections/   # spec 007: page.tsx (lista), new (aviso previo), [id] (elegir calendarios, estado, actualizar, desconectar; `maxDuration` 60) + actions.ts (saveSelection, syncNow, disconnectAccount)
│   │   │   └── events/        # new, [id] (página completa) + actions.ts (modo `modal`) + load-new-event.ts y load-event.ts (carga compartida con la ventana)
│   │   ├── dashboard/join/    # "Unirme con código" (ID y PIN) + actions.ts
│   │   ├── dashboard/import/  # "Importar calendario" (.ics) + actions.ts (`maxDuration` 60)
│   │   ├── dashboard/calendars/[id]/share/    # invitaciones y ID/PIN (solo propietario) + actions.ts
│   │   ├── dashboard/calendars/[id]/members/  # lista de miembros (cualquier miembro) + actions.ts
│   │   ├── invite/[token]/    # vista previa y "Unirme" (ruta pública a nivel de proxy) + actions.ts
│   │   ├── offline/page.tsx   # la app sin conexión con la copia (OfflineApp, spec 034) o "Sin conexión" + "Reintentar" sin copia
│   │   ├── api/oauth/[provider]/start, callback  # spec 007: inicio y vuelta del OAuth (estado en la cookie `cafam_oauth`)
│   │   ├── api/sync/run/route.ts  # spec 007: POST con Bearer CRON_SECRET; actualiza lo pendiente (`maxDuration` 60)
│   │   └── api/cron/keep-alive/route.ts  # GET protegido por CRON_SECRET
│   ├── components/
│   │   ├── ui/                # button y button-styles (variantes), link-button, icon-button, text-field, text-area, select, form-alert, time-field (combobox de horas), toast (avisos), card, chip, sheet, empty-state, switch, swap-label, icon-swap, crossfade-text, stagger-list, error-screen, fold-chevron (solo tokens)
│   │   ├── shell/             # app-frame, top-nav (desde 769 px), top-bar y bottom-bar (píldora flotante, móvil), create-fab ("+"), assistant-fab (Venito y el panel del chat), more-sheet, calendar-header (contexto de la cabecera), calendar-sheet (filtros en el móvil), theme-toggle, theme-sync, bar-styles, icons (SVG propios). Sin barra lateral ni cajón desde la 030
│   │   ├── brand/             # logo (LogoMark y Logo) y venito (la morsa, spec 027/031)
│   │   ├── settings/          # accent-picker
│   │   ├── account/           # formularios de cuenta, diálogo de borrado, avisos, calendario sin propietario (spec 006)
│   │   ├── people/            # avatar
│   │   ├── auth/              # auth-card, login-form, signup-form (Client Components con useActionState)
│   │   ├── dashboard/         # calendar-list (filas que se despliegan, spec 032)
│   │   ├── groups/            # group-section, group-list, group-form, assign-group-select, fold-section y new-group-button (specs 007 y 032)
│   │   ├── notes/             # spec 028: notes-board, note-card, note-form, note-editor, checklist, text-note
│   │   ├── search/            # spec 039: search-screen
│   │   ├── calendar/          # formularios, vistas (agenda-view, month/week/day, time-grid, slot-layer), event-block (bloque relleno con las marcas de imágenes y de repetición), month-strip, fab, event-modal, event-panel, quick-create, gone-event, calendar-skeleton, mini-month, next-event-card, filtros, workspace, merge-form, confirm-dialog, draggable-event, event-interactions (contexto), event-menu, event-clipboard, go-to-date-dialog, shortcuts-help, use-undo-toast (spec 017)…
│   │   ├── sharing/           # invite-form, copy-button, invite-list, access-code-panel, member-list, join-code-form, invite-join-card
│   │   ├── import/            # import-form, import-summary
│   │   ├── recurrence/        # spec 013: repeat-field, recurrence-editor, series-scope-dialog, series-delete
│   │   ├── comments/          # spec 014: event-comments (sección con sondeo), comment-item, comment-text, comment-form, comments-skeleton
│   │   ├── images/            # spec 012: image-picker, upload-list, use-image-uploads (cola de subidas), image-uploader (detalle), event-images (galería), image-viewer (visor), use-image-blob
│   │   ├── assistant/         # spec 015: assistant-chat, cited-events; spec 022: image-attach, proposal-card
│   │   ├── connections/       # spec 007: connection-list, provider-notice, calendar-picker, sync-status, sync-now-button, disconnect-dialog; spec 018: icloud-notice, icloud-connect-form
│   │   ├── offline/           # spec 034: offline-provider, offline-app, offline-router, connection-badge, connection-announcer, pending-mark, changes-sheet, sign-out-guard; spec 035: offline-comments
│   │   └── pwa/               # service-worker-register, retry-button, ios-install-hint
│   ├── lib/
│   │   ├── auth/              # schemas.ts (zod), error-messages.ts, form-state.ts, route-access.ts, next-path.ts (destino tras login: solo /invite/<token>)
│   │   ├── calendar/          # LÓGICA PURA testeada: palette, time-zone, ranges, layout, agenda-feed, agenda-today, month-lanes, month-strip, to-view-events, month-marks, next-event, grouping, format, schemas, error-messages, time-options, slots, popover, shortcuts, new-event-query, draft, drag, undo, sheet, zoom (spec 017), event-window (spec 024), folded (spec 032); queries.ts (lecturas con RLS)
│   │   ├── motion/            # spec 021: play, origin, marks, flight, morph, release, rubber-band
│   │   ├── theme/             # accents.ts: los seis acentos y los neutros (fuente de los valores de globals.css)
│   │   ├── shell/             # nav.ts: destinos y sección activa
│   │   ├── people/            # avatar.ts: iniciales y tintes
│   │   ├── hooks/             # use-now.ts (reloj compartido), use-calendar-shortcuts.ts, use-refresh-on-focus.ts, use-is-phone.ts, use-event-drag.ts, use-event-keys.ts, use-grid-zoom.ts (spec 017), use-live-calendar, use-hold-live y use-sidebar-collapsed (spec 019), use-presence, use-enter-once, use-pulse-on y use-follow-drag (spec 021), use-event-window y use-stable-list (spec 024), use-folded (spec 032)
│   │   ├── availability/      # spec 020: busy.ts (puro) y queries.ts
│   │   ├── search/            # spec 039: normalize, group, highlight, recent, limits (puras) y queries.ts
│   │   ├── nl/                # spec 041: tokenize, dates, times, extras, parse, resolve, preview (puras: alta en lenguaje natural)
│   │   ├── push/              # spec 040: options, reminders, payload, device (puras), encrypt y vapid (node:crypto), send, run, reminder-writes (servidor) y browser (cliente)
│   │   ├── notes/             # spec 028: order, search, progress, permissions, schemas, limits, types, error-messages (puros) y queries.ts
│   │   ├── sharing/           # schemas, error-messages, merge-access, invite-url, roles (puros) y queries.ts (lecturas con RLS)
│   │   ├── ics/               # importación .ics: limits, source-url, ip-guard, fetch-ics, read-source, parse-ics (única que importa ical.js), convert-events, import-calendar (orquesta), schemas, error-messages, import-state
│   │   ├── forms/             # form-state.ts: FormState genérico, ConfirmState, ParseResult, readString
│   │   ├── comments/          # spec 014: limits, schemas, linkify, relative-time, error-messages (puras) y queries.ts (`listComments`, `commentRowFor`)
│   │   ├── recurrence/        # spec 013: limits, schemas, rule (RRULE ↔ regla), presets, summary, occurrence-id y error-messages (puras); expand (ical.js), read-series y series-write (`seriesColumns`, `planSeriesChange`, `planSeriesDelete`), solo servidor; server-secret
│   │   ├── images/            # spec 012: paths, limits, fit, alt, error-messages (puras), prepare-image (canvas), upload-object (XHR con progreso), download-image, queries.ts, purge.ts
│   │   ├── assistant/         # spec 015. Puras: limits, dates, free-slots, error-messages, schemas, people-match, serialize, citations, prompt, tool-definitions. Con red o BD: provider (único que llama a Groq), tools (con la sesión), run (bucle con dependencias inyectadas)
│   │   ├── sync/              # spec 007. Puras y testeadas: limits, window, limit-events, nearest-color, event-row, google-events, oauth-state, summary, error-messages, schemas, read-only (canWriteEvents, canMerge). Con red o BD: providers/google.ts (único cliente HTTP de Google), google-config, run-sync (motor con dependencias inyectadas), engine.ts (entrada del servidor), queries.ts (lecturas con RLS)
│   │   ├── offline/           # spec 034. Puras: range, snapshot, outbox, overlay, conflict, limits, describe, changes, gates, messages, schemas. Con IndexedDB o red: db, connection, queue-store, snapshot-store, with-outbox, flush, event-actions, note-actions, offline-sources, navigate. Spec 035: comment-view, image-limits, series-loss (puras); series-overlay (ical.js con import()), thumbs, image-cache, image-actions, image-upload, background
│   │   └── supabase/          # env.ts, server.ts, client.ts, proxy.ts
│   └── types/database.ts      # GENERADO con `npm run db:types`; no editar a mano
├── public/
│   ├── sw.js                  # service worker propio
│   └── icons/                 # icon.svg (maestro) → icon-192, icon-512, icon-512-maskable (letras al 85 %), apple-touch-icon
├── supabase/
│   ├── config.toml
│   └── migrations/            # 001: base_schema, rls_policies · 002: calendars_and_events, merge_calendars · 003: sharing_tables_and_policies, members_with_names, invite_functions, access_code_functions, fix_join_with_code · 004: import_calendar · 005: profile_accent, remove_old_blue · 006: account_orphan_schema, account_recovery_limit, delete_own_account, decide_orphan_calendar, copy_calendar_for_owner, apply_orphan_decisions, account_mail_jobs, account_notices_read, skip_test_addresses · 008: profile_last_view · 007: sync_schema, sync_readonly, sync_connect_functions, sync_worker_functions, calendar_groups · 009: sync_write_schema, sync_write_functions, sync_apply_events_v2 · 010: rename_cafam · 011: profile_theme · 012: event_images, event_images_functions, event_images_storage, event_images_purge_claim, copy_calendar_images(_fix), images_purge, reserve_images_order · 013: event_series, series_reserve_images, series_rules_fast_tz, event_series_functions, series_copy_upload, materialize_occurrence · 014: event_comments, comments_copy_loss · 017: event_undo, trash_row · 018: icloud_provider, sync_write_context_provider · 015: assistant · 019: live_changes, profile_view_options · 020: busy_grid, sync_fast · 023: restore_event_guard, assistant_busy_scope, join_code_lock · 028: notes, notes_calendar_functions
├── tests/
│   ├── setup-unit.ts
│   ├── fixtures/ics/          # .ics sintéticos al estilo Google, iCloud y Outlook (nunca calendarios reales)
│   ├── fixtures/sync/         # respuestas sintéticas de la API de Google Calendar (spec 007)
│   ├── unit/                  # *.test.ts(x): lógica pura, formularios, vistas, filtros, sw-no-data, no-secrets…
│   └── integration/           # schema, rls, signup, login, calendars-events, merge-calendars, preferences, profile-accent, remove-old-blue, range-performance contra Supabase dev + helpers.ts
├── graphify-out/              # grafo de graphify (graph.json, GRAPH_REPORT.md, graph.html, caché); generado e ignorado por git (§0)
├── .claude/settings.json      # hooks PreToolUse de Claude Code que recuerdan consultar el grafo (§0)
├── vercel.json                # cron "0 6 * * *" → /api/cron/keep-alive
├── next.config.ts             # cacheComponents, partialPrefetching, cabeceras de /sw.js
├── postcss.config.mjs, eslint.config.mjs, vitest.config.ts, tsconfig.json (alias @/* → src/*)
└── .env.example               # variables documentadas sin valores
```

Nombres de archivos en kebab-case (`login-form.tsx` exporta `LoginForm`), salvo los reservados de Next (`page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`, `(grupo)`). Rutas URL en inglés.

## 6. Arquitectura

Monolito Next.js desplegado en Vercel. Server Components leen datos con la sesión del usuario, Server Actions hacen registro/login/logout y `src/proxy.ts` refresca la sesión y protege rutas. Supabase aporta Auth y Postgres, donde **RLS impone los permisos**.

```
Navegador / PWA ──cookies──▶ Vercel ─ src/proxy.ts ── refresca sesión (getClaims) + getRouteAccess()
                                    ├ Server Components ── leen con la sesión del usuario
                                    ├ Server Actions ───── signUp / signIn / signOut
                                    └ /api/cron/keep-alive ◀── Vercel Cron 06:00 UTC
                                          ▼
                             Supabase ─ Auth (auth.users) ─ trigger handle_new_user
                                      └ Postgres public.* con RLS + funciones de permiso
```

### Rutas

| Ruta | Acceso | Contenido |
|------|--------|-----------|
| `/` | pública | Portada; con sesión redirige a `/dashboard/calendar` (lo hace la página, no el proxy) |
| `/signup`, `/login` | solo sin sesión (con sesión → `/dashboard/calendar`) | Formularios; aceptan `?next=`, que solo se sigue si es `/invite/<token>` (campo oculto leído en el cliente) |
| `/dashboard` y subrutas | solo con sesión (sin sesión → `/login`) | Todas dentro del marco (`dashboard/layout.tsx`). `/dashboard` redirige a `/dashboard/calendar` |
| `/dashboard/calendar` | con sesión | Vistas `?view=agenda\|month\|week\|day\|4days\|year&date=YYYY-MM-DD`. Sin `view`, la guardada en `profiles.last_view` (o agenda); una `view` inválida → agenda desde hoy |
| `/dashboard/calendars` | con sesión | "Mis calendarios": la lista con crear, importar, unirme y juntar |
| `/dashboard/settings` | con sesión | Ajustes: color de acento, perfil, email, contraseña y borrar cuenta (spec 006); `?confirm=invalid` avisa de un enlace de cambio de email no válido |
| `/dashboard/calendars/new`, `/[id]/edit`, `/[id]/categories`, `/merge` | con sesión | Calendarios, categorías y juntar. `edit` solo propietario, `categories` propietario o editor; otros → 404 |
| `/dashboard/events/new`, `/dashboard/events/[id]` | con sesión | Alta (`?calendar=&date=&start=&end=&allDay=1&title=&from=<id para duplicar>`) y detalle con editar, duplicar y borrar. Navegando dentro de la app se abren en la ventana (`@modal`); recarga o enlace, página completa |
| `/dashboard/calendars/[id]/share` | solo propietario (otros → 404) | Invitaciones por enlace e ID y PIN |
| `/dashboard/calendars/[id]/members` | cualquier miembro (ajeno → 404) | Lista de miembros; controles según el rol |
| `/dashboard/join` | con sesión | Unirme con ID y PIN |
| `/dashboard/import` | con sesión | Importar un `.ics` (enlace o archivo) a un calendario nuevo |
| `/dashboard/connections`, `/new?provider=google`, `/[id]` | con sesión (`[id]` ajeno → 404) | Cuentas conectadas (spec 007). `?error=cancelled\|failed\|max` muestra el fallo de la vuelta del OAuth |
| `/api/oauth/google/start`, `/api/oauth/google/callback` | con sesión | OAuth de Google: `start` guarda estado y verificador PKCE en la cookie y redirige a Google; `callback` los comprueba, guarda la cuenta (`connect_account`) y lleva a `/dashboard/connections/[id]` |
| `/api/sync/run` | `Authorization: Bearer ${CRON_SECRET}` (POST) | Lo llama `sync_trigger()` desde `pg_cron`; actualiza tandas de 4 calendarios durante como mucho 50 s |
| `/invite/[token]` | sin sesión → `/login?next=/invite/<token>`; con sesión, vista previa | Cabeceras `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` |
| `/offline` | pública | Con `?from=<ruta>` y una copia en el dispositivo, la app sin conexión en esa ruta (spec 034); sin copia, "Sin conexión" |
| `/forgot-password` | pública | Pedir el enlace de recuperación (spec 006); `?expired=1` avisa de un enlace caducado |
| `/reset-password` | solo con sesión (la crea el enlace; sin sesión → `/login`) | Contraseña nueva |
| `/auth/confirm` | pública (Route Handler) | `verifyOtp` con `token_hash`: `type=recovery` → `/reset-password`, `type=email_change` → `/dashboard/settings`; nunca lee `next` |
| `/dashboard/calendars/[id]/upload` | solo propietario de un calendario normal con propietario (otros → 404) | Subir a Google (spec 009); `maxDuration` 300 |
| `/privacy` | pública | Política de privacidad (spec 009) |
| `/manifest.webmanifest`, `/sw.js`, `/icons/*` | pública | PWA |
| `/api/images/purge` | `Authorization: Bearer ${CRON_SECRET}` (POST) | Spec 012: borra en Storage los objetos de la cola de purga; `maxDuration` 60 |
| `/api/cron/keep-alive` | `Authorization: Bearer ${CRON_SECRET}` | `200 {"ok":true}` / `401` / `500` |
| `/dashboard/assistant` | con sesión | El chat de Venito a página completa (specs 015 y 027); día a día se abre como panel desde su botón |
| `/dashboard/search` | con sesión | Búsqueda de eventos (spec 039); `?q=` se puede compartir y recargar. Sin conexión, la abre la app sin red |
| `/dashboard/notes`, `/dashboard/notes/new`, `/dashboard/notes/[id]` | con sesión (`[id]` ajeno o inexistente → 404) | Notas (spec 028) |
| `/api/ics/export` | con sesión (GET; sin sesión → `401`) | Spec 043: `?calendar=<id>` o `?visible=1` descarga un `.ics`; un calendario que no se ve → `404` |
| `/api/ics/refresh` | `Authorization: Bearer ${CRON_SECRET}` (POST) | Spec 044: lo llama `ics_trigger()` desde `pg_cron`; actualiza los calendarios importados vencidos (`maxDuration` 60) |
| `/api/ics/<token>.ics` | pública (el token es la credencial) | Spec 043: suscripción de solo lectura; token inválido o revocado → `404` sin cuerpo, más de 60 por hora → `429` |
| `/api/assistant` | con sesión (POST; sin sesión → `401`) | Una pregunta del asistente (spec 015): `400` y `429` (cuota) en JSON; si no, `200` con líneas NDJSON `status`, `done` o `error` (spec 024). `GET` → `204` (precalienta la función) |
| `/api/sync/google-push` | pública (POST) | Avisos de Google (spec 020): marca el calendario con `sync_push`; siempre `200` sin cuerpo, sin leer el cuerpo |
| `/api/push/run` | `Authorization: Bearer ${CRON_SECRET}` (POST) | Spec 040: lo llama `push_trigger()` desde `pg_cron`; envía los recordatorios vencidos y la cola social (`maxDuration` 60) |
| `/api/offline/apply`, `/api/offline/image` | con sesión (POST; sin sesión → `401`) | Spec 035: el service worker reenvía un cambio hecho sin conexión (el mismo contrato que `applyOfflineChange`) y reserva o confirma una imagen pendiente (URL firmadas de subida) |

La decisión de acceso es una función pura, `getRouteAccess(pathname, hasSession)`, en `src/lib/auth/route-access.ts` (testeada en `route-access.test.ts`). Para proteger una ruta nueva se cambia **ahí**, no en cada página. El `matcher` de `src/proxy.ts` excluye estáticos, `sw.js` y el manifest.

### Autenticación

- `signUp` valida con `signUpSchema` (email normalizado a minúsculas sin espacios; contraseña de 8 a 72 caracteres; nombre de 1 a 50) y llama a `supabase.auth.signUp` con los metadatos `display_name` y `time_zone`. La zona horaria la detecta el navegador (`Intl`) en un campo oculto; si no es válida se descarta y Postgres aplica `Europe/Madrid`.
- **"Confirm email" está desactivado** en Supabase (desde la spec 006 hay SMTP de Brevo, pero sigue desactivado), así que el registro devuelve sesión y redirige a `/dashboard/calendar`. El registro es abierto (cualquiera con la URL).
- Los errores de Supabase se traducen en `src/lib/auth/error-messages.ts`; un código desconocido o un error de red se convierte en "No se ha podido conectar…".
- Los formularios usan `useActionState`, `noValidate` (los errores vienen del servidor en español) y desactivan el botón mientras la acción está pendiente.
- `signOut` usa `scope: "local"` y redirige a `/login`.

### Base de datos (`supabase/migrations/`)

- Enum `calendar_role`: `owner | editor | viewer` (en la UI: Propietario, Editor, Lector).
- Tablas: `profiles` (1:1 con `auth.users`: `display_name`, `time_zone`), `calendars` (`owner_id`, `name`, `description`, `color`, por defecto Azul cielo `#A0C4FF` desde la spec 005), `calendar_members` (PK `calendar_id + user_id`, `role`; **el propietario también tiene su fila `owner`**, con un solo owner por calendario) y `events` (`starts_at`/`ends_at` en `timestamptz` con `ends_at >= starts_at`, `all_day`, `created_by`). Todas tienen `created_at` y, las editables, `updated_at`.
- Triggers:
  - `handle_new_user`: crea el perfil y "Mi calendario".
  - `add_owner_membership`: crea la fila `owner`.
  - `validate_time_zone`: en INSERT aplica el respaldo `Europe/Madrid`; en UPDATE rechaza valores no válidos.
  - `prevent_owner_change` y `set_updated_at`.
- Permisos: `is_calendar_member(id)` y `calendar_role_for(id)` son `SECURITY DEFINER` con `search_path = ''` y evitan la recursión de políticas. `list_tables_without_rls()` la usa el test que garantiza P3.
- Políticas:

  | Tabla | Leer | Escribir |
  |-------|------|----------|
  | `profiles` | Solo el propio | Actualizar solo el propio |
  | `calendars` | Los miembros | Crear el usuario como owner; modificar y borrar solo el owner |
  | `calendar_members` | Los miembros | Nadie inserta ni modifica: la spec 003 añadirá RPC controladas |
  | `events` | Los miembros | Crear, modificar y borrar owner y editor |

  `anon` no ve nada.
- Convención de eventos de día completo: `all_day = true`, inicio a las 00:00 **UTC** del primer día y fin exclusivo a las 00:00 UTC del día siguiente al último. Se muestran por fecha UTC sin convertir a la zona del lector (un cumpleaños no cambia de día entre zonas, plan 002 D6). Los eventos con hora son instantes UTC que se escriben y muestran en la zona del **perfil**, que el servidor lee de la base de datos (nunca del cliente).
- Añadido por la spec 002:
  - `event_categories (calendar_id, name)`: por calendario, nombre único ignorando mayúsculas y espacios; leen los miembros, escriben propietario y editor.
  - `events.color` (opcional) y `events.category_id`. La FK compuesta `(category_id, calendar_id)` impide una categoría de otro calendario; al borrar la categoría el evento queda sin ella; un trigger la quita al mover el evento a otro calendario.
  - `calendar_preferences (user_id, calendar_id, visible, position)` y `person_preferences (user_id, person_id, position)`: privadas, filas creadas bajo demanda (sin fila = visible y al final). Los upserts parciales conservan la otra columna.
  - `visible_people()` (`SECURITY DEFINER`): `id` y `display_name` del usuario y de los propietarios de calendarios que comparte, sin zona horaria. La política de `profiles` sigue siendo "solo el propio".
  - `merge_calendars(p_source_ids, p_target_id, p_name, p_color)` (`SECURITY INVOKER`, una transacción): solo propietario de todos; unifica categorías con el mismo nombre; los miembros de los calendarios que desaparecen se pierden (ver Dudas de la spec 003).
  - Límites: calendario 50, categoría 40, título 100, descripción de evento 2000, lugar 200. La paleta de colores NO se impone en SQL, solo en `zod` (`lib/calendar/palette.ts`).
- Añadido por la spec 003:
  - `calendar_invites` (solo guarda `token_hash` = SHA-256 del token de 43 caracteres), `calendar_access_codes` (`public_code` de 8 caracteres de un alfabeto de 31 sin `I L O 0 1`; `pin_hash` con bcrypt de `pgcrypto`) y `join_attempts` (solo fallos). Los hashes se ocultan con **permiso por columna**: pedir `*` o `token_hash`/`pin_hash` da `42501`. Nadie escribe en estas tablas directamente.
  - `calendar_members`: `UPDATE` solo de la columna `role` y solo del propietario sobre filas no `owner`; `DELETE` por el propietario sobre otros o por cualquiera sobre su propia fila si no es `owner`. El `INSERT` directo sigue prohibido. Un trigger borra las preferencias de quien sale (los eventos y categorías que creó se quedan).
  - Funciones `SECURITY DEFINER` con `search_path = ''`: `create_invite`, `revoke_invite`, `get_invite_preview`, `accept_invite` (bloquea la fila: la carrera por el último uso da un éxito y un `CF404`), `set_access_code`, `disable_access_code`, `join_with_code` (devuelve `status` `ok | member | invalid | limited` en vez de lanzar, para que el fallo quede registrado) y `calendar_members_with_names(uuid[])` (única vía para ver nombres ajenos: nombre y rol, sin email ni zona horaria). `CF404` es el SQLSTATE propio de "invitación no válida".
  - `merge_calendars` no cambia: los miembros de los calendarios que desaparecen caen en cascada.
- Añadido por la spec 005: el azul antiguo de la spec 001 desaparece (migración `remove_old_blue`): el valor por defecto de `calendars.color` y el respaldo de `merge_calendars` e `import_calendar` pasan a `#A0C4FF`, y los calendarios y eventos con el azul antiguo se cambiaron a ese color. La guardia de diseño prohíbe el código del azul antiguo en `src/`.
- Añadido por la spec 006:
  - `calendars.owner_id` es anulable y hay `calendars.orphaned_at` (`check`: propietario nulo si y solo si hay fecha). `prevent_owner_change` solo deja cambiar el propietario con la marca de transacción `app.account_transfer`, que activan las funciones de cuenta.
  - Tablas (todas con RLS): `calendar_orphan_decisions` (lectura propia), `account_notices` (lectura propia y `UPDATE (read_at)` propio), `email_outbox` y `auth_email_requests` (sin acceso de clientes; la segunda solo guarda SHA-256 del email).
  - Funciones `SECURITY DEFINER`: `request_recovery` (anon), `delete_own_account` (borra `auth.users` del llamante tras dejar sin propietario los calendarios compartidos), `decide_orphan_calendar`, y solo para `postgres` y `service_role`: `copy_calendar_for_owner`, `apply_orphan_decisions`, `send_pending_emails` (con `p_dry_run` para tests) y `account_scheduled_jobs` (ayuda de tests). `CF404` vuelve a significar "no válido para ti".
  - `pg_cron`: `account-apply-orphans` (03:00 UTC), `account-send-emails` (cada 15 min) y `account-purge-recovery` (04:00 UTC). `pg_net` es asíncrono: un correo se marca enviado cuando una ejecución posterior lee un 2xx en `net._http_response`; hasta 5 intentos. Nunca envía a direcciones `.test`.
  - Vault: `brevo_api_key` y `brevo_sender_email` (los crea el usuario en el SQL Editor de cada proyecto).
- Añadido por la spec 005: `profiles.accent` (`text`, por defecto `'red'`, `check` en `red|blue|green|yellow|purple|gray`). La protegen las políticas de `profiles` (solo el propio); `visible_people()` y `calendar_members_with_names` no la exponen.
- Añadido por la spec 008: `profiles.last_view` (`text` anulable, `check` en `agenda|month|week|day`; nulo = nunca elegida). La escribe `saveLastView` al elegir una vista con botón o atajo, sin revalidar; la protegen las mismas políticas de `profiles`.
- Añadido por la spec 004: `import_calendar(p_name, p_color, p_events jsonb)` (`SECURITY INVOKER`, una transacción): crea el calendario del llamante y sus eventos desde un array de 1 a 2.000 elementos (`22023` si no) y, si un evento viola una restricción, no deja nada. No hay tablas ni columnas nuevas: el calendario importado no guarda nada de su origen.
- Añadido por la spec 007 (en dev y en prod):
  - Tablas con RLS: `calendar_connections` (cuenta de Google conectada: proveedor, `account_subject`, correo y estado `active | needs_reauth`; la lee solo su dueño), `calendar_connection_secrets` (solo el id del secreto de Vault; nadie la lee) y `synced_calendars` (calendario traído: id externo, estado `active | missing`, fallos y último resumen; la leen los miembros, sin el correo de la cuenta). Ningún cliente escribe en ellas. Borrar la conexión borra `synced_calendars` y deja el calendario como normal; un trigger borra el token de Vault.
  - `events.external_id`, único por calendario cuando no es nulo. `account_notices.kind` admite `sync_revoked` y `sync_failing`.
  - **Solo lectura:** las políticas de `events` exigen `not is_synced_calendar(calendar_id)` para crear, modificar, borrar o mover, también para el propietario. `merge_calendars` falla con `22023` si algún calendario es traído.
  - Funciones del usuario: `connect_account` (token a Vault; misma cuenta → reemplaza el token y la reactiva; sexta cuenta → `CF429`), `select_synced_calendars` (un calendario por elemento nuevo; más de 20 → `CF429`), `detach_synced_calendars` y `disconnect_account` (conservar o borrar). `CF404` = conexión ajena.
  - Funciones de sincronización `sync_claim_due`, `sync_claim_connection` (manual: `too_soon` antes de 5 minutos), `sync_get_token`, `sync_store_token`, `sync_apply_events` (reconcilia por `external_id` y guarda `{added, changed, removed, skipped, omitted}`) y `sync_fail` (`transient` → aviso al 3.er fallo; `revoked` → `needs_reauth` y aviso; `missing`). Reciben `p_secret`, que se compara con `cron_secret` de Vault (`42501` si no coincide), y se conceden a `anon`: así el motor no necesita la clave `service_role` (P4).
  - `pg_cron` `sync-run-due` (cada hora; cada minuto desde la 020) llama a `sync_trigger()`, que solo si hay algo pendiente hace `net.http_post` a `sync_app_url || '/api/sync/run'` con `Authorization: Bearer <cron_secret>`. Vault: `cron_secret` (igual que `CRON_SECRET`) y `sync_app_url`, que crea el usuario en cada proyecto (dev: `http://localhost:3000`).
  - Ayudas de test solo para `service_role`: `vault_secret_matches` y `sync_scheduled_jobs`. `provider` admite `'microsoft'` en los `check`, pero desde la Enmienda 1 no se usa.
  - **Grupos** (migración `calendar_groups`): tabla `calendar_groups (user_id, name, position)` con RLS propia (solo su dueño la lee y escribe), nombre de 1 a 40 único por usuario ignorando mayúsculas y espacios exteriores, y `calendar_preferences.group_id` con FK compuesta `(group_id, user_id)`: no se puede asignar un grupo ajeno y borrar el grupo solo pone `group_id` a nulo. Un calendario, un grupo (clave primaria). La visibilidad del grupo no se guarda: se calcula de la de sus calendarios (`organizeGroups`, plan D14).
- Añadido por la spec 009 (migraciones `sync_write_schema`, `sync_write_functions` y `sync_apply_events_v2`; en dev y en prod):
  - `calendar_connections.can_write` (por defecto `false`) y `synced_calendars.google_access` (`owner | writer | reader`). `can_write_synced(uuid)` y el campo calculado `can_write(synced_calendars)`.
  - Las políticas de `events` siguen prohibiendo escribir en traídos: las escrituras pasan por funciones `SECURITY DEFINER` que exigen **sesión con rol owner/editor y además `p_secret`**: `sync_write_context` (comprueba rol, cuenta que escribe y acceso; `42501`, `22023` si se mezclan normal y traído o dos cuentas, `CF404`), `sync_commit_event` (insert/update/delete/gone tras el éxito en Google), `sync_update_calendar`, `sync_attach_created` y `sync_attach_uploaded` (`CF429` a los 20). El trigger `prevent_synced_rename` solo deja renombrar un traído con la marca `app.sync_write`.
  - `connect_account` recibe `p_can_write`; `select_synced_calendars` acepta `access`; `sync_set_access` guarda el acceso al listar.
  - `sync_apply_events` recibe `p_read_at` (no pisa filas con `updated_at >= p_read_at`, lo escrito en CaFam mientras se leía) y `p_access`, y solo borra eventos con `external_id`.
- **Cambios de esquema solo mediante una migración nueva** en `supabase/migrations/` (nunca editando el panel ni migraciones ya aplicadas). Después: `npm run db:push` (dev), `npm run db:types` y tests en `tests/integration/`.
- Añadido por la spec 012 (migraciones `event_images`, `event_images_functions`, `event_images_storage`, `event_images_purge_claim`, `copy_calendar_images`, `copy_calendar_images_fix`, `images_purge` y `reserve_images_order`; en dev y en prod):
  - `event_images (id, event_id → events on delete cascade, object_id, uploaded_by → profiles on delete set null, status pending|ready, bytes, width, height, created_at)` con RLS: los miembros del calendario leen las `ready` y quien reservó, sus `pending`; borran quien la subió, el propietario y los Editores. Nadie inserta ni actualiza directamente. Varias filas pueden compartir `object_id` (copias de calendarios sin propietario).
  - Bucket privado **`event-images`** (solo `image/jpeg`, 4 MB por objeto), rutas `<object_id>/full.jpg` y `<object_id>/thumb.jpg`. El permiso sale de `event_images → events → miembro` (`can_read_event_image`, `image_upload_allowed`), nunca de la ruta: mover o juntar no toca Storage.
  - Funciones: `reserve_event_images(p_event_id, p_images jsonb) returns uuid[]` (cualquier miembro; `CF429` con mensaje `event`/`user`/`total`, `CF404`, `22023`; el orden de `created_at` usa `clock_timestamp()`), `confirm_event_image(p_id)` (`P0002` si faltan los dos objetos) e `images_total_limit()`.
  - **Cola de purga** `image_purge_queue (object_id, bytes, attempts, queued_at, claimed_at)`, que llena el trigger `queue_image_purge` cuando desaparece la última fila de un objeto. Supabase no deja borrar objetos con SQL: `/api/images/purge` reclama con `images_claim_purge(p_secret, …)` (con `CRON_SECRET`, sin `service_role`), borra en Storage como `anon` (solo objetos reclamados en los últimos 5 min) y llama a `images_done_purge`. `pg_cron` `images-purge` (minuto 15 de cada hora) llama a `images_purge_trigger()`, que usa `sync_app_url` de Vault. Las reservas sin confirmar de más de 1 h también se purgan.
- Añadido por la spec 013 (migraciones `event_series`, `series_reserve_images`, `series_rules_fast_tz`, `event_series_functions`, `series_copy_upload` y `materialize_occurrence`; en dev y en prod):
  - `events` gana `recurrence` (RRULE sin `DTSTART`), `recurrence_tz` (nula en día completo), `recurrence_until` (fin de la última repetición, nulo si no acaba; acota las lecturas), `exdates timestamptz[]` (repeticiones borradas), `series_id` y `original_start` (de una excepción). FK `(series_id, calendar_id)` → `events (id, calendar_id)` en cascada: una excepción vive en el calendario de su serie y se mueve y borra con ella; `unique (series_id, original_start)`.
  - Trigger `enforce_series_rules`: sin series en calendarios traídos (`22023`), zona válida, `CF429 series` a las 500 por calendario, `CF429 exceptions` a las 100 excepciones más `exdates`, y no deja quitar la regla a una serie con excepciones. `reserve_event_images` da `22023` sobre una serie: las imágenes van siempre en la fila de una repetición.
  - Funciones `SECURITY INVOKER` (bloquean la serie con `for update`, así que un Lector recibe `CF404`): `update_occurrence`, `split_series`, `update_series` (con `"recurrence": null` en los campos convierte la serie en suelto), `delete_occurrences` y `series_loss` (excepciones e imágenes que se perderían). La regla truncada y los argumentos los calcula TypeScript (`planSeriesChange`, `planSeriesDelete`): SQL no expande reglas.
  - `materialize_occurrence(p_secret, p_series_id, p_original_start)`: `SECURITY DEFINER` para cualquier miembro, idempotente, con el secreto de Vault como las escrituras de la 009, porque la acción comprueba antes con `ical.js` que la fecha es una repetición.
  - `copy_calendar_for_owner` copia series y excepciones; `sync_attach_uploaded` v2 recibe en `p_mapping` `{event_id, external_id}` o `{series_id, starts_at, ends_at, external_id}`, suelta las excepciones y borra las series. `merge_calendars` no cambia.
- Añadido por la spec 014 (migraciones `event_comments` y `comments_copy_loss`; en dev y en prod):
  - `event_comments (id, event_id → events on delete cascade, author_id → profiles on delete set null default auth.uid(), client_id, body 1..1000, created_at, edited_at)`, `unique (author_id, client_id)` (un doble envío se guarda una vez). RLS: leen los miembros del calendario del evento; insertan los miembros como autores; actualiza el autor; borran el autor o `calendar_role_for = 'owner'`. Permisos por columna: `insert (event_id, body, client_id)` y `update (body)`.
  - Trigger `event_comments_rules`: recorta los extremos (`\s`), pone `edited_at` al cambiar el texto y da `22023` en la fila de una serie.
  - `copy_calendar_for_owner` copia los comentarios; `series_loss` devuelve también `comments` (se borró y se creó de nuevo por el cambio de tipo).
- Añadido por la spec 017 (migraciones `event_undo` y `trash_row`; en dev y en prod):
  - `event_trash` (copia del evento, sus imágenes `ready` y sus comentarios, con `deleted_by`): RLS sin políticas y sin permisos para clientes; solo la tocan las funciones. Se guarda la última copia de cada usuario.
  - `snapshot_event(p_event_id, …)` (owner o editor, antes del borrado normal) y `restore_event(p_trash_id, p_event_id default null)` (solo quien borró, en el primer minuto y con el rol aún vigente; `p_event_id` cuelga imágenes y comentarios del evento recreado en Google). `trash_row(p_trash_id)` devuelve la fila guardada a quien borró. Una repetición sin fila se restaura quitando su fecha de `exdates`.
  - `images_claim_purge` deja en la cola los objetos de los últimos 2 minutos, así las imágenes sobreviven al "Deshacer". `pg_cron` `event-trash-purge` (05:00 UTC) borra las copias de más de 1 h; `trash_scheduled_jobs()` es la ayuda de tests.
- Añadido por la spec 015 (migración `assistant`; en dev y en prod):
  - `profiles.share_availability` (`boolean`, por defecto `false`), protegida por las políticas de `profiles`.
  - `assistant_questions (id, user_id default auth.uid(), asked_at)`: el usuario lee e inserta solo las suyas (`insert (user_id)`), nadie las cambia ni borra; `pg_cron` `assistant-purge-questions` (04:30 UTC) borra las de más de 2 días. `assistant_scheduled_jobs()` es la ayuda de tests.
  - `assistant_people()` (personas que comparten calendario con el llamante, con `shares_availability`) y `assistant_busy(p_person_ids, p_from, p_to)` (`SECURITY DEFINER`: solo intervalos ocupados, sin títulos, de personas que consienten y comparten calendario; `22023` si el periodo pasa de 32 días).
- Añadido por la spec 018 (migraciones `icloud_provider` y `sync_write_context_provider`; en dev y en prod (2026-11-01)):
  - Los `check` de `provider` en `calendar_connections` y `synced_calendars` admiten `'icloud'`. `google_access` guarda también el permiso de un calendario de iCloud (no se renombra; lo explica un comentario).
  - `sync_write_context` devuelve además `provider`. El resto de funciones de la 007 y la 009 no cambian: `connect_account` guarda en Vault la credencial de iCloud como guarda el token de Google, y `sync_claim_*` ya devolvían `provider`.
- Añadido por la spec 019 (migraciones `live_changes` y `profile_view_options`; en dev y en prod):
  - `live_notify(p_calendar_id, p_extra_user)` (`SECURITY DEFINER`): llama a `realtime.send({actor: auth.uid()}, 'changed', 'user:<id>', true)` para cada miembro, sin repetir usuario en la misma transacción (marcas `cafam_live.*` con `set_config`), y si Realtime falla solo deja un aviso: nunca tumba la escritura. Triggers `live_events_changed` (también los dos calendarios al mover), `live_calendars_changed` y `live_members_changed` (avisa también al que sale o es expulsado). `actor` es nulo en la sincronización y en lo que escribe el servidor sin sesión.
  - Política "live: own topic" en `realtime.messages`: cada usuario solo se suscribe a `user:<su id>`.
  - `profiles.show_weekends` (`boolean`, por defecto `true`) y `profiles.default_event_minutes` (`int`, por defecto 60, `check` en 15, 30, 45, 60, 90 y 120), protegidas por las políticas de `profiles`.
- Añadido por la spec 020 (migraciones `busy_grid` y `sync_fast`; en dev y en prod):
  - `profiles.share_busy` y `person_preferences.show_busy` (`boolean`, por defecto `false`). `busy_people()` (`id`, `display_name`, `shown` de quien consiente y comparte calendario) y `grid_busy(p_from, p_to)` (`SECURITY DEFINER`: de las personas marcadas, como mucho 8, solo `person_id`, inicio, fin, `all_day` y regla de repetición de los eventos de sus calendarios propios y de los que creó donde sigue siendo miembro, plan D13; las excepciones vuelven como filas sueltas y sus fechas se suman a `exdates`; `22023` si el periodo pasa de 32 días).
  - `synced_calendars` gana `remote_version`, `full_read_at` y `push_pending_at`. Tablas `sync_channels` (un canal por calendario, `token_hash` SHA-256) y `sync_channel_stops` (cola sin FK que llena el trigger `sync_channels_queue_stop`), con RLS y sin permisos para clientes.
  - `sync_due_calendars` (15 min o aviso con 1 min desde el último intento y sin fallos), `sync_claim_due` (devuelve también versión, lectura completa, aviso y caducidad del canal), `sync_push`, `sync_store_channel`, `sync_mark_checked`, `sync_claim_stops` (tira las paradas de cuentas que no están activas) y `sync_done_stop`, todas con `p_secret`. `sync_trigger` despierta también por paradas; `connect_account` borra los canales de la cuenta al reconectar.
- Añadido por la spec 038 (migración `sync_apply_window`): `sync_apply_events` gana `p_from timestamptz`, `p_to timestamptz` y `p_keep text[]` (todos `default null`; firma de 10 argumentos, la de 7 se borró). El borrado exige solape con `[p_from, p_to)` y que el `external_id` no esté en `p_keep`.
- Añadido por la spec 040 (migración `push`):
  - `push_subscriptions` (endpoint único, claves, `device`, `last_used_at`): el usuario lee y borra las suyas; se guardan con `save_push_subscription` (`SECURITY DEFINER`: un endpoint pasa a la última cuenta). `profiles` gana `reminder_minutes` (10), `reminder_all_day_minutes` (1440) y `notify` jsonb (`joined`, `access`, `comments` activados; `changes` no).
  - `event_reminders (user_id, event_id, minutes int[] ≤ 3)`: propias, solo en eventos que se ven (RLS de `events`); `insert (event_id, minutes)` y `update (minutes)`. El trigger `event_reminders_member_left` las borra al salir del calendario y `event_reminders_default` pone la del perfil al crear con sesión (no en eventos ya pasados ni en excepciones).
  - `push_deliveries` (clave usuario, evento, repetición y minutos: un recordatorio se envía una vez) y `push_outbox` (avisos sociales), sin permisos de cliente. `push_enqueue` encola solo si no es la propia acción, hay sesión (la sincronización no avisa), el destinatario tiene un dispositivo y el tipo activado; junta los cambios del mismo actor y evento en 2 minutos. Triggers `push_members_notify`, `push_comments_notify` y `push_events_notify` (no al borrarse el calendario o la serie entera).
  - Con `p_secret`: `push_due_reminders`, `push_mark_sent`, `push_claim_notifications`, `push_subscriptions_for`, `push_drop_subscription` y `push_touch_subscription`. `pg_cron` `push-run` cada minuto llama a `push_trigger()` (solo si hay cola, un recordatorio en 2 minutos o una serie con recordatorios en curso) y `push-purge` (04:45 UTC) borra las entregas de más de 8 días y la cola de más de 2. `push_scheduled_jobs()` es la ayuda de tests.
- Añadido por la spec 043 (migración `ics_feeds`): `calendar_feeds (calendar_id PK → calendars cascade, token_hash bytea unique, created_by, created_at, hits, hits_window)` con RLS: el propietario lee solo `calendar_id` y `created_at` (permiso por columna); nadie escribe directamente. El trigger `calendar_feeds_orphaned` borra el enlace cuando el calendario queda sin propietario; borrar o juntar el calendario lo borra por la cascada. Funciones `SECURITY DEFINER`: `create_ics_feed(p_calendar_id) returns text`, `disable_ics_feed(p_calendar_id)` (solo `authenticated`) e `ics_feed(p_token) returns jsonb {name, rows}` (`anon` y `authenticated`).
- Añadido por la spec 044 (migraciones `ics_import_into` e `ics_subscriptions`):
  - `import_calendar` guarda `external_id`; `import_into_calendar(p_calendar_id, p_events)` (`SECURITY INVOKER`; `CF404` si no es Propietario o Editor, `22023` en un traído, `CF429 imported` por encima de 10.000 eventos con `external_id`) inserta con `on conflict (calendar_id, external_id) do nothing`.
  - `ics_subscriptions (calendar_id PK → calendars cascade, created_by, secret_id (Vault), state active|paused, feed_ids text[], last_read_at, last_summary, consecutive_failures, last_error, attempted_at)`: los miembros leen el estado (permiso por columna, nunca `secret_id` ni `feed_ids`). Triggers: borrar la fila borra el secreto de Vault; quedar sin propietario la borra; si `created_by` sale o pasa a Lector, se pausa.
  - `account_notices.detail` y el tipo `ics_failing`.
  - Funciones: `create_ics_subscription` y `stop_ics_subscription` (Propietario o Editor, `authenticated`), `ics_claim_one` (sesión + secreto, `too_soon` antes de 5 minutos, reactiva una pausada) y, con `p_secret`, `ics_claim_due`, `ics_get_url`, `ics_apply_events` (cambia título, descripción, lugar, fechas y día completo sin pisar `updated_at >= p_read_at`; borra solo `feed_ids` que solapan la ventana) e `ics_fail` (aviso al 3.er fallo; `gone` pausa entonces). `ics_trigger()` e `ics_scheduled_jobs()` (ayuda de tests).
- Añadido por la spec 042 (migración `views_year`): el `check` de `profiles.last_view` admite `year` y `4days`; `calendar_day_marks(p_from date, p_to date)` (`SECURITY INVOKER`, solo `authenticated`) devuelve `(day, calendar_id)` distintos de los eventos sueltos y excepciones que el llamante ve, con hora en la zona de su perfil y días completos por fecha UTC con fin exclusivo; las series las expande la app; `22023` con más de 370 días o un rango al revés.
- Añadido por la spec 039 (migración `event_search`): extensiones `pg_trgm` y `unaccent` en `extensions`; `search_text(text)` inmutable (minúsculas sin tildes, ñ conservada); índices GIN de trigramas `events_search_idx` (título, lugar y descripción) y `event_comments_search_idx`; `search_events(p_query, p_from, p_to, p_limit)` `SECURITY INVOKER` (solo `authenticated`) devuelve `(event_id, matched_comment)` de los calendarios del llamante: cada palabra debe aparecer (AND), la más larga va por el índice. Medido: 6,4 ms con 20.000 eventos.
- La evolución prevista (`calendar_invites`, `calendar_access_codes`, …) está en el Anexo A de `specs/001-base-aplicacion/plan.md`.

### PWA

- Manifest: CaFam (nombre y nombre corto), `theme_color` y `background_color` lavanda `#F3F2FA` (de `NEUTRALS.stone`, identidad Nexo), `start_url /dashboard/calendar`, `standalone`, iconos 192, 512 y 512 maskable generados desde `public/icons/icon.svg`. El favicon (`/icon.svg`) se enlaza explícitamente en `metadata.icons`: la convención de archivo sola no dejaba `<link rel="icon">`.
- iOS: `appleWebApp` en `layout.tsx` + `apple-touch-icon`. La portada muestra la ayuda "Compartir › Añadir a pantalla de inicio" **solo** en Safari iOS.
- `public/sw.js`:
  - Precachea `/offline`, los iconos y los `/_next/static/` que referencia `/offline`.
  - En navegaciones usa red primero; si falla una de `/dashboard`, redirige a `/offline?from=<ruta>` (spec 034), que sale de la caché con cualquier consulta. El mensaje `refresh-offline` vuelve a precachear.
  - Usa caché primero para `/_next/static/` e `/icons/`.
  - **Nunca cachea HTML con sesión ni respuestas de Supabase** (privacidad en dispositivos compartidos).
  - Atiende `sync` con la etiqueta `cafam-offline` (spec 035): envía la cola con la app cerrada en Chromium.
  - Muestra los avisos push (`push`) y abre su URL al pulsarlos (`notificationclick`, spec 040).
  - **Si cambias `sw.js` o los iconos, sube `CACHE_NAME`** (`cafam-vN`; ahora `v8`).
  - Se registra solo en producción.

### Identidad visual

Reglas completas en la constitución ("Identidad visual y diseño de interfaz", enmienda 11, identidad **Nexo**). Lo que hay en el código:

- **Tokens** en `src/app/globals.css`, con los valores de `src/lib/theme/accents.ts` (`theme-css.test.ts` los mantiene iguales y `accents.test.ts` comprueba el contraste):
  - Neutros: `stone #F3F2FA` (fondo lavanda), `paper #FFFFFF` (tarjetas), `ink #1D1B2E`, `muted #6F6C86`, `line #E9E7F5` (bordes finos), `control #8B88A6` (bordes de campos, 3:1) y `danger`, más `on-ink`, `pastel-ink`, `mark`/`on-mark` (la ficha de la marca), `scrim` y los `walrus-*` de Venito. El tema oscuro redefine las variables en `[data-theme="dark"]` y en `prefers-color-scheme: dark` sin `data-theme="light"`.
  - Acento: `accent` (relleno), `accent-to` (fin del degradado), `on-accent`, `accent-ink` (texto y líneas), `accent-edge` y `accent-soft` (fondo suave de lo activo). Seis acentos con los ids guardados de siempre: `red` = Violeta (por defecto), `blue` = Azul, `green` = Verde, `yellow` = Ámbar, `purple` = Rosa, `gray` = Grafito.
  - Radios: `rounded-card` (20 px), `rounded-control` (12 px), `rounded-block` (8 px) y `rounded-full`. La guardia prohíbe cualquier otro.
  - Elevación: `surface` (borde fino y sombra mínima) y `surface-float` (lo que flota). Nunca `backdrop-filter`.
- **`bg-accent-gradient`**: la acción principal y la pestaña activa (degradado de `accent` a `accent-to` con su brillo). Es el único degradado de un control; la guardia prohíbe `bg-linear-*` sueltos.
- **El acento** lo pinta `AppFrame` con `data-accent`. Texto y líneas, siempre `accent-ink`; sobre un relleno o el degradado, `text-on-accent`; lo activo en reposo, `bg-accent-soft text-accent-ink`.
- **Colores de calendario** (paleta pastel de la spec 002): bloques de evento rellenos con el texto en `pastel-ink`; fuera de ellos, solo como marca. Un color que viene de datos va en `style`.
- **Tipografía**: Inter (`next/font`); títulos `font-semibold tracking-tight`; `tabular-nums` en horas, fechas y contadores. Se permiten etiquetas pequeñas en mayúsculas con espaciado para cabeceras.
- **Componentes base**: `Button`/`LinkButton` (`primary` con degradado, `secondary`, `quiet`, `danger`; 44 px), `IconButton`, `TextField`/`TextArea`/`Select` (16 px de texto), `Card`, `Chip`/`ChipLink`, `Sheet`, `EmptyState`, `Switch`, `FormAlert`, `Toast` (oscuro). Iconos: SVG propios en `components/shell/icons.tsx`.
- **Nunca** `text-white`, `text-black` ni la variante `dark:`: el tema cambia las variables, no las clases.

## 7. Entornos, despliegue y variables

| Entorno | Supabase | Uso |
|---------|----------|-----|
| dev | `calendario-dev` (ref `uthubyzhonrtrmbcqcjh`, eu-west-1) | `npm run dev` y `npm run test:db`. **El link local de la CLI debe apuntar siempre aquí** |
| prod | `calendario-prod` (ref `yznbdoskvtxeasujtirk`, eu-west-1) | Vercel. Site URL = URL de Vercel |

- Las funciones de Vercel corren en **Dublín (`dub1`)**, fijado en `vercel.json`, para estar junto a Supabase `eu-west-1`; en Washington cada consulta cruzaba el Atlántico y las páginas tardaban segundos. La mejora aún no está medida: si vuelve la lentitud, mira los logs de Vercel (duración y arranque en frío) antes de tocar código.
- Vercel despliega a producción cada push a **`main`** y hace previews de las demás ramas. Se trabaja en una rama por spec (`001-base-aplicacion`) y se integra en `main` con `git merge --ff-only`. `main` debe estar siempre desplegable.
- Para aplicar migraciones a prod (lo ejecuta el usuario):
  ```
  npx supabase link --project-ref yznbdoskvtxeasujtirk
  npx supabase db push
  npx supabase link --project-ref uthubyzhonrtrmbcqcjh   # volver a dev inmediatamente
  ```
- **Sincronización (spec 007)**, también a mano y por el usuario: URI de retorno de producción en Google, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en Vercel, migraciones a prod y `cron_secret` y `sync_app_url` en Vault de prod. Los comandos exactos están en `specs/007-sincronizacion-oauth/plan.md`, "Pasos de producción".
- **Correo (spec 006)**, configurado a mano en cada proyecto de Supabase (dev y prod ya lo tienen):
  - Authentication → Emails → SMTP: Brevo, `smtp-relay.brevo.com`, puerto `587`; usuario el login SMTP de Brevo (`…@smtp-brevo.com`) y contraseña una **clave SMTP** (`xsmtpsib-…`), no la clave API. Remitente el email verificado en Brevo.
  - Plantillas *Reset password* y *Change email address*: el enlace es `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (o `type=email_change`). Site URL correcta, notificación *Email address changed* activa y límite de correos por hora subido.
  - SQL Editor: `select vault.create_secret('<clave API>', 'brevo_api_key');` y `select vault.create_secret('<remitente>', 'brevo_sender_email');`. Sin ellas, el envío programado falla (los avisos siguen en la app).
  - Brevo: restricción de IP desactivada (Supabase llama desde IPs variables). Plan gratuito: 300 correos al día.
- El cron de Vercel llama cada día a `/api/cron/keep-alive`, que hace una consulta mínima para que Supabase Free no pause el proyecto tras 7 días de inactividad.

Variables (documentadas en `.env.example`):

| Variable | Dónde | Notas |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, `.env.test.local`, Vercel | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, `.env.test.local`, Vercel | Pública (`sb_publishable_…`) |
| `CRON_SECRET` | Vercel, `.env.local` y `.env.test.local` | Secreto del servidor. Desde la spec 007 debe ser igual que `cron_secret` en Vault (los tests de `sync-worker` lo usan) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `.env.local` y Vercel | Cliente OAuth de Google (spec 007), solo servidor. En dev, con la URI `http://localhost:3000/api/oauth/google/callback` |
| `GROQ_API_KEY` | `.env.local`, `.env.test.local` y Vercel | Clave de Groq del asistente (spec 015), solo servidor y solo en `lib/assistant/provider.ts`. Dev y prod con claves distintas |
| `SYNC_PUSH_URL` | Solo Vercel (Production) | Spec 020: dirección de los avisos de Google (`https://calendario-familia-five.vercel.app/api/sync/google-push`), solo servidor. Vacía en dev y previews: sin canales, cada 15 min |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` y Vercel | Spec 040: clave pública VAPID (base64url), la usa el navegador al suscribirse |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `.env.local` y Vercel | Spec 040: clave privada (solo servidor, solo en `lib/push/run.ts`; `no-secrets` la vigila) y `mailto:` de contacto. Se generan con `node scripts/make-vapid-keys.mjs`; cambiarlas invalida todas las suscripciones |
| `SUPABASE_SECRET_KEY` | **Solo `.env.test.local`** | Crea y borra usuarios en `test:db`. Nunca en Vercel ni en `src/` |

**Permisos registrados en Google** (pantalla de consentimiento, proyecto `CaFam`), todos con el prefijo `https://www.googleapis.com/auth/`:

- Para usos futuros: `calendar.calendarlist`, `calendar.calendars`, `calendar.calendars.readonly`, `calendar.events` y `calendar.events.readonly`.
- Registrar un permiso no lo concede: el usuario solo autoriza los que la app pide en la URL de autorización.
- Desde la 009 la app pide `openid email calendar.calendarlist.readonly calendar.events calendar.calendars` (`GOOGLE_SCOPES` en `lib/sync/scopes.ts`). Sin todos ellos la cuenta queda de solo lectura (`can_write = false`).
- La 007 pedía `calendar.events.readonly` en lugar de los de escritura; las cuentas conectadas entonces hay que volver a conectarlas.

`.env.local` y `.env.test.local` apuntan a **dev** y están ignorados por git. No los leas ni los muestres en la salida.

## 8. Comandos

```
npm run dev            # http://localhost:3000 (el usuario suele tenerlo abierto: usa otro puerto, p. ej. npx next start -p 3100)
npm run build && npm start
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format         # prettier --write .   |  npm run format:check
npm test               # vitest proyecto unit (jsdom)        → npm test -- <filtro>
npm run test:db        # vitest proyecto db contra Supabase dev → npm run test:db -- <filtro>
npm run db:push        # aplica migraciones al proyecto enlazado (dev)
npm run db:types       # regenera src/types/database.ts
npm run eval:assistant # spec 015: 39 preguntas a Groq contra dev (~10 min, gasta cuota)
npm run eval:schedule  # spec 022: 12 horarios sintéticos al modelo con visión (~12 min, gasta cuota)
python -m graphify query "<pregunta>"   # mapa del proyecto (§0); también explain, path y update .
```

## 9. Patrones del código (síguelos)

- **`cacheComponents: true`:** cualquier lectura de cookies o sesión va en un componente `async` dentro de `<Suspense>`, con `await connection()` antes de crear el cliente (Supabase usa `Date.now()`). Ejemplo: `Greeting` y `Calendars` en `src/app/dashboard/page.tsx`. Leer `cookies()` fuera de `<Suspense>` rompe el build.
- **Cliente de Supabase por contexto:**
  - `@/lib/supabase/server` en Server Components, Actions y Route Handlers.
  - `@/lib/supabase/client` en Client Components.
  - `@/lib/supabase/proxy` solo en `src/proxy.ts`.
  - El cliente de `server` siempre lleva el tipo `Database`.
- **Permisos:** confía en RLS y filtra por `user_id` cuando necesites tu fila (p. ej. tu rol en `calendar_members`). No uses la clave secreta en la app.
- **Server Actions:** devuelven un estado tipado (`src/lib/auth/form-state.ts`) con `fieldErrors`, `formError` y `values` para conservar lo escrito; el éxito hace `redirect()` fuera del `try`.
- **Identidad visual:** solo tokens (`bg-paper`, `text-muted`, `bg-accent`…); nada de `bg-white`, colores de la paleta de Tailwind ni hex en clases (la guardia `design-tokens.test.ts` falla). Un color que viene de datos (calendario, avatar) va en `style`.
- **Hora actual en el cliente:** `useNow()` (`lib/hooks/use-now.ts`), compartido y con `useSyncExternalStore`. En un Server Component no llames a `Date.now()` en el cuerpo (regla de lint de React): sácalo a una función de `lib/` (p. ej. `nextEventsWindow()`).
- **UI:** reutiliza `Button`, `LinkButton`, `TextField` y `FormAlert`. Accesibilidad:
  - Etiqueta visible en cada campo.
  - Errores enlazados con `aria-describedby` y anunciados (`role="alert"`, `aria-live`).
  - Botones con `min-h-11`.
  - Todo usable solo con teclado.
- **Páginas dinámicas (spec 002):** el `page.tsx` es síncrono; `params`/`searchParams` son promesas que se esperan dentro de un componente `async` bajo `<Suspense>`. Los `[id]` inválidos o ajenos hacen `notFound()`.
- **Server Actions que escriben:** validan con `zod` en español, leen con `requireActionUser()` (`lib/calendar/queries.ts`; los componentes usan `requireUser()`, que añade `connection()`), traducen errores con `getCalendarErrorMessage`, y antes de `redirect()` llaman a `revalidatePath("/dashboard", "layout")`. Sin eso, tras redirigir se ve el dato viejo por la caché de rutas del cliente. RLS oculta las filas sin dar error: un `update`/`delete` que devuelve 0 filas se explica con `canSeeCalendar`/`canSeeEvent` ("ya no existe" frente a "sin permiso").
- **Formularios con React 19:** tras cada acción React reinicia los campos. Usa campos **no controlados** (`defaultValue` desde `state.values`) y deja `useState` solo para lo que cambia la interfaz (p. ej. ocultar horas); un campo controlado no recupera lo enviado.
- **Ids de campos:** `useId()`, nunca `field-${name}` (ver trampas).
- **Para valores que solo existen en el navegador** (zona horaria, user agent…), usa `useSyncExternalStore` con un snapshot de servidor, no `useEffect` con `setState` (evita el aviso de hidratación y la regla de lint).
- **Comentarios:** en inglés, breves, explicando el porqué y citando el requisito o la decisión del plan (`// ... (RF-26, plan D13)`).
- **Tests:**
  - Los de componentes usan Testing Library por rol o etiqueta, con los textos en español.
  - Los de Route Handlers usan `// @vitest-environment node` y mockean `@supabase/supabase-js`.
  - Los de integración crean y borran usuarios con `tests/integration/helpers.ts`.
- **Ventana de evento (spec 008):** las rutas `/dashboard/events/new` y `/dashboard/events/[id]` tienen una copia interceptada en `src/app/dashboard/@modal/(.)events/…` que pinta lo mismo dentro de `EventModal`. Los datos salen de `load-new-event.ts` y `load-event.ts`, compartidos con las páginas completas; un cambio en lo que muestra el alta o el detalle va **ahí**, no en cada página. Para cerrar se usa `router.back()`. Un enlace a otra página cierra la ventana gracias a `@modal/[...catchAll]`.
- **Formularios dentro de la ventana:** `useEventModal()` devuelve la API de la ventana, o `null` en una página completa. Con ventana, `EventForm` envía el campo oculto `mode=modal`; `createEvent`, `updateEvent` y `deleteEvent(id, "modal")` devuelven entonces `{ done }` en vez de redirigir, y el formulario llama a `finish(done)`, que muestra el aviso, vuelve atrás y hace `router.refresh()`. Cualquier escritura nueva desde la ventana sigue ese patrón.
- **Resultados de acciones que cierran algo:** atiéndelos **una sola vez por objeto de estado** (`handled` con `useRef`), porque Activity vuelve a ejecutar los efectos al mostrar la ruta otra vez (ver trampas).
- **Foco al abrir un `<dialog>`:** `showModal()` enfoca el primer control. Para empezar en otro campo, márcalo con `data-autofocus`; `EventModal` y `QuickCreate` lo enfocan tras abrir.
- **Crear desde la rejilla:** el workspace guarda el borrador (`Draft`), las vistas reciben `onCreate`/`draft` solo si `canCreate`, y `QuickCreate` es estado del cliente, no una ruta. La lógica de posiciones vive en `lib/calendar/slots.ts` y `popover.ts` (pura y testeada).
- **Avisos:** `useToast().show(texto)` dentro del marco de la app (`ToastProvider` en `AppFrame`).
- **Atajos:** se añaden en `KEYS` de `lib/calendar/shortcuts.ts` (con su test) y se atienden en `use-calendar-shortcuts.ts`.
- **Sincronización (spec 007):** el servidor nunca usa `service_role`. `engineDeps()` crea un cliente con la clave publicable y pasa `CRON_SECRET` como `p_secret` a las funciones `sync_*`. Antes de llamar al motor desde una acción o página, comprueba con la sesión (RLS) que la conexión es del usuario (`getConnection`). Las llamadas a Google van solo en `providers/google.ts` y sus fallos son `ProviderError` con `kind` `revoked | missing | transient`.
- **Escritura en Google (spec 009):** las acciones llaman a `writeEvent` (`lib/sync/write-event.ts`), `renameSyncedCalendar`/`createSyncedCalendar` (`write-calendar.ts`) o `uploadCalendar` (`upload-calendar.ts`) con `writeEngineDeps(supabase)`, que usa la sesión del usuario más `CRON_SECRET`. Plazo de 9 s por escritura de evento. Los mensajes salen de `WRITE_ERRORS` (`write-errors.ts`), que no importa el cliente de Google para poder usarse en el navegador. `no-secrets.test.ts` falla si un componente `"use client"` importa el motor (salvo `import type`).
- **Calendarios traídos:** `CalendarRecord.synced` (de `getMyCalendars`/`getCalendar`) es `null` en los normales. Para decidir qué ofrece la interfaz usa `canWriteEvents`, `moveTargets`, `readOnlyReason` y `canMerge` de `lib/sync/read-only.ts`, nunca `role !== "viewer"` a secas. La base de datos lo impone igualmente.
- **Móvil y escritorio (spec 016):** las variantes `max-tab:` (hasta 768 px) y `tab:` (desde 769 px) de `globals.css` separan el marco del móvil del de escritorio; no uses `md:` para eso. En JavaScript, `useIsPhone()` con la misma consulta.
- **Cabecera del móvil:** la pantalla del calendario publica su título, el selector y el "Hoy" con `usePublishCalendarHeader` (`components/shell/calendar-header.tsx`); `TopBar` los pinta. Lo que va dentro del cajón se lleva con `createPortal` a `drawerSlot`.
- **"Hoy" en la agenda:** no navega; se pide con `requestAgendaToday()` (`lib/calendar/agenda-today.ts`), un evento de `window` que atiende `AgendaView`. La cabecera, la barra de herramientas y la tecla T lo usan.
- **Ids de evento (spec 013):** un id de la URL puede ser de una repetición (`<uuid>_<fecha>`). Valídalo con `parseEventId`, nunca con `z.uuid()`, y lee con `getEvent`, que devuelve la fila, la excepción o la repetición calculada con su `series`.
- **Comentarios (spec 014):** las acciones de `app/dashboard/events/comment-actions.ts` no redirigen: devuelven `CommentResult` con la lista ya actualizada (reciben `since`, el comentario más antiguo cargado). `gone` cierra la ventana o vuelve al calendario. Un id de repetición se resuelve con `commentRowFor`.
- **Escrituras sobre series:** `updateEvent` y `deleteEvent` leen `scope` y `confirmLoss` del formulario; las funciones y sus argumentos salen de `planSeriesChange`/`planSeriesDelete` (puras y testeadas), y la acción solo consulta `series_loss` y llama. Un cambio nuevo sobre series va ahí.
- **Interacciones con eventos (spec 017):** `EventInteractionsProvider` (`event-interactions.tsx`, con `useEventInteractionsState` en el workspace) guarda los cambios optimistas, el aviso con "Deshacer", el menú y la región `aria-live`; las vistas lo leen con `useEventInteractions()` y pintan cada evento editable dentro de `DraggableEvent`. Las vistas marcan sus zonas con `data-time-col` (columnas de la rejilla), `data-allday-day` (franja de día completo), `data-date` (celdas del mes) y `data-grid-scroll` (contenedor que se autodesplaza); `targetAt` busca con `elementsFromPoint`. `EventBlock` lleva `data-event-id`, que usan el teclado y el menú.
- **Atajos y ayuda:** un atajo nuevo va en `SHORTCUTS` (`shortcuts.ts`), que alimenta `KEYS` y la ayuda (?). Cada diálogo de atajo solo se cierra a sí mismo.
- **Tiempo real (spec 019):** una interacción que no debe verse interrumpida por un refresco ajeno llama a `useHoldLive(activo)` (o `holdLive()` y su función de soltar); al soltar el último, se hace el refresco pendiente. Tras un refresco remoto, `takeRemoteRefresh()` dice durante 3 s que el cambio vino de otro (lo usa `GoneEvent`). Una tabla nueva que deba avisar en vivo necesita su trigger con `live_notify`.
- **Tarjeta de detalle (spec 019):** `EventBlock` es `"use client"` y abre la tarjeta con `openCard` si hay contexto de interacciones y no es móvil; fuera de las vistas sigue siendo un enlace. Lo que pinta la tarjeta y no tiene la vista sale de `loadEventCard`.
- **Sincronización rápida (spec 020):** un proveedor nuevo implementa `calendarVersion` (barata, sin eventos); `watchCalendar`/`stopChannel` son opcionales y solo los tiene Google. Lo que diga si hay que leer todo va en `needsFullRead` (pura). Una ruta que llame al motor pasa `pushUrl: process.env.SYNC_PUSH_URL`, o no se crearán canales. Un fallo de canal nunca tumba la actualización.
- **Movimiento (spec 021):** las duraciones y curvas salen siempre de los tokens (`motionMs`, `motionToken`), nunca de números sueltos. Una animación de script va con `play()`, que parte de donde esté la anterior; algo que deba animarse tras un cambio y un nuevo pintado (pulso, regreso) se marca con `marks.ts` y lo recoge el bloque. Una superficie que crece desde un evento usa `setMorphOrigin` al pulsar y `morphIn`/`morphOut` al abrir y cerrar. Lo que sigue al dedo usa `useFollowDrag` con `offset: banded(...)` en los límites.
- **Navegar por el calendario (spec 024):** nunca `router.push(calendarHref(...))` ni `<Link href={calendarHref(...)}>` dentro del calendario: usa `useCalendarGo()` y `CalendarLink`. Lo que dependa de la vista o la fecha se calcula en el navegador a partir de `CalendarClient`, no en `page.tsx`. Un dato nuevo del calendario que deba cambiar con el periodo sale de la ventana (`useEventWindow`) o de una acción perezosa como `loadBusy`.
- **Enlaces con muchas instancias** (días, eventos, tarjetas): `prefetch={false}`. Next precarga cada `<Link>` visible.
- **Ventanas del móvil:** usa `Sheet` (`components/ui/sheet.tsx`). Cierra el `<dialog>` en la limpieza del efecto (Activity).
- **Edición optimista (spec 028):** el componente es dueño del dato en pantalla, cada acción escribe una sola cosa y devuelve `{ error? }`; si falla, se revierte ese cambio y se avisa con `useToast()`. Adopta las props nuevas del servidor solo cuando no hay nada guardándose ni un campo con el foco (`useHoldLive`).
- **Tiempo real fuera del calendario:** una pantalla que deba refrescarse con cambios ajenos llama a `useLiveCalendar(userId)`; su tabla necesita un trigger con `live_notify`.
- **Asistente:** el servidor manda líneas NDJSON; cualquier estado nuevo del progreso va en `STATUS`/`statusFor` (`lib/assistant/stream.ts`), no en el componente.
- **Escrituras sin conexión (spec 034):** una escritura nueva de eventos o notas desde la interfaz pasa por `event-actions.ts` o `note-actions.ts` (`withOutbox`) y necesita su tipo en `OfflineChange` (`outbox.ts`), su descripción en `describe.ts` y su aplicación en `applyOfflineChange`; si no puede hacerse sin red, que responda "Necesita conexión" (`networkReason`). Lo que dependa de la red usa `useConnection()`, nunca `navigator.onLine` a secas.
- **Bucle de envío sin conexión (spec 035):** está escrito dos veces, en `lib/offline/flush.ts` y en `public/sw.js` (sin empaquetar, plan D4). Un cambio en uno va también en el otro, con su caso en `tests/unit/offline-flush-cases.ts`, que pasa por los dos (`offline-flush.test.ts` y `offline-sw-sync.test.ts`, que carga `sw.js` en un `vm`). Un tipo nuevo de `OfflineChange` necesita también su caso en `sw.js` y su aplicación en `offline-writes.ts`.
- **Commits:** Conventional Commits en español con la tarea: `feat: registro de usuario (T7)`.

## 10. Trampas conocidas

- **Next.js 16 ≠ lo que conoces:** `middleware.ts` se llama `proxy.ts`; hay `cacheComponents`, `partialPrefetching` y `LayoutProps`/`PageProps` globales. Consulta `node_modules/next/dist/docs/` antes de usar una API.
- **Finales de línea:** la máquina tiene `core.autocrlf=true`. `.gitattributes` fuerza LF, y si `format:check` falla en masa por CRLF, `npx prettier --write .` lo arregla sin cambiar contenido. `docs/`, `specs/` y `AGENTS.md` están en `.prettierignore` (se redactan a mano).
- **`test:db` es intermitente:** a veces una llamada a Supabase dev se cuelga y un test da timeout (30 s). Es un problema conocido y no siempre cae en el mismo test: repite la ejecución antes de investigar el código. Mejora pendiente: añadir timeout o reintento en los helpers.
- **Con `cacheComponents`, Next conserva la página anterior oculta en el DOM** (Activity). Hay dos formularios a la vez tras navegar, así que los `id` fijos se duplican y `getByLabel` de Playwright da "strict mode violation": filtra con `.locator('visible=true')`. En producción no se nota para el usuario.
- **El reloj local va por delante del de la base de datos** (segundos): en los tests de integración, para "caducar" algo retrasa una hora, no un segundo.
- **En plpgsql `PERFORM` reinicia `FOUND`:** guarda `found` en una variable justo después del `SELECT INTO` (el fallo que corrigió `fix_join_with_code`).
- **Una migración aplicada no se edita:** la corrección va en otra (por eso hay `..._fix_join_with_code.sql`).
- **`useActionState` pasa `(prevState, formData)` a la acción**, también a las que se enlazan con `bind`; las de confirmar (`revokeInvite(id)`, `expelMember(calendarId, userId)`…) ignoran esos argumentos. En los tests mira `mock.calls[0][0]`, no `toHaveBeenCalledWith(id)`.
- **El PIN nunca vuelve al formulario:** las acciones que lo reciben devuelven `values.pin = ""`.
- **Al escribir ficheros con heredocs en Bash**, un apóstrofo o una comilla rara puede romper el comando entero; usa la herramienta Write o un script en un fichero.
- **`ical.js` deja los eventos con `TZID` como hora "de pared" sin zona** (aunque el archivo traiga `VTIMEZONE`): `parse-ics.ts` lee el `TZID` del parámetro y `convert-events.ts` lo convierte con `zonedLocalToUtc`, una vez por ocurrencia. Un `TZID` que `Intl` no reconoce se omite.
- **La descarga del enlace usa `node:https` con un `lookup` propio** que valida la IP al conectar (anti-SSRF, anti DNS rebinding). No la cambies por `fetch`.
- **PostgREST devuelve como mucho 1.000 filas por consulta**: en tests con más, cuenta con `{ count: "exact", head: true }`.
- **`user.upload` de user-event no llega al `FormData` de jsdom** (sustituye `input.files`): un test de un formulario con archivo no puede comprobar el archivo recibido; se comprueba en el navegador.
- **El cuerpo de las Server Actions está limitado** (`serverActions.bodySizeLimit` en `next.config.ts`, 3 MB por la importación); más que eso lo rechaza Next antes de la acción.
- **Un script de verificación no debe seguir tras un fallo:** comprueba la salida de `typecheck` antes de hacer commit.
- **Probar en un navegador real:** `playwright-cli` está instalado globalmente. Arranca la app compilada con `npx next start -p 3100`, crea el usuario de prueba por `/signup` y bórralo de `dev` al terminar. Un `check()` sobre un radio `sr-only` falla: haz clic en el círculo (`label span[aria-hidden]`).
- **jsdom no implementa `<dialog>.showModal()`:** los tests de diálogos lo simulan en un `beforeAll`.
- **Tras usar el link de prod**, vuelve a enlazar dev; si no, `db:types` o `db:push` irían contra producción.
- **`src/types/database.ts`** se regenera tras cada migración y no se formatea con Prettier.
- **Usuarios de prueba:** los tests los crean y borran solos. Si creas usuarios a mano en dev para probar, bórralos al terminar.
- La primera petición tras un despliegue en Vercel puede tardar varios segundos (arranque en frío). No lo confundas con un fallo.
- **`LayoutProps<"/ruta">` de una ruta nueva** no existe hasta que Next genera los tipos (build o `next typegen`): `typecheck` falla antes del build. En layouts nuevos tipa `children` a mano.
- **`hidden` en el `className` de `LinkButton` no oculta**: su `inline-flex` gana. Para ocultarlo por tamaño envuélvelo en un `div` (`hidden lg:block`).
- **Tests de formularios con error**: `findByLabelText` encuentra el campo antes de que llegue la respuesta de la acción; espera al mensaje (`findByText`) antes de comprobar `aria-describedby`, o el test falla de forma intermitente con la máquina cargada.
- **Cookie de un usuario borrado**: `getClaims()` valida el JWT sin consultar la base de datos, así que en `playwright-cli` sigues "con sesión" tras borrar el usuario de prueba. Limpia las cookies (`page.context().clearCookies()`) antes de registrar otro.
- **Icono de la app instalada**: iOS no lo cambia hasta volver a añadir la app a la pantalla de inicio; Android lo actualiza cuando revisa el manifest. Lo que sí se renueva al publicar es lo que guarda el service worker (`CACHE_NAME`).
- **La carpeta `.playwright-cli/`** (capturas de la herramienta) no está ignorada: bórrala al terminar o `format:check` falla.
- **Rutas interceptadas + Activity (spec 008):** al cerrar la ventana, Next guarda la ruta interceptada **oculta** en el DOM y, si se vuelve a abrir la misma URL, muestra **esa misma instancia**, con su estado y repitiendo sus efectos. Esto causó tres fallos: un `<dialog>` modal oculto pero abierto dejaba la página inerte; el éxito del guardado anterior volvía a cerrar la ventana nada más abrirla; y el detalle reaparecía en modo edición. Por eso `EventModal` cierra el diálogo y remonta su contenido (`key`) en la limpieza del efecto, y los formularios atienden cada resultado una sola vez. Cualquier ventana nueva basada en rutas necesita lo mismo.
- **Borrar desde la ventana:** `revalidatePath` vuelve a pintar la ruta interceptada del evento recién borrado. Un `notFound()` ahí convierte **toda la página** en 404, así que la ruta interceptada devuelve `<GoneEvent />` (cierra y avisa) y solo la página completa hace `notFound()`.
- **`setState` en el cuerpo de un efecto lo prohíbe el lint** (`react-hooks/set-state-in-effect`). Si hay que reiniciar estado cuando Activity oculta una ruta, hazlo en la **limpieza** del efecto, que el lint permite.
- **jsdom:** no lanza `cancel` en un `<dialog>` al pulsar Escape (dispárale `new Event("cancel", { cancelable: true })`), no tiene `scrollIntoView` (sobrescríbelo en `HTMLElement.prototype`), ni layout (simula `getBoundingClientRect`). La región de avisos (`role="status"`) siempre existe: en los tests espera al **texto** (`findByText`), no a la región.
- **`scrollIntoView` desplaza todos los contenedores**, incluida la ventana que envuelve el formulario: para mover solo una lista ajusta su `scrollTop`.
- **`not-sr-only` vuelve a permitir el salto de línea** (`white-space: normal`): si el texto debe quedar en una línea, añade `truncate` en la misma variante (`sm:truncate`).
- **Límite de Supabase Auth en `test:db`:** muchas ejecuciones seguidas, o tras pruebas en el navegador, dan `AuthApiError: Request rate limit reached` en los `beforeAll`. No es un fallo del código: espera unos minutos y lanza `npm run test:db -- --no-file-parallelism`.
- **Editar ficheros con Python en Windows:** abre con `encoding='utf-8', newline=''`. Sin `newline=''` escribe CRLF y `format:check` falla; sin `encoding` usa cp1252 y estropea las tildes (pasó en el `plan.md` de la 007).
- **Tablas temporales en funciones `SECURITY DEFINER` con `search_path = ''`:** cualifícalas como `pg_temp.nombre` y créalas `on commit drop`.
- **OAuth de Google en dev solo en el puerto 3000**: es la única URI de retorno registrada. Con `next start -p 3100` las pantallas funcionan, pero conectar una cuenta real no; para probarlas sin Google, siembra la conexión y el calendario con SQL en dev.
- **Previews de Vercel**: apuntan a la base de datos de producción con las variables de Preview, que no tienen `GOOGLE_CLIENT_ID` ni `GOOGLE_CLIENT_SECRET`; conectar Google en una preview falla. No es un fallo del código.
- **Microsoft Entra no admite cuentas personales sin directorio** (`AADSTS16000`), y crearlo exige una suscripción de Azure con tarjeta. Por eso la 007 quitó Microsoft (Enmienda 1).
- **Un evento borrado en CaFam durante una actualización** puede reaparecer hasta la siguiente (plan 009 R9): `p_read_at` protege lo cambiado, no lo borrado. No es un fallo.
- **Las cuentas conectadas en la 007 no escriben** (`can_write = false`) hasta volver a conectarlas con los permisos nuevos.
- **El CDN de Supabase Storage guarda la descarga por URL y token** (spec 012): con `storage.download()` un miembro expulsado seguía viendo la imagen. `downloadImage` pide `/storage/v1/object/authenticated/…?v=<uuid aleatorio>` con `cache: "no-store"`, así cada petición pasa por RLS (plan D5). No lo cambies por enlaces firmados ni por `download()`.
- **`now()` es el mismo en toda la transacción**: para ordenar filas insertadas en una sola llamada usa `clock_timestamp()` (lo corrigió `reserve_images_order`).
- **Los objetos del bucket no se borran con SQL**: se encolan en `image_purge_queue` y los borra `/api/images/purge`. En dev, sin la app en el puerto de `sync_app_url`, la cola crece; los tests limpian sus filas con `deleteQueuedImages`.
- **Si Google mueve un evento entre calendarios**, la sincronización lo ve como un borrado y un alta: sus imágenes se pierden (plan 012 R5, coherente con RF-18). No es un fallo.
- **Alta con imágenes desde la página completa**: tras subir, el formulario navega con `window.location.assign`, porque `router.replace` al detalle lo intercepta `@modal` y deja el formulario detrás.
- **Activity y los `input type="file"`**: tras navegar, el formulario de alta sigue oculto en el DOM con su propio `input` de archivos; en `playwright-cli` apunta al del detalle (`section[aria-label="Añadir imágenes"] input`).
- **Remitente de los correos**: Brevo no envía "en nombre de" una dirección gratuita (`@gmail.com`…) y la reescribe a `…@<id>.brevosend.com` (en prod, `alexponmon@12551706.brevosend.com`). Si "no llega" un correo que Brevo da por entregado, búscalo por `from:brevosend.com` en todo el buzón, spam incluido. Un dominio propio lo evitaría, pero cuesta dinero.
- **Tailwind 4 solo busca clases en `src/`** (`@import "tailwindcss" source("..")` en `globals.css`). Sin eso escanea todo el repositorio y convierte en CSS los ejemplos de la documentación (así se coló el azul antiguo `bg-[#…]` en producción).

- **Agenda continua (spec 016):** los centinelas `agenda-start` y `agenda-end` se observan con un `IntersectionObserver` nuevo en cada cambio de ventana; un tramo que llega tarde y ya no es contiguo se descarta. En los tests, antes de simular otra intersección espera a los efectos (`await act(async () => {})`) o el observador viejo pide un tramo que se tira.
- **`ScrollOnMount`** recibe `top: () => number` y `scrollKey`: solo vuelve a desplazar si cambia la clave, no en cada render.
- **`hyphens-auto`** en los bloques de la semana parte con guion en Safari (español); Chromium en Windows parte la palabra sin guion, como Google. No es un fallo.

- **Lectores e imágenes en repeticiones (spec 013):** `update_occurrence` les da `CF404` (bloquea la serie), así que materializar para una imagen usa `materialize_occurrence` con el secreto. Sin él, un Lector podría crear copias de la serie en cualquier fecha.
- **`deleteEvent` recibe el formulario en distinta posición** según se enlace con o sin `"modal"` (`useActionState` añade estado y formulario): búscalo con `instanceof FormData`.
- **Los tipos generados no admiten `null`** en los argumentos de las funciones: en tests, `null as unknown as string`; en las acciones, los argumentos de `planSeries*` van con `as never`.
- **`pg_timezone_names` es lento** dentro de un trigger que corre en cada fila: `series_rules_fast_tz` valida la zona con `now() at time zone`.
- **es-ES no agrupa números de cuatro cifras** (`(1000).toLocaleString("es-ES")` da "1000"): para "1.000" usa `formatCount` (`lib/comments/limits.ts`, `useGrouping: "always"`).
- **Los cursores de los comentarios usan `created_at` tal como lo devuelve Postgres** (con microsegundos): no lo pases por `Date`, o el sondeo pierde o repite comentarios.
- **`elementsFromPoint` no existe en jsdom:** `targetAt` lo tolera; en los tests de arrastre se simula en el documento.
- **El evento `close` de un `<dialog>` llega después** del cambio de estado: no decidas con él si la ventana sigue abierta; usa el estado de React.
- **Un toque produce un `click` sintético después del `pointerup`:** si se abre una ventana en el `pointerup`, ese clic la cierra. Con el dedo se crea en el `click` (`SlotLayer`) y tras un arrastre se traga el clic siguiente (`use-event-drag.ts`).
- **`touch-action`**: sin `touch-none` en el bloque levantado, el navegador desplaza y lanza `pointercancel`; la rejilla lleva `touch-pan-x touch-pan-y` para que el pellizco llegue a la app y no amplíe la página.
- **Arneses de test de las vistas:** pasa arrays estables (fuera del render); un array nuevo en cada render reinicia los cambios optimistas del contexto y el test parece no guardar.
- **iCloud empareja las repeticiones por la hora de pared de la serie** (spec 018): `ical.js` no relaciona un `RECURRENCE-ID` o `EXDATE` en UTC con una serie en `TZID` sin `VTIMEZONE`. Por eso `icloud-ics.ts` los escribe con la misma `TZID` que el `DTSTART` de la serie. El `external_id` sí va en UTC.
- **El aviso `sync_revoked` solo guarda el correo de la cuenta**: con el mismo correo en Google y como Apple ID, `getNotices` elige la conexión en `needs_reauth`.
- **La cuota de Groq es por organización, no por clave** (spec 015): 200K tokens al día y 8K por minuto por modelo, compartidos por dev, `eval:assistant` (unos 70K por ejecución) y prod si su clave está en la misma organización. Se repone a unos 140 tokens por minuto. Agotada, el asistente responde "no disponible" (503). No lances el eval más de una o dos veces al día. Si se corta (cuota, red o deteniéndolo), no borra sus usuarios: quedan `test-<uuid>@cafam.test` en dev que hay que borrar a mano.
- **Groq a veces responde 400 `tool_use_failed`** (el modelo escribe mal la llamada a la herramienta) y 413 o 5xx: el proveedor pasa entonces al modelo de reserva, como con 429. El error lleva el estado y el código de Groq, y la ruta lo registra con `console.warn("assistant unavailable: …")` para verlo en los logs de Vercel.
- **Imágenes en Groq** (spec 022): con imágenes, las herramientas fallan (nombres inventados, campos cambiados) y `json_schema` estricto coloca mal los campos; por eso la propuesta usa `json_object` con un ejemplo en el prompt. Llama 4 Scout se retiró: el modelo con visión es `qwen/qwen3.8-27b`, con 7.000 tokens de entrada por minuto: una foto de 1600 px son unos 3.200, así que una segunda imagen dentro del mismo minuto da 429 ("try again in 25s") y `visionChat` espera y reintenta. Su cuota diaria (200K) la gastan dev, `eval:schedule` (unos 40K) y prod a la vez: agotada, Groq pide esperar minutos y no se reintenta. El recuento `people` lo da el modelo y falla a veces (dijo 1 en una foto de 20 personas dentro de una conversación).
- **El `input` de "Adjuntar imagen" está oculto**: en Playwright usa `page.waitForEvent("filechooser")` y pulsa el botón, no `setInputFiles` sobre el `input`.
- **Vitest 5 oculta los `console.log` de los tests que pasan**: `eval:assistant` lleva `--silent=false` para ver el informe (en la configuración del proyecto no surte efecto).
- **Realtime añade su propio `id` a la carga del mensaje** (spec 019): en los tests compara con `toMatchObject`, no con `toEqual`.
- **Playwright sin navegadores descargados**: el `playwright-core` global no trae Chromium; usa `chromium.launch({ channel: "msedge" })` con el Edge del sistema.
- **`animation.finished` se resuelve antes del evento `onfinish`** (spec 021): `play` limpia o fija el último fotograma en `onfinish`, así que lo que se haga en `.then()` puede quedar pisado. Para que no quede nada en línea, usa `fill: "none"` en lugar de borrarlo a mano.
- **Una regla de CSS en una capa pierde ante una utilidad**: lo que deba ganar a `glass-float` o a una transición (`[data-morph]`, `[data-following]`) va fuera de `@layer`.
- **El panel del navegador oculto** pausa `requestAnimationFrame` y las animaciones, y `getBoundingClientRect` da 0: una captura lo obliga a pintar. Además, el JavaScript de la herramienta corre en un mundo aislado: parchear `Element.prototype.animate` no ve las llamadas de la app; usa `getAnimations()` o un `MutationObserver`.
- **La regla `react-hooks/refs`** prohíbe devolver un `ref` dentro del objeto que devuelve un hook: pásale el `ref` al hook (como `useFollowDrag(ref, …)`).
- **La velocidad de un gesto en los tests**: `trackVelocity` solo usa los movimientos; dos `pointermove` seguidos en jsdom dan una velocidad enorme. Para un gesto lento, suelta en el mismo punto del último movimiento.
- **En dev `pg_cron` no llega a `localhost`** (spec 020): `sync_app_url` es `http://localhost:3000` y Supabase corre en la nube, así que para probar la sincronización en dev se llama a mano a `POST /api/sync/run` con `Bearer $CRON_SECRET`. Los avisos de Google solo llegan a producción; en dev se simulan con un canal sembrado (`sync_store_channel` con un token conocido) y `curl` a `/api/sync/google-push`. Si se arranca la app con `SYNC_PUSH_URL`, se crean canales reales que apuntan a producción: bórralos al terminar (`delete from sync_channels`) y haz una pasada para cancelarlos en Google.
- **`test:db` drena lo pendiente de dev**: `sync-worker` reclama todos los calendarios vencidos para dejar el entorno sin trabajo, así que tras ejecutarlo los de la cuenta de Google de dev quedan "en curso" 10 minutos.
- **Parar `next start` en segundo plano:** detener la tarea no mata el proceso de Node y el puerto 3100 queda ocupado; mata el PID que escucha en él (`netstat -ano | grep :3100`).
- **Cabeceras en `next.config.ts`** (spec 023): cuando varias reglas ponen la misma cabecera, gana la **última** que coincide; por eso la regla global va primera y `/invite/*` y `/sw.js` después.
- **El panel del navegador oculto** no llega a pintar muchas capturas ("Screenshot timed out"): comprueba con `javascript_tool` (estilos calculados, foco) y repite la captura una vez.

- **Sesiones en la nube sin Supabase dev** (specs 024–030): se levantó un Supabase local con Docker (`npx supabase start -x studio,logflare,vector,imgproxy,edge-runtime,mailpit,supavisor`), `.env.local` y `.env.test.local` apuntando a él y `cron_secret`/`sync_app_url` creados en su Vault. `test:db` pasa entero ahí. Los tipos se regeneran con `npx supabase gen types typescript --local > src/types/database.ts`.
- **`pushState` y Next (spec 024):** funciona porque Next parchea `history.pushState`; no pases un `state` con claves `__NA` o `_N`. Tras un `pushState`, `router.refresh()` y las Server Actions usan la dirección nueva.
- **Un `insert` de varias filas con claves distintas** pone `null` en las que faltan (PostgREST): en una columna `not null` falla todo el lote. Manda siempre las mismas claves.
- **Animaciones en bucle** (Venito): `document.getAnimations()` nunca queda vacío; para saber si una transición terminó, ignora las de `iterations === Infinity` (lo hace `scripts/perf/measure.mjs`).
- **`waitForLoadState("networkidle")` tras iniciar sesión** puede no llegar nunca (el canal de tiempo real): en los scripts de Playwright espera a un elemento o un tiempo fijo.
- **Next deja un `role="alert"` propio** (anunciador de rutas): en Playwright busca los avisos dentro de su contenedor.
- **La palabra "glass"** en `src/` hace fallar la guardia de diseño, también en un comentario.
- **Reglas de prueba de series** (spec 036): escribe la RRULE como la escribe la app (`FREQ=WEEKLY;INTERVAL=1;BYDAY=TH`). Una semanal sin `BYDAY` no da repeticiones, y una no canónica hace creer a `planSeriesChange` que cambió la regla ("Solo este evento" falla).
- **El prototipo de la 030** carga Tailwind desde un CDN: sin red a ese CDN no se pinta; se interpretó leyendo su código.
- **El panel del navegador de la app no registra service workers** (spec 034): el modo sin conexión se prueba con Playwright y Edge (`context.setOffline(true)`), como en `scripts/e2e-offline.mjs`. Para mirar IndexedDB desde un script, comprueba antes `indexedDB.databases()`: abrir `cafam-offline` si no existe la crea vacía y la app ya no la actualiza.
- **Copias antiguas de calendarios traídos** (spec 038): un evento traído anterior a la ventana nunca se borra al sincronizar aunque ya no exista en el proveedor. Si "reaparece" algo borrado en Google hace tiempo, no es un fallo. **Orden de despliegue**: la migración `sync_apply_window` va a prod antes que la app (la función vieja no conoce `p_from`).
- **`eventDayKeys` guarda sus días por objeto y zona** (`WeakMap`, spec 034 RNF-2): la agenda pedía cada evento en cada día y tardaba 4 s con 2.000 eventos. Si algún día se cambia un evento en su sitio (`event.startsAt = …`), el resultado sale viejo: crea siempre un objeto nuevo.
- **En la app sin conexión, una pantalla que se lee de la cola** (como el detalle) puede quedarse vacía en cuanto se encola su propio borrado: conserva la última versión mientras se cierra (`EventScreen`).
- **Background Sync (spec 035)** solo existe en Chromium (Chrome, Edge, Android). Safari y Firefox envían al abrir la app. El service worker no puede llamar a Server Actions (su id cambia en cada despliegue): por eso existen `/api/offline/apply` e `/api/offline/image`. Tampoco tiene `document.cookie` ni el cliente de Supabase: las imágenes van con URL firmadas. Para probarlo, en Playwright con Edge basta encolar sin red, cerrar la página (no el contexto) y `context.setOffline(false)`: el evento `sync` llega sin ninguna página abierta (`scripts/e2e-offline-background.mjs`). El panel del navegador de la app no registra service workers.
- **URL firmadas de subida** (`createSignedUploadUrl`): Storage no firma un objeto que ya existe ("already exists"). Tras un corte a mitad de subida, `signed()` lo trata como ya subido (`token` y `url` nulos) y se confirma sin volver a subirlo. Solo se guarda la reserva (`reservedId`, plan D7); las URL se piden de nuevo en cada intento y nunca van a IndexedDB.
- **El IndexedDB de memoria de los tests** (`tests/unit/memory-indexeddb.ts`) no tiene `close()` en la base: un helper de test que abra `cafam-offline` a mano no debe cerrarla. En un script de Playwright, `put` en los almacenes de `cafam-offline` necesita la clave explícita (no tienen `keyPath`). Si no, lanza dentro del callback y la promesa de `page.evaluate` no termina nunca.
- **Avisos push en dev** (spec 040): `pg_cron` no llega a `localhost`; se prueba llamando a mano a `POST /api/push/run` con `Bearer $CRON_SECRET`, con las claves VAPID en el entorno **al compilar** (la pública es `NEXT_PUBLIC_`). El service worker solo se registra en producción (`next start`). Playwright sin ventana no muestra avisos: `scripts/e2e-push.mjs` abre Edge con ventana y permiso concedido; pulsar la notificación del sistema no se puede automatizar. En el iPhone los avisos solo llegan a la app instalada (iOS 16.4+) y pueden retrasarse.
- **Cambiar las claves VAPID** invalida todas las suscripciones: cada usuario tiene que volver a activar los avisos.
- **La copia se renueva cada 15 minutos**: un script que siembra datos después del registro debe borrar `cafam-offline` y recargar para que la app lea una copia entera, o no verá lo sembrado sin red.

## 11. Fuera de alcance hasta su spec

Papelera o deshacer más de una acción, compartir e integrar con el sistema (las dos últimas, en la hoja de ruta de la constitución), zona horaria por evento, sincronizar un calendario importado en las dos direcciones, verificación de email en el registro, traspaso voluntario de calendarios, exportar los datos de la cuenta, login social, Microsoft, avisos por correo o de notas, el resto de "Fuera de alcance" de la 034 y la 035 e i18n. No implementes nada de esto sin su spec aprobada. El asistente (015) está hecho y desde la 036 crea eventos y propone cambios: borrar eventos o crear series desde el asistente, guardar conversaciones o responder por voz necesitan otra spec. Las notas (028) están hechas: fecha límite por elemento, reordenar arrastrando, vencimientos en el calendario, notas de un evento y notas desde el asistente necesitan la suya.

## 12. Cómo continuar

**Lo más reciente (2026-11-19): specs 043 y 044**, cerradas en la rama `044-importar-y-actualizar-ics` (sobre la 042). Pendiente del usuario: las migraciones `ics_feeds`, `ics_import_into` e `ics_subscriptions` en prod **antes** de desplegar (además de las de la lista de abajo), `git push` y merge, y probar en el móvil la suscripción `.ics` en Google Calendar y "Mantener actualizado" con un enlace real.

**Antes (2026-11-19): specs 038 a 042**, cerradas, cada una en su rama apilada sobre la anterior (`038-sincronizacion-sin-borrar-fuera-de-ventana` → `039-busqueda-de-eventos` → `040-recordatorios-y-notificaciones` → `041-alta-en-lenguaje-natural` → `042-vistas-de-ano-y-4-dias`); la última contiene todo y `main` local ya tiene la 036 y la 037. Pendiente del usuario:

1. Migraciones a **prod antes de desplegar** (enlazar prod, `npx supabase db push`, volver a enlazar dev): `sync_apply_window` (038), `event_search` (039), `push` (040) y `views_year` (042), y las de la 023 y la 028 si aún no están.
2. Claves VAPID: `node scripts/make-vapid-keys.mjs` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Vercel (Production y Preview), y comprobar que `sync_app_url` existe en el Vault de prod (lo usa `push_trigger`).
3. `git push` de las ramas y merge a `main` en orden (o solo la 042, que las lleva todas). El service worker nuevo es `cafam-v8`.
4. Probar en el iPhone y en Android: avisos push (app instalada en iOS 16.4+), alta en lenguaje natural, búsqueda, vistas de año y 4 días; y revisar las capturas de `specs/038…042/capturas/`.
5. Lo pendiente de antes: `EVAL_PART=write npm run eval:assistant` y cierre de la 036.

**Specs 036 y 037 (2026-11-18)**, en la rama `claude/gallant-goldberg-0bzfzk`, que ya contiene `main` con las 034 y 035. La 037 está cerrada; la 036 está hecha y falta que el usuario lance `EVAL_PART=write npm run eval:assistant` contra Groq y dev, la pruebe en el iPhone con un calendario de Google y la cierre. Ninguna tiene migraciones.

**Lo más reciente (2026-11-18): spec 035 (sin conexión, fase 2)**, cerrada en la rama `035-sin-conexion-fase-2`, que ya contiene la 034 cerrada. `main` tiene las specs 024 a 033. Pendiente del usuario:

1. Revisar las capturas de `specs/034-modo-sin-conexion/capturas/` y `specs/035-sin-conexion-fase-2/capturas/`.
2. Si aún no se ha hecho: las migraciones de la 028 (`notes`, `notes_calendar_functions`) y de la 023 en **prod**. La 034 y la 035 no añaden ninguna.
3. `git push` de la rama `035-sin-conexion-fase-2` y merge a `main` (lleva también la 034). El service worker nuevo (`cafam-v7`) se instala al abrir la app con red.
4. Los recorridos con cuentas reales y dispositivos de la T12 de la 035: Google, iCloud, series con dos usuarios, el iPhone y el envío con la app cerrada en Chrome de Android y de escritorio.

Siguientes trabajos recomendados: (a) periodos contiguos ya pintados para bajar el cambio de mes por debajo de 80 ms con CPU lenta (diferido de la 024 y la 026); (b) sacar zod del JS inicial; (c) rediseñar la organización de los formularios largos (evento completo, repetición) con el estilo Nexo; (d) la spec pendiente de la 023 (la sincronización borra los eventos creados en CaFam fuera de la ventana); (e) actualizaciones mayores de herramientas sin vulnerabilidades (TypeScript 7, ESLint 10, CLI de Supabase 3), cada una con su spec porque pueden romper la compilación o el lint.


La 006 y la 008 están cerradas y en producción (2026-10-23 y 2026-10-24). La 008 añadió la migración `profile_last_view`, ya aplicada en prod.

La **007 (sincronización de Google, solo lectura, y grupos)** y la **009 (sincronización bidireccional)** están cerradas y en producción (2026-10-28 y 2026-10-29). La aplicación de Google está **publicada sin verificar** (proyecto `CaFam`, con marca, página principal y `/privacy`; sin logotipo para no tener que verificarla). En producción usa el cliente web `CaFamWeb`; en dev, `CaFam Local`.

- La **010 (renombrar a CaFam)** está cerrada y en producción (2026-10-29). Queda abierto `invites.test.ts` ("returns a 43 character token"), que falla cuando el reloj local va por detrás del de la base de datos (trampa del reloj); no es de ninguna spec.
- La **011 (rediseño visual)** está cerrada y en producción (2026-10-30), con `profile_theme` aplicada en prod.
- La **012 (imágenes)** está cerrada y en producción (2026-10-30), con sus 8 migraciones aplicadas en prod.
- La **016 (calendario al estilo Google)** está cerrada (2026-10-30). Las previews de Vercel están protegidas con su inicio de sesión: para verlas en el móvil hay que entrar en Vercel o usar "Share".
- La **013 (eventos recurrentes)** está cerrada (2026-10-31), con sus 6 migraciones aplicadas en prod.
- La **014 (comentarios)** está cerrada (2026-11-01), con sus 2 migraciones aplicadas en prod.
- La **017 (mover eventos, menú y "Deshacer")** está cerrada (2026-11-01), con sus 2 migraciones aplicadas en prod. Al soltar, cambiar el color o borrar una repetición se pregunta el alcance; "Deshacer" solo con "Solo este evento".
- La **018 (iCloud)** está cerrada (2026-11-01), con sus 2 migraciones aplicadas en prod. La comprobación con una cuenta real confirmó `MOVE` y renombrar.
- La **015 (asistente de chat)** está cerrada (2026-11-04), con la ampliación de comentarios y botón flotante (sin migraciones). La migración `assistant` y `GROQ_API_KEY` están en prod.
- La **020 (disponibilidad y sincronización rápida)** está cerrada (2026-11-09), con `busy_grid` y `sync_fast` aplicadas en prod y `SYNC_PUSH_URL` en Vercel (Production). Las pruebas en producción de Google (2 minutos o menos) e iCloud en el iPhone (15 minutos o menos) salieron bien.
- La **021 (animaciones y microinteracciones)** está cerrada (2026-11-08), sin migraciones. Tras el `git push` y el merge a `main`, queda que el usuario la pruebe en el iPhone en producción (plan R2: pellizco y desplazamiento de la semana con `touch-pan-y`) y mida el rendimiento con la CPU ralentizada; la evidencia está en su `tasks.md`.
- La **022 (eventos desde una imagen)** está cerrada (2026-11-09), sin migraciones ni variables nuevas. Queda que el usuario haga el `git push` y el merge, y la pruebe con el iPhone en producción (foto de un horario real).
- La **023 (auditoría y correcciones)** está cerrada (2026-11-12) en la rama `023-auditoria-y-correcciones`. Queda que el usuario haga el `git push`, el merge a `main` y el `db push` a prod de sus 3 migraciones. El siguiente trabajo recomendado es una spec para que la sincronización no borre los eventos creados en CaFam fuera de la ventana (primer punto de "Diferido" de la 023).
- La **019 (escritorio, móvil y tiempo real)** está cerrada (2026-11-02). Sus migraciones `live_changes` y `profile_view_options` están aplicadas en prod (2026-11-02).
- Los usuarios de prueba usan `@cafam.test`. Los antiguos del dominio anterior se borraron de dev en la spec 010 (T5), con permiso del usuario.
