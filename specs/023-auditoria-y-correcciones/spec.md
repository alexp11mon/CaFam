# Spec 023 — Auditoría y correcciones

> Estado: **Cerrada** (2026-11-12). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-10): spec, plan, tareas, implementación y cierre, sin aprobación entre fases. Se mantienen sus límites: nada sobre producción, sin dependencias nuevas, coste cero y migraciones solo en dev.

## Contexto y objetivo

Con las specs 001–022 cerradas, el usuario pidió una auditoría completa de CaFam (seguridad, bugs de lógica, rendimiento, usabilidad y accesibilidad, diseño visual y calidad del repositorio) y corregir lo encontrado. La auditoría se hizo el 2026-11-10 y el 2026-11-11 con seis revisiones en paralelo, una por eje, y una revisión de la app real en el navegador (1440 px en claro y 375 px en oscuro). Cada hallazgo de esta spec se comprobó leyendo el código o reproduciéndolo; lo que no resistió la comprobación está en "Descartado".

Esta spec no añade funciones: corrige defectos con el cambio más pequeño que los resuelve de raíz. La única novedad visible es el atajo Ctrl/⌘+Z para "Deshacer" (enmienda 9), que existe para que el "Deshacer" de la spec 017 se pueda usar con el teclado.

## Usuarios / actores

- **Usuario con sesión** (propietario, Editor o Lector) en móvil y escritorio, también solo con teclado o con lector de pantalla.
- **Visitante sin sesión** que llega a una dirección que no existe.
- **Atacante con cuenta** (el registro es abierto) que llama a las funciones de la base de datos directamente.

## Hallazgos priorizados

Severidad: **crítico** (seguridad con daño a terceros o pérdida de datos), **alto**, **medio**, **bajo**. No hay ninguno crítico confirmado.

### Altos

| Id | Eje | Hallazgo | Evidencia |
|----|-----|----------|-----------|
| H1 | Seguridad | `restore_event(p_trash_id, p_event_id)` no comprueba que `p_event_id` sea del calendario de la copia: cualquier usuario puede colgar sus comentarios e imágenes en un evento ajeno y cambiar su autor | `supabase/migrations/20261101100000_event_undo.sql:127-143` |
| H2 | Bug | Mover una repetición a otro día con "Todos los eventos" o "Este y los siguientes" no mueve la serie (la regla antigua vuelve a buscar su día) y hace desaparecer una repetición | `src/lib/recurrence/series-write.ts` (`planSeriesChange`), `quick-writes.ts:77`, `load-event.ts:112` |
| H3 | Bug | "Todos los eventos" aplica el cambio en milisegundos: si la repetición editada y el inicio de la serie están en horarios distintos (verano e invierno), la serie queda una hora desplazada | `src/lib/recurrence/series-write.ts:140,220` |
| H4 | Usabilidad | No hay página 404 ni de error propia: se ve la de Next en inglés, sin marco ni salida (comprobado en el navegador con `/dashboard/nope` y `/nope`) | no existe `not-found.tsx`, `error.tsx` ni `global-error.tsx` en `src/app` |

### Medios

| Id | Eje | Hallazgo | Evidencia |
|----|-----|----------|-----------|
| M1 | Seguridad | Sin cabeceras de seguridad globales: la app se puede enmarcar en otra web (clickjacking sobre "Unirme" o borrar) | `next.config.ts:14-44` |
| M2 | Seguridad | `assistant_busy` devuelve las horas de todos los calendarios donde la persona es miembro, también los de un tercero que no ha consentido; `grid_busy` (spec 020, D13) ya lo acota | `20261102100000_assistant.sql:130-134` frente a `20261108100000_busy_grid.sql:91` |
| M3 | Bug | Mover de día un evento que empieza entre las 23:46 y las 23:59 le cambia la hora a las 23:45, y Alt+↓ lo mueve hacia atrás | `src/lib/calendar/drag.ts:99` |
| M4 | Bug | Convertir en serie un evento con comentarios y sin imágenes deja los comentarios en la fila de la serie, donde ninguna repetición los muestra | `src/app/dashboard/events/actions.ts:117-129` |
| M5 | Bug | `getEventsInRange` no pagina: con más de 1.000 eventos en el rango, PostgREST corta sin error y faltan los últimos días | `src/lib/calendar/queries.ts:472-482` |
| M6 | Rendimiento | Abrir un evento hace de 7 a 10 consultas en serie (ventana, hoja del móvil y tarjeta) | `src/app/dashboard/events/load-event.ts:48-66`, `card-actions.ts:37-43` |
| M7 | Accesibilidad | La confirmación "¿Descartar los cambios?" no recibe el foco ni se anuncia | `src/components/calendar/event-modal.tsx:291-306` |
| M8 | Accesibilidad | "Deshacer" sustituye a la confirmación de borrado, pero con teclado hay que tabular todo el calendario en 10 s para llegar al botón | `src/components/ui/toast.tsx`, `src/lib/hooks/use-event-keys.ts:102-105` |
| M9 | Accesibilidad | No hay enlace "Saltar al contenido": unos diez tabuladores por página en escritorio (WCAG 2.4.1) | `src/components/shell/app-frame.tsx:43-45` |
| M10 | Diseño | En el móvil, el título de cada pantalla secundaria sale dos veces seguidas: en la cabecera y como `h1` (visto en Mis calendarios, Ajustes, Asistente y Cuentas conectadas) | `top-bar.tsx` y el `h1` de cada página |
| M11 | Diseño | Incoherencias en las pantallas secundarias: radios en el azul del sistema, botones a todo el ancho solo en Ajustes, dos pesos para el mismo título de sección, lista de miembros sin avatares (la constitución los pide), etiquetas al mismo nivel que el dato, un botón sin `press`, tres radios de tarjeta y glifos de texto donde hay iconos propios | ver RF-25 a RF-33 |

### Bajos

| Id | Eje | Hallazgo | Evidencia |
|----|-----|----------|-----------|
| B1 | Seguridad | Carrera en el límite de intentos de `join_with_code`: una ráfaga concurrente multiplica los 5 intentos | `20261022100400_fix_join_with_code.sql:28-75` |
| B2 | Seguridad | `CRON_SECRET` se compara sin tiempo constante en tres rutas | `api/cron/keep-alive/route.ts:12`, `api/sync/run/route.ts:16`, `api/images/purge/route.ts:11` |
| B3 | Privacidad | Sin `robots`: portada, login, registro y privacidad son indexables en una app personal | `src/app/layout.tsx` |
| B4 | Rendimiento | La agenda, el mini calendario y el sondeo de comentarios gastan una oleada de más por lecturas que podrían ir en paralelo | `agenda-actions.ts:33`, `mini-month-actions.ts:26`, `lib/comments/queries.ts:92-144` |
| B5 | Accesibilidad | La letra del atajo sobre la vista elegida no llega a 4,5:1 con cinco acentos (rojo 3,01) | `view-toolbar.tsx:252` (`text-on-accent/70`) |
| B6 | Accesibilidad | El cajón del móvil no tiene botón "Cerrar" (la hoja "Más" sí) | `nav-drawer.tsx:52-106` |
| B7 | Usabilidad | El registro no dice el mínimo de la contraseña hasta que falla | `signup-form.tsx:50-56` |
| B8 | Calidad | `invites.test.ts` compara la caducidad con el reloj local y falla si va por detrás del de la base de datos | `tests/integration/invites.test.ts:122-124` |
| B10 | Calidad | `.playwright-cli/` no está ignorada (rompe `format:check`, trampa de AGENTS §10) y hay un aviso de lint permanente por una variable sin usar | `.gitignore`, `tests/integration/event-images.test.ts:623` |
| B9 | Diseño | Detalles: estado vacío de un grupo distinto, párrafo de 1.000 px en Cuentas conectadas, contadores sin `tabular-nums`, botón que cambia de ancho al guardar y tres recetas para el contorno del punto de color | ver RF-34 a RF-38 |

## Requisitos funcionales (criterios de aceptación en EARS)

### Seguridad

- RF-1: SI `restore_event` recibe un `p_event_id` que no pertenece al calendario de la copia guardada, ENTONCES EL SISTEMA responderá `CF404` y no escribirá nada.
- RF-2: EL SISTEMA devolverá en `assistant_busy` solo los eventos de los calendarios propios de cada persona y los que creó en calendarios donde sigue siendo miembro, como `grid_busy`.
- RF-3: CUANDO lleguen a la vez varios intentos de `join_with_code` del mismo usuario o para el mismo ID, EL SISTEMA los atenderá de uno en uno, de modo que el límite de fallos no se supere.
- RF-4: EL SISTEMA responderá en todas las rutas con `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`; `/invite/*` conservará `no-referrer` y `/sw.js` su política propia.
- RF-5: EL SISTEMA pedirá a los buscadores que no indexen ninguna página (`robots: noindex, nofollow`).
- RF-6: EL SISTEMA comparará `CRON_SECRET` en tiempo constante en `/api/cron/keep-alive`, `/api/sync/run` y `/api/images/purge`, con las mismas respuestas que hoy.

### Series y eventos

- RF-7: CUANDO el usuario mueva una repetición a otra fecha (arrastrando, con el teclado o en el formulario) sin cambiar la regla y elija "Todos los eventos", EL SISTEMA desplazará la serie entera esos días, de modo que la repetición movida quede en la fecha elegida y la regla siga a la fecha nueva (el día de la semana, el día del mes o el mes).
- RF-8: CUANDO lo haga con "Este y los siguientes", EL SISTEMA empezará la serie nueva en la fecha elegida con la regla desplazada, y la serie anterior acabará antes de la repetición movida.
- RF-9: CUANDO el usuario cambie la hora o la fecha de una repetición con "Todos los eventos", EL SISTEMA guardará la serie a la hora de reloj elegida aunque la repetición editada y el inicio de la serie estén en horarios distintos (verano e invierno).
- RF-10: CUANDO el usuario mueva un evento a otro día sin cambiarle la hora (mes, Alt+← →), EL SISTEMA conservará su hora exacta, también si empieza entre las 23:46 y las 23:59.
- RF-11: SI un evento no puede moverse 15 minutos más tarde sin salir del día, ENTONCES EL SISTEMA lo dejará donde está en lugar de moverlo hacia atrás.
- RF-12: CUANDO el usuario convierta en serie un evento suelto que tiene comentarios, EL SISTEMA los conservará visibles en la primera repetición, como ya hace con las imágenes.
- RF-13: EL SISTEMA devolverá todos los eventos del rango pedido aunque pasen de 1.000.

### Rendimiento

- RF-14: CUANDO se abra un evento (ventana, página o tarjeta), EL SISTEMA pedirá en paralelo las lecturas que no dependen unas de otras.
- RF-15: EL SISTEMA pedirá en paralelo la zona horaria y los calendarios al cargar un tramo de la agenda o un mes del mini calendario, y los miembros y el rol junto a los comentarios en cada sondeo.

### Páginas de error

- RF-16: CUANDO se pida una dirección que no existe o un recurso ajeno, EL SISTEMA mostrará una página en español con la marca, "No encontramos esta página" y un enlace "Ir al calendario".
- RF-17: SI una página falla al pintarse, ENTONCES EL SISTEMA mostrará "Algo ha fallado" en español con "Reintentar" e "Ir al calendario", también si falla el marco raíz.

### Accesibilidad

- RF-18: EL SISTEMA ofrecerá como primer elemento enfocable del panel un enlace "Saltar al contenido", visible solo al recibir el foco, que lleva el foco al contenido.
- RF-19: CUANDO aparezca "¿Descartar los cambios?", EL SISTEMA pondrá el foco en "Seguir editando".
- RF-20: MIENTRAS un aviso ofrezca "Deshacer", EL SISTEMA deshará la acción al pulsar Ctrl+Z o ⌘+Z, salvo que se esté escribiendo en un campo.
- RF-21: EL SISTEMA mostrará Ctrl/⌘+Z en la ayuda de atajos (?).
- RF-22: EL SISTEMA ofrecerá en el cajón del móvil un botón "Cerrar".
- RF-23: EL SISTEMA mostrará la letra del atajo de la vista elegida con un contraste de 4,5:1 o más en los seis acentos y los dos temas.
- RF-24: EL SISTEMA mostrará "Mínimo 8 caracteres" bajo el campo de la contraseña nueva en el registro, el cambio de contraseña y la recuperación, enlazado al campo para los lectores de pantalla.

### Diseño visual

- RF-25: MIENTRAS la pantalla mida 768 px o menos, EL SISTEMA mostrará el título de cada pantalla del panel una sola vez (en la cabecera), dejando el `h1` solo para lectores de pantalla.
- RF-26: EL SISTEMA pintará los radios de "conservar o borrar" en tinta y con el tamaño de las casillas.
- RF-27: EL SISTEMA mostrará los botones de guardar de Ajustes con su ancho natural, como en el resto de pantallas.
- RF-28: EL SISTEMA usará el mismo peso (`font-semibold`) en todos los títulos de sección.
- RF-29: EL SISTEMA mostrará el avatar de cada persona en la lista de miembros.
- RF-30: EL SISTEMA mostrará en gris secundario las etiquetas y metadatos de las fichas de Compartir, Unirme y la cuenta conectada.
- RF-31: EL SISTEMA dará a "Continuar a Google" la misma respuesta al pulsar que al resto de botones.
- RF-32: EL SISTEMA usará el mismo radio y relleno en todas las tarjetas de lista (avisos, calendarios sin propietario y calendarios traídos).
- RF-33: EL SISTEMA usará los iconos propios en lugar de glifos de texto para volver, quitar una imagen y subir o bajar un grupo.
- RF-34: EL SISTEMA mostrará el estado vacío de un grupo como los demás estados vacíos.
- RF-35: EL SISTEMA limitará a un ancho de lectura los párrafos de Cuentas conectadas.
- RF-36: EL SISTEMA usará cifras tabulares en los contadores de invitaciones, juntar e importar.
- RF-37: EL SISTEMA mantendrá el ancho de "Guardar nombre" de un grupo mientras guarda.
- RF-38: EL SISTEMA usará el mismo contorno para el punto o la barra de color de un calendario en todas las listas.

### Calidad

- RF-39: EL SISTEMA comprobará la caducidad de una invitación en `invites.test.ts` sin depender del reloj de la máquina.

- RF-40: EL SISTEMA ignorará `.playwright-cli/` en git y en Prettier, y `npm run lint` no avisará de variables sin usar en los tests.

## Requisitos no funcionales

- Sin dependencias, servicios ni variables de entorno nuevas (P6, P2).
- Migraciones nuevas solo en dev; ninguna aplicada se edita.
- Las guardias (`design-tokens.test.ts`, `no-secrets.test.ts`, `project-name.test.ts`) y los tests de las specs anteriores siguen en verde, sin silenciar ni borrar ninguno.
- Toda pantalla tocada cumple P9 en claro y oscuro.

## Enmienda 9 de la constitución (propuesta por esta spec)

La sección "Interacción del calendario" dice que los únicos atajos con modificador son Ctrl/⌘+C, Ctrl/⌘+V y Alt + flechas. Se añade **Ctrl/⌘+Z para "Deshacer"** mientras el aviso lo ofrece. Motivo: desde la enmienda 5, "Deshacer" sustituye a la confirmación de borrado, y P9 exige que todo se pueda usar con el teclado; hoy el botón queda al final del orden de tabulación y solo dura 10 s. Es el atajo que cualquier usuario espera y no cambia el alcance de "Deshacer" (solo la última acción). Aprobada de antemano con esta spec.

## Diferido

| Hallazgo | Motivo |
|----------|--------|
| Un evento creado desde CaFam fuera de la ventana de sincronización (más de 12 meses) se borra de CaFam en la siguiente lectura, con sus imágenes y comentarios (`sync_apply_events_v2.sql:61-65`) | El borrado de lo que sale de la ventana es RF-25 de la spec 007. Arreglarlo (borrar solo lo que solapa la ventana) deja copias antiguas que ya no se actualizan: es una decisión de producto que cambia una spec cerrada. Necesita spec propia. **Es el pendiente más importante.** |
| `events.created_by` lo elige el cliente (un Editor puede falsear "Creado por") | La propia app escribe un autor distinto del llamante al convertir un evento en serie (`actions.ts:133`); un trigger que lo fuerce rompería ese flujo. Necesita diseño. |
| La cuota del asistente se salta con peticiones en paralelo y no cuenta las fallidas | Contarlas antes de responder contradice "solo cuentan las respondidas" (spec 015, D9), y los clientes no pueden borrar su fila si falla. |
| `request_recovery` permite bloquear la recuperación de otra persona | Inherente a limitar por cuenta sin limitar por IP; no hay arreglo pequeño. |
| Las reservas de imágenes sin confirmar no cuentan su tamaño real durante 1 h | Riesgo bajo y el arreglo toca los límites de la spec 012. |
| La lectura por rango no usa índice (la política RLS es opaca al planificador) | Sin `EXPLAIN` ni medida real; con el volumen de una familia no se nota. El arreglo sin migración añade una oleada. |
| La página del calendario lee `profiles` cuatro veces y Ajustes cinco | Van en paralelo: no añaden tiempo, solo peticiones. Unificarlo es un refactor sin efecto visible. |
| Objetivos táctiles de 18–24 px en la vista mes | La altura la fija la spec 016 (como Google Calendar); cambiarla es rediseñar el mes. |
| CSP completa (scripts y estilos) | Necesita nonce para `THEME_SCRIPT` y probar todo Next con ella; esta spec solo pone `frame-ancestors`. |
| Plazo y reintento en los helpers de `test:db` | Un reintento automático taparía fallos reales; el plazo solo cambia un cuelgue por un fallo. Se queda como trampa documentada. |
| `vite-tsconfig-paths` redundante y `vitest.config.ts` cargado como CommonJS | Son avisos sin efecto hoy; quitar el plugin cambia dependencias y exige aprobación (P6). Pendiente de aprobación. |
| Aviso de lint en `event-form.tsx:103` (`window.location.assign`) | Es deliberado (trampa de §10) y quitarlo exigiría silenciar la regla, que esta spec no hace. |
| Barra de escribir del asistente como banda opaca | La spec 022 la hizo opaca a propósito porque la propuesta se veía a través; el cristal volvería a transparentarla. |

## Descartado (no resistió la comprobación)

- **Botón de enviar sin nombre accesible** (lo sugería el árbol del navegador integrado): `SwapLabel` deja visible y sin `aria-hidden` el texto activo; es un artefacto de la herramienta.
- **Anchos máximos distintos entre pantallas** (`xl`, `2xl`, `5xl`): responden al contenido (formulario, lectura, rejilla).
- **Falta `loading.tsx`**: las páginas usan `<Suspense>` con esqueletos propios.
- **`ical.js` en todas las rutas del panel**: real, pero sin medida y la pantalla principal lo necesita.
- **Mensajes `assistant` puestos por el cliente en el hilo**: autoinyección; las herramientas van atadas a la sesión.
- **Hora ambigua de octubre en `toInstant`**: coherente con y sin salto rápido; caso demasiado raro.

## Fuera de alcance

Funciones nuevas, cambios de identidad visual, dependencias, cualquier acción sobre producción y lo listado en "Diferido".

## Riesgos

- Los cambios en series (RF-7 a RF-9) tocan la lógica más delicada: se cubren con tests puros con fechas concretas a los dos lados del cambio de hora.
- Las cabeceras nuevas no deben romper el OAuth de Google ni el service worker: se comprueban en el navegador.
- `assistant_busy` cambia lo que ve el asistente de otras personas: menos datos, nunca más.

## Criterios de finalización

- Todos los RF con su test o su prueba en `tasks.md`.
- P8 en verde con la salida reportada, `test:db` incluido.
- Capturas de las pantallas tocadas en móvil y escritorio, en claro y oscuro.
- AGENTS.md y la constitución (enmienda 9) actualizados.

## Dudas abiertas

Ninguna que bloquee. Lo diferido queda a decisión del usuario.
