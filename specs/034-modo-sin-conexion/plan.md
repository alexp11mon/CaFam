# Plan 034 — Modo sin conexión

> Estado: **Aprobado** (2026-11-17).

Spec de origen: `specs/034-modo-sin-conexion/spec.md` (aprobada el 2026-11-17; RNF-4 reformulado al hacer este plan). Constitución: `docs/constitution.md`.

## Resumen de arquitectura

Sincronización propia, sin dependencias ni migraciones. Funciona en tres capas:

1. **Copia**: una copia de los datos del usuario en **IndexedDB**, que leen dos acciones de servidor nuevas.
2. **Cola**: una **cola de cambios** (outbox) en IndexedDB, que se aplica encima de la copia para pintar.
3. **Envío**: un bucle que manda la cola, cambio a cambio, a una acción de servidor que **reutiliza las escrituras de siempre** (`createSingle`, `updateSingle`, `changeOccurrence`, `deleteSingle`, `deleteOccurrences` y las de Notas) y detecta los conflictos comparando tres versiones.

Con conexión, todo sigue como hoy: la cola solo entra en juego sin red, o cuando una escritura falla por la red.

Sin conexión, el service worker redirige cualquier navegación a **`/offline?from=<ruta>`**. Esa página es estática y su HTML no lleva datos. Ahí corre la **app sin conexión**: el mismo marco, el mismo calendario y las mismas notas, alimentados desde IndexedDB y con un enrutador local.

```
Con red ─ página (RSC) ─ props ─┬─ CalendarClient / NotesBoard / NoteEditor
                                │       └─ escrituras: acción de servidor (igual que hoy)
                                └─ OfflineProvider ─ copia (loadOfflineSnapshot cada ≤15 min
                                                     + ventanas que la página ya relee)
Sin red ─ SW ─ 302 /offline?from=… ─ OfflineApp (IndexedDB)
                                      ├─ copia + cola ─ applyPending ─ mismas vistas
                                      └─ escrituras ─ withOutbox ─ cola (IndexedDB)
Vuelve la red ─ flush ─ applyOfflineChange (servidor, RLS, por cambio, en orden)
                        → applied | conflict | rejected | retry | unauthenticated
```

## Módulos y responsabilidades

### Lógica pura (`src/lib/offline/`, testeada con Vitest)

- `range.ts`: calcula el rango de la copia (desde hoy −1 mes hasta hoy +3 meses, en la zona del perfil) y si una fecha cae dentro. No lee nada. Cubre: RF-1, RF-11.
- `snapshot.ts`: tipos de la copia y su versión de formato. Reúne una lectura completa, o una ventana releída por la página, con la copia guardada (D9), y consulta eventos por rango. No guarda nada. Cubre: RF-1 a RF-6, RF-13.
- `outbox.ts`: tipos de cambio y reglas de la cola:
  - añadir un cambio;
  - fundir los cambios de una misma entidad, conservando la base del primero y los datos del último;
  - crear seguido de borrar no deja nada;
  - el orden;
  - las dependencias (los cambios de una entidad dependen de los anteriores sobre ella; los de un elemento, de la creación de su nota).

  No envía nada. Cubre: RF-27, RF-40, RF-42, RF-43, RF-49.
- `overlay.ts`: `applyPending(copia, cola)` devuelve los eventos y las notas tal como se ven, con la marca `pending`. Cubre: RF-26, RF-28, RF-37.
- `conflict.ts`: comparación de tres versiones (D5):
  - `same(servidor, mía)` → ya aplicado;
  - `same(servidor, base)` → se aplica;
  - si no, conflicto.

  Para las listas compara elemento a elemento (RF-54, RF-55). La usan el servidor y el navegador. Cubre: RF-41, RF-50 a RF-55.
- `limits.ts`: comprueba en la copia los límites de Notas (500 y 200) y las validaciones de evento con los esquemas zod de siempre. Cubre: RF-36.
- `gates.ts`: qué está disponible sin conexión:
  - destinos de navegación que necesitan red;
  - alcances de serie permitidos;
  - motivo de solo lectura de los calendarios traídos;
  - pasar una nota de personal a compartida.

  Cubre: RF-17, RF-23 a RF-25, RF-35.

### Navegador

- `lib/offline/db.ts`: un envoltorio mínimo con promesas sobre la API nativa de IndexedDB (D2). Base `cafam-offline` con los almacenes `meta`, `snapshot`, `outbox`, `conflicts` y `rejected`. Solo lee y escribe; no aplica reglas de negocio. Cubre: RF-1 a RF-3, RF-27, RF-57, RF-60, RF-62, RF-64, RF-65.
- `lib/offline/connection.ts` + `lib/hooks/use-connection.ts`: estado de la conexión, que combina `navigator.onLine`, los fallos de red de las acciones y un plazo de 10 s (`withTimeout`). Mientras no hay red, comprueba cada 30 s con un `fetch` sin caché a `/manifest.webmanifest`. Anuncia los cambios en una región `aria-live`. Cubre: RF-9, RF-10, RF-18, RF-38.
- `lib/offline/with-outbox.ts`: `withOutbox(acciónDeServidor, describirCambio)`. Con red, llama a la acción como hoy. Sin red, o si la llamada falla por la red o por el plazo, valida, encola, guarda y devuelve un resultado de éxito local, con un "Deshacer" de tipo `offline`. No decide conflictos. Cubre: RF-19 a RF-22, RF-26, RF-27, RF-30 a RF-34.
- `lib/offline/flush.ts`: bucle de envío:
  - un cambio cada vez, en orden;
  - clasifica cada resultado;
  - mueve los cambios a `conflicts` o `rejected`, y saca de la cola los dependientes de un rechazado;
  - se para si la sesión no es válida.

  Se lanza al volver la red y al abrir la app con red. Cubre: RF-38 a RF-41, RF-44 a RF-47, RF-49, RF-56, RF-63.
- `components/offline/offline-provider.tsx` (dentro de `AppFrame`, también en la app sin conexión):
  - dueño del estado de copia, cola, conflictos y rechazados;
  - lanza las lecturas de la copia (al abrir, cada 15 min con la pestaña visible, y recogiendo las ventanas y notas que la página ya relee) y `flush`;
  - comprueba que la copia es de la cuenta con sesión;
  - pide al service worker que refresque la app sin conexión (D14).

  Cubre: RF-4 a RF-6, RF-38, RF-39, RF-45, RF-64.
- `components/offline/connection-badge.tsx`: en `TopBar` y `TopNav`. Muestra "Sin conexión · datos de las HH:MM" (con la fecha si la copia no es de hoy) y el número de pendientes, conflictos y rechazados. Abre la hoja de cambios. Cubre: RF-9, RF-29, RF-57.
- `components/offline/changes-sheet.tsx` (`Sheet`): "Cambios no enviados" (contenido legible, "Descartar") y conflictos (las dos versiones; "Conservar la mía"/"Conservar la suya", "Volver a crearlo"/"Descartar mi cambio", "Borrarlo igualmente"/"Conservar el suyo"). Cubre: RF-48, RF-50 a RF-53, RF-55, RF-57 a RF-59.
- `components/offline/pending-mark.tsx`: icono propio con el texto "Pendiente de enviar", en `EventBlock`, en el detalle, en `NoteCard` y en la nota. Cubre: RF-28, RF-37.
- `components/offline/sign-out-guard.tsx`:
  - envuelve "Cerrar sesión" en `MoreSheet` y `TopNav`;
  - si hay pendientes o conflictos, pide confirmación con el texto de RF-61;
  - borra IndexedDB antes de llamar a `signOutAction`;
  - sin red, deshabilita el botón con "Necesita conexión" (D12).

  Borrar la cuenta borra también IndexedDB antes de la acción. Cubre: RF-60 a RF-62, RF-65.
- `app/offline/page.tsx` + `components/offline/offline-app.tsx`:
  - la página sigue siendo estática y monta un componente de cliente;
  - si hay copia de una cuenta, pinta `AppFrame` con el acento, el tema y el nombre de la copia, y la pantalla que pida `from`: calendario (vista recordada), detalle, alta y edición de un evento, Notas, nueva nota y una nota;
  - si no hay copia, la pantalla "Sin conexión" de siempre;
  - un rango fuera de la copia muestra el aviso de RF-11.

  Cubre: RF-7, RF-8, RF-11 a RF-16.
- `components/offline/offline-router.tsx`: en la app sin conexión, un único escuchador de clics en el documento intercepta los enlaces del mismo origen a las rutas soportadas y navega con `pushState`/`popstate`, sin red (D16). Una ruta no soportada muestra el aviso "Necesita conexión". Cubre: RF-8, RF-16, RF-17.
- `lib/offline/offline-sources.ts`: las implementaciones sin red de lo que `CalendarClient` recibe como acciones:
  - `loadWindow`, `loadAgendaEvents` y `loadMonthMarks` leen la copia;
  - `loadBusy` devuelve vacío;
  - `saveLastView` no hace nada;
  - las preferencias de visibilidad solo cambian en memoria;
  - el detalle se arma desde la copia (`detailFromSnapshot`).

  Cubre: RF-8, RF-13, RF-15.
- `lib/calendar/calendar-props.ts`: la construcción de las props de `CalendarClient` que hoy está en `page.tsx` (grupos con `organizeGroups`, `canCreate`, calendarios escribibles, próximos eventos), sacada a una función pura que usan la página y la app sin conexión. No lee nada. Cubre: RF-7, RF-8.

### Servidor

- `app/dashboard/offline-actions.ts`, con dos acciones:
  - `loadOfflineSnapshot()`: lectura completa con RLS en paralelo (perfil, calendarios con rol y sincronización, categorías, grupos, personas, preferencias, eventos del rango con `getEventsInRange` más descripción, autor y resumen de la repetición, y notas con sus elementos).
  - `applyOfflineChange(cambio, { force })`: valida con zod (frontera de confianza), lee el estado actual con la sesión, compara con `conflict.ts` y escribe con las funciones de siempre. Nunca usa la clave secreta.

  Cubre: RF-1 a RF-3, RF-41, RF-46, RF-47, RF-50 a RF-55, RF-58, RF-63, RNF-5.
- `app/dashboard/events/event-writes.ts`: `createSingle` acepta un `id` opcional creado en el navegador (D6). Cubre: RF-19, RF-41.
- `app/dashboard/notes/note-writes.ts`: las escrituras de Notas, extraídas de `notes/actions.ts` a funciones auxiliares sin `"use server"` (como `quick-writes.ts`), para que las compartan las acciones de siempre y `applyOfflineChange`. `createNote` acepta un `id` del navegador. Cubre: RF-31 a RF-34.

### Cambios en lo que ya existe

- `public/sw.js`, con `CACHE_NAME` `cafam-v6`:
  - si falla una navegación de `/dashboard/*`, responde con una redirección a `/offline?from=<ruta y búsqueda>`;
  - el resto de navegaciones sigue igual;
  - nuevo mensaje `refresh-offline`, que vuelve a precachear `/offline` y sus recursos.

  Cubre: RF-7, RF-12.
- `EventForm`, `QuickCreate`, el detalle y las acciones rápidas (`quickChange`, `deleteForUndo`, `pasteEvent`, `deleteFromDetail`, duplicar) pasan por `withOutbox`. `NoteEditor`, `NoteForm` y `NotesBoard` también, con un módulo de cliente que envuelve las acciones de Notas. Cubre: RF-19 a RF-22, RF-31 a RF-34.
- El "Deshacer" de `useUndoToast` atiende el tipo `offline`, que quita el cambio de la cola. Cubre: RF-30.
- `RepeatField`, `SeriesScopeDialog`, `readOnlyReason`, el selector de calendario de una nota, `NAV_ITEMS` (con `needsNetwork`), `EventImages` y `EventComments` consultan `useConnection()` y `gates.ts`. Cubre: RF-14, RF-17, RF-23 a RF-25, RF-35.
- `/privacy`: sección "Datos guardados en este dispositivo". Cubre: RF-67.

## Modelo de datos

Sin cambios en Postgres ni migraciones. Todo vive en IndexedDB (`cafam-offline`, versión de formato `1`).

- `meta` (una fila): `{ format: 1, userId, savedAt (ISO), range: {from, to}, today }`. Si `userId` no coincide con la sesión, se borra todo (RF-64). Si cambia `format`, se descarta la copia, pero no la cola.
- `snapshot` (una fila por tipo):
  - `profile`: zona, acento, tema, vista recordada, fines de semana, duración y nombre;
  - `calendars`: id, nombre, color, propietario, rol, `synced` y proveedor;
  - `categories`, `groups`, `people`, `preferences`;
  - `events: OfflineEvent[]`;
  - `notes: OfflineNote[]`.
- `OfflineEvent`: lo de `CalendarEventRecord` (también el id de repetición `<serie>_<fecha>`) más `rowId`, `description`, `createdByName`, `seriesSummary` y `seriesChanged`. Puede llevar `partial: true` (D9).
- `OfflineNote`: lo de `notes` más `items: {id, text, done, position}[]` y el nombre del calendario.
- `outbox` (clave autoincremental = orden), `OutboxEntry`: `{ seq, changeId (uuid), createdAt, change: OfflineChange }`. Tipos de `OfflineChange`:
  - `event.create {id, data}`
  - `event.update {id, base, data}`: `id` puede ser de una repetición, que se escribe solo con alcance `this`
  - `event.delete {id, base}`
  - `note.create {id, kind, title, calendarId}`
  - `note.update {id, base, fields}`
  - `note.delete {id, base}`
  - `item.add {noteId, id, text, position, done}`
  - `item.update {noteId, id, base, change}`
  - `item.delete {noteId, id, base}`
  - `item.move {noteId, positions}`

  `data` y `fields` usan los mismos esquemas zod que con conexión. `base` son los campos tal como estaban en la copia cuando se hizo el primer cambio.
- `conflicts`: `{ changeId, change, server: estado actual | null (borrado) }`.
- `rejected`: `{ changeId, change, reason, title, date }`.
- Tamaño: 2.000 eventos y 500 notas de 20 elementos son unos 4 MB en JSON, por debajo de los 10 MB de RNF-3. Se mide en las tareas.

## Contratos e interfaces

- `loadOfflineSnapshot(): Promise<{ snapshot } | { error } | { unauthenticated: true }>`. Sin sesión no redirige: devuelve `unauthenticated`.
- `applyOfflineChange(change: unknown, options?: { force?: boolean }): Promise<ApplyResult>`. Posibles resultados:
  - `{ status: "applied", id }`: escrito o ya estaba así (idempotencia, RF-41);
  - `{ status: "conflict", server: Entity | null }`: el servidor difiere de la base y de la mía. `null` = borrado por otro (RF-51). Para `event.delete`, el evento modificado (RF-52);
  - `{ status: "rejected", reason }`: permisos (RLS, `CF404`, 0 filas con `canSeeEvent`), calendario traído, límite (`CF429`) o validación. `reason` en español, con los mensajes de siempre (`getCalendarErrorMessage`, `getNoteErrorMessage`);
  - `{ status: "retry" }`: error de red o 5xx de Supabase;
  - `{ status: "unauthenticated" }`.

  Con `force`, se escribe sin comparar con la base (RF-58), y `event.create` de "Volver a crearlo" lleva un id nuevo.
- `withOutbox<A>(action, toChange): (...args) => Promise<Result>`. Mismo resultado que la acción envuelta, más `{ offline: true, undo: { kind: "offline", changeId } }`.
- Mensajes de `postMessage` al service worker: `{ type: "refresh-offline" }`.
- Textos visibles (todos en `lib/offline/messages.ts`):
  - "Sin conexión · datos de las HH:MM"
  - "Estas fechas no están disponibles sin conexión"
  - "Disponible con conexión"
  - "Necesita conexión"
  - "Sin conexión no se puede escribir en Google" / "… en iCloud"
  - "Pendiente de enviar"
  - "N cambios sincronizados"
  - "Cambios no enviados"
  - el aviso de cerrar sesión de RF-61
  - los botones de conflicto de RF-50 a RF-52

## Flujo principal paso a paso

1. **Con red.** El usuario abre CaFam. `OfflineProvider` comprueba `meta.userId` (RF-64), lanza `loadOfflineSnapshot` si la copia tiene más de 15 min o es de otra cuenta, y la guarda (RF-1 a RF-4). Después pide `refresh-offline` al service worker. Cada vez que la página relee su ventana o sus notas (tiempo real, foco, escritura), el proveedor la funde en la copia (RF-5, RNF-4). Mientras la pestaña está visible, relee cada 15 min (RF-6).
2. **Se va la red con la app abierta.** Una acción tarda más de 10 s o falla por la red: `connection` pasa a sin conexión (RF-18), el indicador aparece y se anuncia (RF-9, RF-10). El usuario arrastra un evento: `withOutbox` encola un `event.update` con la base de la copia, lo guarda (RF-27) y devuelve éxito. La vista lo pinta con `applyPending` y la marca (RF-26, RF-28), y el aviso ofrece "Deshacer" (RF-30).
3. **Navega sin red, o abre la app sin red.** La navegación falla, el service worker redirige a `/offline?from=/dashboard/notes`, y `OfflineApp` lee IndexedDB y pinta Notas con su marco (RF-7, RF-16). Desde ahí, el enrutador local cambia entre calendario, detalle y notas sin recargar (D16). Lo que necesita red sale deshabilitado con su motivo (RF-17, RF-24, RF-25, RF-35).
4. **Vuelve la red.** El evento `online` o la comprobación periódica pone la conexión en verde y `flush` envía la cola en orden (RF-38, RF-40). Cada cambio va a `applyOfflineChange`, que escribe con RLS (RNF-5):
   - `applied` → fuera de la cola;
   - `conflict` → a `conflicts` (RF-50 a RF-55); el resto sigue (RF-56);
   - `rejected` → a `rejected`, junto con sus dependientes (RF-47, RF-49);
   - `retry` → se para y lo reintenta en la siguiente comprobación (RF-46);
   - `unauthenticated` → se para y conserva todo (RF-63).
5. **Fin del envío.** Aviso "N cambios sincronizados" (RF-44), `router.refresh()` y nueva lectura de la copia (RF-45).
6. **Conflictos.** El usuario abre la hoja desde el indicador y elige:
   - "Conservar la mía" → `applyOfflineChange(…, { force: true })` (RF-58);
   - "Conservar la suya" → se descarta el cambio (RF-59).

   Lo que no resuelva sigue guardado (RF-57).
7. **Cerrar sesión.** Con pendientes, se pide confirmación (RF-61). Al confirmar, se borra IndexedDB y se llama a `signOutAction` (RF-60, RF-62).

## Decisiones técnicas

- **D1:** Sincronización propia con IndexedDB, cola y acciones de servidor. Descartados PowerSync, ElectricSQL, RxDB, Replicache y Zero: son dependencias nuevas (P6), varios piden un servicio externo (P2) y obligarían a rehacer la capa de datos y a llevar al cliente reglas que hoy aplican RLS y el servidor (repeticiones, Google e iCloud, límites). Cubre: RNF-5, RNF-6.
- **D2:** API nativa de IndexedDB con un envoltorio de unas 60 líneas. Descartados `localStorage` (5 MB, síncrono, solo texto) y la Cache API para datos (sin consultas ni transacciones), y también `idb` (dependencia nueva). Cubre: RF-1 a RF-3, RF-27, RNF-3.
- **D3:** La app sin conexión vive en `/offline` (estática, sin datos en el HTML), a la que el service worker **redirige** con `?from=`. Descartado guardar el HTML de las páginas con sesión: rompe la privacidad decidida en la spec 001 (R6) y queda viejo. Descartado también servir el HTML de `/offline` en la URL original, porque Next comprueba la URL canónica de la carga RSC. Cubre: RF-7, RF-12.
- **D4:** Con conexión no cambia nada: la cola solo se usa sin red o tras un fallo de red (`withOutbox`). Descartado mandar siempre todo por la cola, que tocaría el camino de todas las escrituras (formularios con `redirect`, modo ventana, Google, deshacer) con mucho riesgo de regresión. Cubre: RF-19 a RF-22, RF-31 a RF-34.
- **D5:** Conflictos por **comparación de tres versiones** (base, mía, servidor) campo a campo, con la misma función en el servidor y en el navegador. Si el servidor ya es igual a mi versión, el cambio cuenta como aplicado, y eso da la idempotencia sin tabla de cambios ya aplicados. Descartado comparar `updated_at`: daría falsos conflictos al repetir un envío, `note_items` no lo tiene y sus microsegundos son una trampa conocida. Cubre: RF-41, RF-50 a RF-55.
- **D6:** Ids creados en el navegador (`crypto.randomUUID()`) para los eventos y las notas creados sin conexión (los elementos ya los tenían desde la 028). Si la fila ya existe y es igual, cuenta como aplicada. Descartado dejar que el servidor genere el id, porque un reenvío crearía duplicados. Cubre: RF-41, RF-43.
- **D7:** Una llamada a `applyOfflineChange` por cambio, en serie. Descartado mandar un lote en una sola acción: complica el resultado parcial, los dependientes y el `maxDuration`. Con pocos cambios por sesión sin red, la latencia no importa. Cubre: RF-40, RF-49, RF-56.
- **D8:** Las repeticiones se expanden siempre en el servidor (`getEventsInRange` con `ical.js`), y la copia guarda las repeticiones ya calculadas. Descartado llevar `ical.js` al navegador: hoy solo se usa en el servidor y pesa. Por eso sin conexión solo existe "Solo este evento" (RF-23), que se envía con `changeOccurrence(scope: "this")` o `deleteOccurrences`. Cubre: RF-13, RF-23, RF-24.
- **D9:** La copia se pone al día con:
  - una lectura completa al abrir la app (si tiene más de 15 min);
  - una lectura cada 15 min con la pestaña visible;
  - fundiendo las ventanas y las notas que la página ya relee por tiempo real o por foco.

  Los eventos que aparecen en una ventana fundida y no estaban en la copia quedan `partial` (sin descripción ni autor) hasta la siguiente lectura completa. Descartada una tabla de cambios en Postgres para leer solo lo cambiado, porque exige migración, triggers y limpieza (RNF-4, acordado con el usuario). Cubre: RF-4 a RF-6, RNF-4.
- **D10:** La vista sin conexión es una función pura, `applyPending(copia, cola)`, y la fusión de cambios (RF-42, RF-43) es otra, `outbox.ts`. Descartado modificar la copia en el sitio con cada cambio: perdería la base de los conflictos y el "Deshacer". Cubre: RF-26, RF-30, RF-42, RF-43.
- **D11:** El estado de la conexión combina `navigator.onLine`, el fallo o el plazo de 10 s de las acciones y, sin red, una comprobación cada 30 s a `/manifest.webmanifest` sin caché. Descartado fiarse solo de `navigator.onLine`, que dice "en línea" con una wifi sin salida. Cubre: RF-9, RF-18, RF-38.
- **D12:** "Cerrar sesión" exige conexión. Sin red, el botón sale deshabilitado con "Necesita conexión", porque la cookie de sesión es `httpOnly` y no se puede borrar desde el navegador: si se borrara IndexedDB y la sesión siguiera viva, el dispositivo quedaría "con sesión" y sin datos. Descartado borrar solo los datos locales sin red. Cubre: RF-60 a RF-62.
- **D13:** `applyOfflineChange` y `loadOfflineSnapshot` comprueban la sesión sin redirigir y responden `unauthenticated`. `requireActionUser` lanzaría un `redirect` a `/login` en mitad del bucle. Cubre: RF-63.
- **D14:** Tras cada carga con red del panel, `OfflineProvider` envía al service worker `refresh-offline`, que vuelve a precachear `/offline` y sus recursos. Así la app sin conexión se corresponde con el último despliegue sin tener que subir `CACHE_NAME` cada vez. Descartado depender solo del `install` del service worker, que solo ocurre cuando cambia `sw.js`. Cubre: RF-7.
- **D15:** Las condiciones de lo que se puede hacer sin conexión están en `gates.ts`, que leen los componentes con `useConnection()`. `readOnlyReason` recibe la conexión. Descartado repartir `if (offline)` por cada componente sin una tabla común, porque no se podría testear en bloque. Cubre: RF-17, RF-23 a RF-25, RF-35.
- **D16:** En la app sin conexión, un escuchador de clics en el documento convierte los enlaces a rutas soportadas en navegación local. Descartado cambiar cada `Link`, `CalendarLink` y `EventBlock` por un componente nuevo, porque son decenas de sitios. Y dejar que Next recargue la página con cada enlace pasaría cada vez por el service worker con una recarga completa. Cubre: RF-8, RF-16.
- **D17:** Los formularios con `useActionState` (`EventForm`, `QuickCreate`, `NoteForm`) reciben una acción envuelta en `withOutbox`, que valida con los mismos esquemas zod y, sin red, responde `{ done }` como el modo ventana de la spec 008. Descartado un formulario aparte para el modo sin conexión, que duplicaría la validación y la interfaz. Cubre: RF-19, RF-20, RF-31.

## Trazabilidad RF → módulo

| RF | Módulos / decisiones |
|----|---------------------|
| RF-1 | `range`, `snapshot`, `db`, `loadOfflineSnapshot` (D9) |
| RF-2 | `snapshot`, `db`, `loadOfflineSnapshot` |
| RF-3 | `snapshot`, `db`, `loadOfflineSnapshot` |
| RF-4 | `offline-provider` (D9) |
| RF-5 | `offline-provider`, `snapshot` (fusión de ventanas, D9) |
| RF-6 | `offline-provider` (D9) |
| RF-7 | `sw.js`, `offline-app`, `calendar-props` (D3, D14) |
| RF-8 | `offline-app`, `offline-router`, `offline-sources` (D16) |
| RF-9 | `connection`, `connection-badge` |
| RF-10 | `connection` (región `aria-live`) |
| RF-11 | `range`, `offline-app` |
| RF-12 | `offline-app`, `sw.js` |
| RF-13 | `offline-sources` (`detailFromSnapshot`), `snapshot` |
| RF-14 | `EventImages`, `EventComments` con `useConnection` |
| RF-15 | `offline-sources` (preferencias en memoria) |
| RF-16 | `offline-app`, `offline-router` |
| RF-17 | `gates`, `NAV_ITEMS.needsNetwork`, `offline-router` (D15) |
| RF-18 | `connection` (D11) |
| RF-19 | `with-outbox`, `EventForm`/`QuickCreate`, `createSingle` con id (D6, D17) |
| RF-20 | `with-outbox`, `EventForm` (D17) |
| RF-21 | `with-outbox`, `outbox` (`event.update` con `calendarId`) |
| RF-22 | `with-outbox` sobre las acciones rápidas |
| RF-23 | `gates`, `SeriesScopeDialog`, `applyOfflineChange` (D8) |
| RF-24 | `gates`, `RepeatField`, `SeriesScopeDialog` (D8) |
| RF-25 | `gates`, `readOnlyReason` |
| RF-26 | `overlay` (D10) |
| RF-27 | `db`, `outbox` |
| RF-28 | `overlay`, `pending-mark` |
| RF-29 | `connection-badge` |
| RF-30 | `with-outbox`, `useUndoToast` (tipo `offline`) |
| RF-31 | `with-outbox`, `NoteForm`, `note-writes` (D6) |
| RF-32 | `with-outbox`, `NoteEditor` |
| RF-33 | `with-outbox`, `NoteEditor`/`Checklist` |
| RF-34 | `with-outbox`, `NotesBoard`/`NoteEditor` |
| RF-35 | `gates`, selector de calendario de la nota |
| RF-36 | `limits` |
| RF-37 | `overlay`, `pending-mark` |
| RF-38 | `connection`, `flush`, `offline-provider` |
| RF-39 | `offline-provider`, `flush` |
| RF-40 | `outbox`, `flush` (D7) |
| RF-41 | `conflict`, `applyOfflineChange` (D5, D6) |
| RF-42 | `outbox` (D10) |
| RF-43 | `outbox` (D10) |
| RF-44 | `flush` |
| RF-45 | `flush`, `offline-provider` |
| RF-46 | `flush`, `applyOfflineChange` (`retry`) |
| RF-47 | `applyOfflineChange` (`rejected`), `flush` |
| RF-48 | `changes-sheet` |
| RF-49 | `outbox` (dependencias), `flush` |
| RF-50 | `conflict`, `applyOfflineChange`, `changes-sheet` (D5) |
| RF-51 | `conflict`, `changes-sheet` |
| RF-52 | `conflict`, `changes-sheet` |
| RF-53 | `conflict`, `changes-sheet` |
| RF-54 | `conflict` (elemento a elemento) |
| RF-55 | `conflict`, `changes-sheet` |
| RF-56 | `flush` |
| RF-57 | `db` (`conflicts`), `connection-badge` |
| RF-58 | `changes-sheet`, `applyOfflineChange` (`force`) |
| RF-59 | `changes-sheet` |
| RF-60 | `sign-out-guard`, `db` (D12) |
| RF-61 | `sign-out-guard` |
| RF-62 | `sign-out-guard`, `db` |
| RF-63 | `flush`, `applyOfflineChange` (D13) |
| RF-64 | `offline-provider`, `db` |
| RF-65 | `sign-out-guard` (en borrar cuenta), `db` |
| RF-66 | `loadOfflineSnapshot` (lo que no lee), `snapshot` |
| RF-67 | `/privacy` |

RNF-1 → D11 y envío solo con la app abierta. RNF-2 → `offline-app` (medido). RNF-3 → modelo de datos (medido). RNF-4 → D9. RNF-5 → `applyOfflineChange` con RLS. RNF-6 → D1, D2. RNF-7 → `components/offline/*` con `components/ui`. RNF-8 → `lib/offline/messages.ts`.

## Riesgos y mitigaciones

- **R1: La app sin conexión no coincide con el último despliegue** (HTML y trozos de JS viejos en la caché). Mitigación: el `refresh-offline` de D14, `CACHE_NAME` `cafam-v6`, y la versión de formato en `meta`: una copia de otro formato se descarta y se vuelve a leer con red.
- **R2: Trozos de JS cargados con `lazy()` que no están precacheados** (por ejemplo, el chat). Mitigación: la app sin conexión no monta el asistente (RF-17), y el precacheo de `/offline` recoge los trozos que importa su página. Se comprueba en las tareas con el modo avión y una caché vacía.
- **R3: Safari borra el almacenamiento del sitio** (falta de espacio, o 7 días sin abrir una web que no está instalada). Mitigación: la app se comporta como sin copia (RF-12), y `/privacy` lo explica. Se recomienda usarla instalada.
- **R4: Activity y las rutas interceptadas.** Las páginas ocultas siguen montadas y podrían lanzar `flush` dos veces. Mitigación: un solo `OfflineProvider` en `AppFrame` y un candado en memoria y en IndexedDB (`meta.flushing` con fecha) para que solo una pestaña o instancia envíe.
- **R5: Dos pestañas abiertas con la misma cuenta.** Mitigación: el candado de R4, y IndexedDB es transaccional. La otra pestaña lee la cola al recuperar el foco.
- **R6: Eventos `partial` tras fundir una ventana (D9).** Al editarlos sin conexión, su descripción no se conoce. Mitigación: la base de un evento `partial` no incluye la descripción y el cambio no la toca si el usuario no la escribe. El detalle muestra "Descripción disponible con conexión".
- **R7: El reloj del dispositivo es incorrecto** y el rango de la copia se mueve mal. Mitigación: el rango lo fija el servidor en `meta.today` y `meta.range`, y sin conexión no se recalcula.
- **R8: Un cambio que la base de datos rechaza por una regla que el navegador no conoce** (por ejemplo, 100 excepciones en la serie). Mitigación: RF-47, con el mensaje de siempre.
- **R9: Las pruebas con IndexedDB en jsdom.** Mitigación: la lógica es pura y se testea sin IndexedDB. `db.ts` se prueba con una implementación en memoria mínima escrita en el propio test (sin `fake-indexeddb`, que sería una dependencia), y el flujo completo, en el navegador con `playwright-cli` y el modo sin conexión de la herramienta.
- **R10: Una navegación de Next a una ruta RSC sin red podría quedarse colgada en lugar de recargar.** Mitigación: `withTimeout` y el estado sin conexión hacen que `CalendarLink` y los enlaces de Notas fuercen `window.location.assign` sin red, lo que pasa por el service worker. Se comprueba en la primera tarea de interfaz.

## Dudas abiertas

Resuelta por el usuario al aprobar el plan (2026-11-17):

- Cambiar el orden de los elementos de una lista (Subir/Bajar) **no** cuenta como "cambiar el mismo elemento" para RF-55: el orden se aplica sobre el actual, sin preguntar, ignorando los elementos que ya no existan.
