# Tasks 034 — Modo sin conexión

> Estado: **Aprobadas** (2026-11-17). El usuario pidió hacerlas todas seguidas, con un commit por tarea.

Spec: `specs/034-modo-sin-conexion/spec.md`. Plan: `specs/034-modo-sin-conexion/plan.md`.

Cada tarea se hace con el test primero (rojo → verde) y no se cierra sin la verificación obligatoria (P8):

```
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Además, `npm run test:db` en las tareas que tocan acceso a datos (T4, T5) y prueba manual a ≤ 768 px y en escritorio en las de interfaz (T8 a T12). Rama: `034-modo-sin-conexion`.

## Tareas

- [x] T1 Calcular el rango y fundir la copia (`range.ts`, `snapshot.ts`, puros)
  Evidencia: `offline-range` y `offline-snapshot` en verde (15 tests con `to-view-events`, que gana `ownColor`). typecheck, lint (solo el aviso previo de `event-form.tsx`), format:check y build en verde. `npm test`: 2794 tests, 2 fallos intermitentes en `assistant-fab` (carga perezosa con la máquina ocupada) que pasan al repetirlo solo.
  Hecho cuando: `npm test -- offline-range offline-snapshot` en verde. Los tests cubren:
  - rango de hoy −1 mes a hoy +3 meses en la zona del perfil, y fin de mes y cambio de año;
  - si una fecha cae dentro;
  - fundir una ventana releída: sustituye los eventos de su rango, quita los que desaparecen y marca `partial` los nuevos sin descripción;
  - consulta de eventos por rango;
  - copia de otro formato descartada.

  Cubre: RF-1, RF-5, RF-11, RF-13, RNF-4 | Módulo: range, snapshot

- [x] T2 Fundir y aplicar la cola de cambios (`outbox.ts`, `overlay.ts`, puros)
  Evidencia: `offline-outbox` y `offline-overlay` en verde (16 tests). typecheck, lint, format:check y build en verde; `npm test` 2809/2810, con el mismo fallo intermitente de `assistant-fab` (ajeno a esta spec).
  Hecho cuando: `npm test -- offline-outbox offline-overlay` en verde. Los tests cubren:
  - orden;
  - fusión de varios cambios de la misma entidad (base del primero, datos del último);
  - crear + borrar = nada; crear + cambiar = un crear;
  - dependencias (cambios de la misma entidad y elementos de una nota creada sin conexión);
  - `applyPending` sobre eventos, repeticiones, notas y elementos, con la marca `pending`.

  Cubre: RF-26, RF-28, RF-37, RF-40, RF-42, RF-43, RF-49 | Módulo: outbox, overlay

- [x] T3 Detectar conflictos y comprobar límites (`conflict.ts`, `limits.ts`, puros)
  Evidencia: `offline-conflict` y `offline-limits` en verde (todo `offline-`: 45 tests). El orden de una lista no pasa por `conflict.ts`: `applyOfflineChange` lo aplica siempre (se prueba en T5). typecheck, lint, format:check y build en verde; `npm test` 2826/2826 tras dar 5 s a la carga perezosa del chat en `assistant-fab.test.tsx` (commit `fix` aparte).
  Hecho cuando: `npm test -- offline-conflict offline-limits` en verde. Los tests cubren:
  - servidor = mía → aplicado; servidor = base → aplicar; si no, conflicto;
  - borrado por otro; borrado mío sobre uno cambiado;
  - campos de nota;
  - listas elemento a elemento: elementos distintos sin conflicto y el mismo elemento con conflicto;
  - el orden nunca entra en conflicto (decisión del usuario);
  - `partial` sin descripción en la base (R6);
  - límites de 500 notas y 200 elementos, y validación de evento con los esquemas de siempre.

  Cubre: RF-36, RF-41, RF-50 a RF-55 | Módulo: conflict, limits

- [x] T4 Leer la copia completa en el servidor (`loadOfflineSnapshot`)
  Evidencia: `npm run test:db -- offline-snapshot` en verde (3 tests: copia de Ana con su rol de Editor en el calendario de Luis, repeticiones calculadas con descripción y resumen, nada del calendario de Sam ni emails, imágenes, comentarios u "Ocupado"); `offline-actions.test.ts` comprueba `unauthenticated` sin redirigir. `test:db` completo: 50 archivos, 555 tests en verde. typecheck, lint (solo el aviso previo de `event-form.tsx`), format:check, `npm test` y build en verde.
  Hecho cuando: `npm run test:db -- offline-snapshot` en verde. Los tests cubren:
  - devuelve perfil, calendarios con rol y sincronización, categorías, grupos, personas, preferencias, eventos del rango (repeticiones calculadas, descripción, autor y resumen) y notas con elementos, solo de lo que el usuario ve por RLS;
  - no incluye imágenes, comentarios, "Ocupado", emails ni credenciales;
  - sin sesión responde `unauthenticated` sin redirigir.

  Cubre: RF-1, RF-2, RF-3, RF-66 | Módulo: offline-actions (D13)

- [x] T5 Aplicar un cambio enviado sin conexión (`applyOfflineChange`)
  Evidencia: `npm run test:db -- offline-apply` en verde (15 tests: crear con id del navegador y repetirlo, cambiar un suelto, uno `partial` que conserva la descripción del servidor, cambiar y borrar una repetición con `this`, borrar dos veces, los tres conflictos con `force`, Lector, expulsado, calendario de Google, `CF429` de 200 elementos, notas y elementos con el orden sin conflicto y una nota compartida escrita por un Lector). `offline-actions.test.ts`: sin sesión → `unauthenticated` y cambio no válido → `rejected`. `npm test` (incluye `notes`): 2829/2829. typecheck, lint (aviso previo), format:check y build en verde.
  Desviación del plan: las escrituras de notas van directas en `offline-writes.ts` (con `getNoteErrorMessage` y `NOTE_MESSAGES` de siempre) en lugar de extraer `note-writes.ts`, para no tocar las acciones de Notas, que siguen igual. `createSingle` gana el `id` opcional y `seriesValues` se exporta. Un cambio de un calendario del que el usuario fue expulsado es `rejected` ("No tienes permiso"), no "borrado por otro". Los textos del modo sin conexión empiezan en `lib/offline/messages.ts`.
  Este paso también incluye `createSingle` con `id` y `note-writes.ts` extraído de `notes/actions.ts` sin cambiar su comportamiento.
  Hecho cuando: `npm run test:db -- offline-apply` y `npm test -- notes` en verde. Los tests cubren:
  - crear con id del navegador y repetirlo = un solo evento;
  - cambiar un suelto y una repetición con `this`;
  - borrar;
  - conflicto y `force`;
  - borrado por otro;
  - Lector o expulsado → `rejected` con mensaje en español;
  - calendario traído → `rejected`;
  - `CF429` → `rejected`;
  - notas y elementos (añadir, cambiar, mover y borrar);
  - sin sesión → `unauthenticated`.

  Cubre: RF-19, RF-21, RF-23, RF-31 a RF-34, RF-41, RF-46, RF-47, RF-50 a RF-55, RF-58, RF-63, RNF-5 | Módulo: offline-actions, event-writes, note-writes

- [x] T6 Guardar en IndexedDB y detectar la conexión (`db.ts`, `connection.ts`, `useConnection`)
  Evidencia: `offline-db` (5 tests con un IndexedDB en memoria escrito en el test) y `offline-connection` (6 tests con relojes simulados) en verde. La cola se guarda entera bajo una clave (`enqueue` la funde entera), y `conflicts` y `rejected` por `changeId`. El anuncio es `ConnectionAnnouncer` (`components/offline/`), que no dice nada al pintar y anuncia cada cambio. typecheck, lint (aviso previo), format:check, `npm test` (2840/2840) y build en verde.
  Hecho cuando: `npm test -- offline-db offline-connection` en verde. Los tests cubren:
  - almacenes `meta`, `snapshot`, `outbox`, `conflicts` y `rejected` con un IndexedDB en memoria escrito en el test (R9);
  - borrar todo;
  - cuenta distinta → borrado;
  - estado sin conexión por `offline`, por un fallo de red y por un plazo de 10 s;
  - comprobación cada 30 s;
  - anuncio en `aria-live`.

  Cubre: RF-10, RF-18, RF-27, RF-57, RF-64 | Módulo: db, connection

- [x] T7 Encolar sin red y enviar al volver (`with-outbox.ts`, `flush.ts`)
  Evidencia: `offline-with-outbox` (7 tests) y `offline-flush` (7 tests) en verde. `withOutbox(write, change)` también encola si quedan cambios anteriores en la cola, para que lleguen en orden (RF-40); un `change` nulo es una escritura que necesita red. La cola en memoria vive en `queue-store.ts` (con `useSyncExternalStore` en T8); "Deshacer" devuelve la cola a como estaba si no ha entrado nada después. El candado es una sola ejecución por pestaña más `navigator.locks` entre pestañas; otra pestaña puede reenviar un cambio y el servidor responde "aplicado" (RF-41). typecheck, lint (aviso previo), format:check, `npm test` (2854/2854) y build en verde.
  Hecho cuando: `npm test -- offline-with-outbox offline-flush` en verde. Los tests cubren:
  - con red llama a la acción y no encola;
  - sin red o con un fallo de red encola, guarda y devuelve un éxito con "Deshacer" `offline`;
  - `flush` envía en orden y clasifica `applied`, `conflict`, `rejected` (con sus dependientes), `retry` (se para y conserva) y `unauthenticated` (se para y conserva);
  - candado de una sola instancia (R4);
  - aviso "N cambios sincronizados".

  Cubre: RF-30, RF-38, RF-40, RF-44, RF-46, RF-47, RF-49, RF-56, RF-63 | Módulo: with-outbox, flush

- [x] T8 Conectar la app con red al modo sin conexión
  Evidencia: `offline-provider` (4), `connection-badge` (4), `pending-mark` (2), `offline-event-form` (2), `offline-note-editor` (1) y `offline-describe` (5) en verde, y `event-form` y `notes-ui` sin cambios. typecheck, lint (aviso previo), format:check, `npm test` (305 archivos, 2872 tests) y build en verde. La prueba manual en el navegador se hizo en el recorrido de la T9 (ver allí).
  Cómo quedó: `describe.ts` (puro) convierte cada escritura en un cambio con la base de la copia; `snapshot-store.ts` guarda la copia en memoria (base de los cambios y fusión de las ventanas que relee la página, D9); `event-actions.ts` y `note-actions.ts` envuelven las acciones de siempre (`quickChange`, `deleteForUndo`, `pasteEvent`, `deleteFromDetail`, el formulario y la ventana rápida, y todas las de Notas) con `withOutbox`; sin red, lo que necesita red responde "Necesita conexión" en vez de colgarse. `CalendarClient` y `NotesBoard` pintan la cola encima (`pendingView`, `pendingNotes`); el token de deshacer `offline` lo atiende `useUndoToast`; `router.refresh()` solo con red. `AppFrame` recibe `userId` para `OfflineProvider`. La navegación completa sin red va por `loadPage` (`lib/offline/navigate.ts`), para que la vea el service worker.
  Incluye `OfflineProvider` en `AppFrame`, `ConnectionBadge`, `PendingMark`, las escrituras de eventos y notas envueltas en `withOutbox`, y el "Deshacer" `offline`.
  Hecho cuando: `npm test -- offline-provider connection-badge pending-mark event-form note-editor` en verde. Prueba manual en el navegador, abriendo el calendario y cortando la red con la herramienta: arrastrar, editar y borrar un evento y marcar un elemento de una lista se ven al instante con "Pendiente de enviar". Al volver la red llegan a dev, sale "N cambios sincronizados" y la copia se relee cada 15 min o al abrir.

  Cubre: RF-4, RF-5, RF-6, RF-9, RF-19, RF-20, RF-21, RF-22, RF-26, RF-28, RF-29, RF-30, RF-32, RF-33, RF-34, RF-37, RF-38, RF-39, RF-45 | Módulo: offline-provider, connection-badge, pending-mark, EventForm, QuickCreate, NoteEditor, NoteForm, NotesBoard, useUndoToast

- [x] T9 Abrir la app sin conexión desde `/offline`
  Evidencia: `offline-app` (3), `offline-router` (5), `calendar-props` (2), `sw-no-data` (9, con la redirección `?from=`, `/offline?from=` desde la caché y `refresh-offline`) y `offline-provider` (5, con R10) en verde. typecheck, lint (aviso previo de `event-form.tsx`), format:check, `npm test` (308 archivos, 2886 tests) y build en verde. Prueba en un navegador real con `scripts/e2e-offline.mjs` (Edge con Playwright y `context.setOffline`; el panel del navegador de la app no registra service workers), 13 pasos en verde: registro, copia en IndexedDB y service worker, evento creado con red y fundido en la copia, enlace de la app con red sin red (R10: carga `/dashboard/notes` en la app sin conexión), calendario en semana con "Sin conexión · datos de las…", cambio a Mes y dos meses adelante, fuera del rango "Estas fechas no están disponibles sin conexión", detalle del evento, Ajustes "Necesita conexión", nota y evento nuevos con "Pendiente de enviar", y al volver la red los dos llegan al servidor y la app vuelve a la página real. Sin copia sale la pantalla "Sin conexión" de siempre (`offline-app` y `ui-base`). La prueba destapó dos fallos corregidos aquí: la ventana del servidor no se fundía en la copia si la página llegaba antes que la lectura de IndexedDB, y un enlace sin red podía colgar la navegación de Next (R10). El usuario de prueba se borra al terminar.
  Incluye: `sw.js` con la redirección `?from=`, `refresh-offline` y `cafam-v6`; `OfflineApp`; `offline-router`; `offline-sources`; y `calendar-props.ts` extraído de `calendar/page.tsx`.
  Hecho cuando: `npm test -- offline-app offline-router calendar-props sw` en verde y prueba manual con `npx next start -p 3100`, el modo sin conexión del navegador y la app recargada:
  - se ve el calendario en la vista recordada;
  - se cambia de vista y de periodo;
  - fuera del rango sale "Estas fechas no están disponibles sin conexión";
  - el detalle se abre;
  - se crea un evento;
  - Notas funciona;
  - sin copia, sale la pantalla "Sin conexión" de siempre;
  - R10 comprobado.

  Cubre: RF-7, RF-8, RF-11, RF-12, RF-13, RF-15, RF-16, RF-31 | Módulo: sw.js, offline-app, offline-router, offline-sources, calendar-props

- [ ] T10 Deshabilitar lo que necesita red y cerrar sesión con cuidado
  Incluye `gates.ts`, `NAV_ITEMS.needsNetwork`, `readOnlyReason`, `RepeatField`, `SeriesScopeDialog`, el selector de calendario de la nota, `EventImages`, `EventComments` y `SignOutGuard` (también en borrar la cuenta).
  Hecho cuando: `npm test -- offline-gates sign-out-guard series-scope-dialog repeat-field read-only` en verde. Los tests cubren:
  - textos "Necesita conexión", "Disponible con conexión" y "Sin conexión no se puede escribir en Google/iCloud";
  - solo "Solo este evento" sin red;
  - aviso de RF-61 con el número de pendientes;
  - IndexedDB vacío tras cerrar sesión o borrar la cuenta;
  - botón deshabilitado sin red (D12).

  Cubre: RF-14, RF-17, RF-23, RF-24, RF-25, RF-35, RF-60, RF-61, RF-62, RF-65 | Módulo: gates, sign-out-guard

- [ ] T11 Resolver conflictos y revisar cambios no enviados, y actualizar `/privacy`
  Incluye `ChangesSheet`, abierto desde el indicador, y la sección "Datos guardados en este dispositivo" de `/privacy`.
  Hecho cuando: `npm test -- changes-sheet privacy` en verde. Los tests cubren:
  - las dos versiones;
  - "Conservar la mía" (`force`), "Conservar la suya", "Volver a crearlo", "Descartar mi cambio", "Borrarlo igualmente" y "Conservar el suyo";
  - "Cambios no enviados" con título, fecha, motivo, contenido y "Descartar";
  - conflictos que sobreviven a recargar;
  - `/privacy` con qué se guarda, cuánto tiempo y cuándo se borra.

  Cubre: RF-48, RF-50, RF-51, RF-52, RF-53, RF-55, RF-57, RF-58, RF-59, RF-67 | Módulo: changes-sheet, /privacy

- [ ] T12 Validar la spec RF por RF y cerrarla
  Hecho cuando: en este `tasks.md` hay una tabla RF-1 a RF-67 con el test o la prueba que cubre cada uno, más:
  - recorrido con dos usuarios de prueba en dev (modo avión, crear, cambiar y borrar eventos y notas, cerrar y reabrir sin red, recuperarla, los conflictos de RF-50 a RF-55 y cerrar sesión con pendientes);
  - RNF-2 (≤ 2 s con la CPU 4×) y RNF-3 (≤ 10 MB) medidos y anotados;
  - capturas a 390, 768 y 1440 px en claro y oscuro con Violeta y Ámbar (`scripts/screenshots.mjs`) del indicador, las marcas, un conflicto y "Cambios no enviados";
  - nada de "Fuera de alcance" implementado;
  - AGENTS.md y README al día;
  - usuarios de prueba borrados.

  La prueba en el iPhone (Safari y app instalada) queda para el usuario en producción.

  Cubre: todos, RNF-1 a RNF-8 | Módulo: validación

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T1, T4 |
| RF-2 | T4 |
| RF-3 | T4 |
| RF-4 | T8 |
| RF-5 | T1, T8 |
| RF-6 | T8 |
| RF-7 | T9 |
| RF-8 | T9 |
| RF-9 | T8 |
| RF-10 | T6 |
| RF-11 | T1, T9 |
| RF-12 | T9 |
| RF-13 | T1, T9 |
| RF-14 | T10 |
| RF-15 | T9 |
| RF-16 | T9 |
| RF-17 | T10 |
| RF-18 | T6 |
| RF-19 | T5, T8 |
| RF-20 | T8 |
| RF-21 | T5, T8 |
| RF-22 | T8 |
| RF-23 | T5, T10 |
| RF-24 | T10 |
| RF-25 | T10 |
| RF-26 | T2, T8 |
| RF-27 | T6 |
| RF-28 | T2, T8 |
| RF-29 | T8 |
| RF-30 | T7, T8 |
| RF-31 | T5, T9 |
| RF-32 | T5, T8 |
| RF-33 | T5, T8 |
| RF-34 | T5, T8 |
| RF-35 | T10 |
| RF-36 | T3 |
| RF-37 | T2, T8 |
| RF-38 | T7, T8 |
| RF-39 | T8 |
| RF-40 | T2, T7 |
| RF-41 | T3, T5 |
| RF-42 | T2 |
| RF-43 | T2 |
| RF-44 | T7 |
| RF-45 | T8 |
| RF-46 | T5, T7 |
| RF-47 | T5, T7 |
| RF-48 | T11 |
| RF-49 | T2, T7 |
| RF-50 a RF-53 | T3, T5, T11 |
| RF-54 | T3, T5 |
| RF-55 | T3, T5, T11 |
| RF-56 | T7 |
| RF-57 | T6, T11 |
| RF-58 | T5, T11 |
| RF-59 | T11 |
| RF-60 a RF-62 | T10 |
| RF-63 | T5, T7 |
| RF-64 | T6 |
| RF-65 | T10 |
| RF-66 | T4 |
| RF-67 | T11 |

Todos los módulos del plan aparecen: range y snapshot (T1); outbox y overlay (T2); conflict y limits (T3); offline-actions (T4, T5); event-writes y note-writes (T5); db y connection (T6); with-outbox y flush (T7); offline-provider, connection-badge y pending-mark (T8); sw.js, offline-app, offline-router, offline-sources y calendar-props (T9); gates y sign-out-guard (T10); changes-sheet y /privacy (T11).

## Dudas abiertas

Ninguna.
