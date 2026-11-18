# Tasks 035 — Modo sin conexión, fase 2

> Estado: **Aprobadas** (2026-11-17). El usuario pidió hacerlas todas seguidas, con un commit por tarea.

Spec: `specs/035-sin-conexion-fase-2/spec.md`. Plan: `specs/035-sin-conexion-fase-2/plan.md`.

Cada tarea se hace con el test primero (rojo → verde). Ninguna se cierra sin la verificación obligatoria (P8):

```
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Además:

- `npm run test:db` en las tareas que tocan acceso a datos: T3, T6, T7 y T8;
- prueba manual a ≤ 768 px y en escritorio en las tareas de interfaz: T10 a T12.

Rama: `035-sin-conexion-fase-2`, creada desde la de la 034 una vez cerrada.

## Tareas

- [x] T1 Ampliar la cola y sus esquemas con series, comentarios e imágenes (`outbox.ts`, `schemas.ts`)
  Hecho cuando: `npm test -- offline-outbox offline-schemas` en verde. Los tests cubren:
  - los tipos nuevos `series.update`, `series.delete`, `comment.add`, `comment.update`, `comment.delete`, `image.add` e `image.delete`, y `repeat` en `event.create` y `event.update`;
  - fundir un comentario añadido y luego editado (llega uno, con el último texto) y uno añadido y luego borrado (no llega nada);
  - fundir dos cambios de la misma serie con el mismo alcance;
  - borrar un evento quita sus comentarios e imágenes pendientes;
  - un evento rechazado arrastra sus comentarios e imágenes;
  - zod acepta los cambios válidos y rechaza un comentario vacío o de más de 1.000 caracteres, un alcance desconocido y un `repeat` mal formado.

  Cubre: RF-11, RF-19, RF-22, RF-23, RF-24, RF-32, RF-36, RNF-3 | Módulo: outbox, schemas

  Evidencia (2026-11-18): `npm test -- offline-outbox offline-schemas` 26 en verde (10 casos nuevos de la cola y 5 de los esquemas). `image.add` no pasa por el esquema del servidor: la imagen va por su ruta (D5). Las series se funden por alcance y ocurrencia (`series:<alcance>:<id>`). Verificación completa: typecheck, lint (el aviso de siempre en `event-form.tsx`), format, 312 archivos y 2.931 tests, y build en verde. Se arregló de paso el error sin capturar de `offline-app.test.tsx` (`scrollIntoView` en jsdom).

- [x] T2 Decidir sin red qué se puede hacer y cómo queda una serie (`gates.ts`, `image-limits.ts`, `series-loss.ts`, `series-overlay.ts`)
  Hecho cuando: `npm test -- offline-gates offline-image-limits offline-series no-secrets` en verde. Los tests cubren:
  - los traídos se escriben sin red con las mismas reglas que con red, con solo lectura del proveedor, cuenta sin permiso y mover solo dentro de la misma cuenta;
  - los tres alcances y "Repetir" en calendarios normales, pero no en traídos;
  - quién edita y quién borra un comentario o una imagen según el rol de la copia;
  - 10 imágenes por evento (subidas más pendientes) y 20 pendientes en total;
  - lo que se perdería con "Este y los siguientes" y con "Todos los eventos";
  - las repeticiones nuevas de una serie cambiada, borrada desde una fecha, creada o convertida, incluido el cambio de hora;
  - `ical.js` solo se importa en los módulos permitidos y `expand.ts` llega al navegador solo con `import()` (D2).

  Cubre: RF-1, RF-2, RF-3, RF-10, RF-11, RF-12, RF-13, RF-16, RF-23, RF-24, RF-33, RF-34, RF-36 | Módulo: gates, image-limits, series-loss, series-overlay

  Evidencia (2026-11-18): `npm test -- offline-gates offline-image-limits offline-series no-secrets` 38 en verde. `series-overlay.ts` planifica con `planSeriesChange`/`planSeriesDelete` y expande con `expandRows`, como el servidor: el caso de "Todos los eventos" a las 19:00 cruza el cambio de hora del 25 de octubre y todas quedan a las 19:00 de Madrid. La guardia nueva de `no-secrets` recorre el grafo de importaciones estáticas desde cada componente cliente (parando en los `"use server"`, que llegan como referencia) y comprueba que no llega a `expand.ts` ni a `series-overlay.ts`. `gates.ts` no importa valores de `series-write` para no arrastrar `ical.js`. Las funciones nuevas aún no se usan en la interfaz: se conectan en la T10. Verificación completa en verde (314 archivos, 2.952 tests).

- [ ] T3 Leer en el servidor la copia de formato 2 (`offline-reads.ts`)
  Hecho cuando: `npm run test:db -- offline-snapshot` en verde. Los tests cubren:
  - filas de serie con sus totales de toda la serie;
  - excepciones del rango;
  - los 50 comentarios más recientes por evento, con autor y "editado";
  - imágenes `ready` del rango, sin las `pending`;
  - nada de un calendario ajeno;
  - una copia de formato 1 se descarta y la cola se conserva.

  Cubre: RF-13, RF-14, RF-17, RF-29 | Módulo: offline-reads

- [ ] T4 Guardar miniaturas, imágenes abiertas e imágenes pendientes en el dispositivo (`db.ts` versión 2, `thumbs.ts`, `image-cache.ts`)
  Hecho cuando: `npm test -- offline-db offline-thumbs offline-image-cache` en verde, con el IndexedDB en memoria de los tests de la 034. Los tests cubren:
  - el paso de la versión 1 a la 2 sin perder la cola;
  - descargar solo las miniaturas que faltan, 4 a la vez, y borrar las que ya no están;
  - como mucho 30 imágenes grandes, sale la usada hace más tiempo;
  - `pending-images` con su `reservedId`;
  - `clearAll` vacía los almacenes nuevos;
  - un `QuotaExceededError` se avisa sin guardar.

  Cubre: RF-29, RF-31, RF-35, RF-41, RF-47 | Módulo: db, thumbs, image-cache

- [ ] T5 Leer un evento en Google e iCloud (`readEvent`, `read-event.ts`)
  Hecho cuando: `npm test -- google-read-event icloud-read-event` en verde con respuestas sintéticas en `tests/fixtures/sync/`. Los tests cubren:
  - Google: evento suelto y repetición; `404` y `410` → `null`;
  - iCloud: recurso suelto, repetición con su propio `VEVENT`, repetición calculada de la serie y `404` → `null`;
  - `401` → `ProviderError` `revoked`;
  - campos en la forma de `WritableEvent`.

  Cubre: RF-5, RF-6 | Módulo: providers, read-event

- [ ] T6 Aplicar en el servidor los cambios de Google e iCloud hechos sin red (`offline-writes.ts`)
  Hecho cuando: `npm run test:db -- offline-apply-synced` en verde, con el proveedor simulado (`vi.mock` del cliente de Google e iCloud) y el calendario traído sembrado en dev. Los tests cubren:
  - crear, cambiar, mover dentro de la cuenta y borrar → primero el proveedor y después CaFam;
  - el proveedor cambió el evento → conflicto con su versión;
  - el proveedor lo borró → conflicto `null`;
  - `revoked` → `held` sin escribir;
  - el proveedor rechaza → `rejected` con el texto de `writeErrorText`;
  - un Lector o un calendario de solo lectura del proveedor → `rejected`.

  Cubre: RF-1, RF-2, RF-4, RF-5, RF-6, RF-7, RF-9, RNF-3, RNF-4 | Módulo: offline-writes

- [ ] T7 Aplicar en el servidor series, comentarios y borrados de imágenes hechos sin red (`offline-writes.ts`)
  Hecho cuando: `npm run test:db -- offline-apply-series offline-apply-comments` en verde. Los tests cubren:
  - "Este y los siguientes" y "Todos los eventos" con `confirmLoss`;
  - crear una serie y convertir un suelto con `repeat`;
  - serie cambiada por otro → conflicto con la serie actual y su `series_loss`;
  - comentario o imagen añadidos por otro en la serie → conflicto;
  - comentario: añadir dos veces con el mismo `clientId` deja uno; editar con conflicto si cambió; editar uno borrado → `rejected`; borrar uno que ya no está → `applied`; evento borrado o usuario expulsado → `rejected`;
  - borrar una imagen: la propia, como propietario o como Editor → `applied`; ya borrada → `applied`; la ajena siendo Lector → `rejected`.

  Cubre: RF-10, RF-11, RF-14, RF-15, RF-21, RF-22, RF-26, RF-27, RF-28, RF-38 | Módulo: offline-writes

- [ ] T8 Abrir las rutas del service worker y subir imágenes pendientes (`/api/offline/apply`, `/api/offline/image`, `image-upload.ts`)
  Hecho cuando: `npm test -- offline-routes offline-image-upload` y `npm run test:db -- offline-image-route` en verde. Los tests cubren:
  - sin sesión `401`; cambio no válido → `rejected`; el mismo resultado que la acción;
  - `reserve` devuelve URL firmadas de subida con la sesión del usuario, y con `reservedId` todavía `pending` no reserva otra;
  - `429` con el límite de siempre; `404` si el evento ya no está;
  - `confirm`, y `404` si la reserva se purgó;
  - el cliente guarda el id reservado antes de subir, sube dos a la vez con progreso y, tras un corte, reutiliza la reserva (una sola imagen al final).

  Cubre: RF-39, RF-40, RF-41, RF-42, RF-44, RNF-3 | Módulo: rutas offline, image-upload

- [ ] T9 Enviar con la app cerrada y con cuentas retenidas (`flush.ts`, `background.ts`, `public/sw.js`)
  Hecho cuando: `npm test -- offline-flush offline-sw-sync offline-background` en verde. `offline-flush` y `offline-sw-sync` pasan los mismos casos (archivo compartido) por `flush.ts` y por `sw.js` cargado en un `vm`. Los tests cubren:
  - `held` deja el cambio y los de su entidad en la cola y sigue con el resto;
  - imágenes por `image-upload`;
  - `applied`, `conflict`, `rejected` con dependientes, `retry` y `unauthenticated`;
  - el candado `cafam-offline-flush` compartido;
  - `meta.lastBackgroundSync`;
  - registrar `sync` solo si el navegador lo tiene;
  - `CACHE_NAME` `cafam-v7`;
  - `sw-no-data` sigue en verde.

  Cubre: RF-4, RF-7, RF-8, RF-39, RF-42, RF-44, RF-45, RF-46 | Módulo: flush, background, sw.js

- [ ] T10 Usar comentarios, imágenes y series en el detalle sin red
  Incluye `EventComments`, `EventImages`, `ImageViewer`, `SeriesScopeDialog`, `RepeatField` y la confirmación de pérdidas con `series-loss`.
  Hecho cuando: `npm test -- event-comments event-images image-viewer series-scope-dialog repeat-field` en verde, con los casos sin red. Los tests cubren:
  - comentarios guardados y "Ver anteriores" deshabilitado con "Necesita conexión";
  - añadir, editar y borrar con "Pendiente de enviar" y "Deshacer";
  - galería con miniaturas, visor con la imagen guardada o con el aviso de RF-31;
  - añadir hasta los límites y quitar una pendiente;
  - borrar con "Deshacer";
  - los tres alcances y "Repetir" sin red, con la confirmación de pérdidas.

  Además, prueba manual con la red cortada en el navegador, a 390 px y en escritorio.

  Cubre: RF-10, RF-11, RF-12, RF-13, RF-18, RF-19, RF-20, RF-23, RF-24, RF-25, RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, RF-36, RF-37 | Módulo: detalle sin red

- [ ] T11 Mostrar lo nuevo en "Cambios no enviados", el aviso al abrir y `/privacy`
  Incluye `changes-sheet.tsx`, `offline-provider.tsx` y `/privacy`.
  Hecho cuando: `npm test -- changes-sheet offline-provider privacy` en verde. Los tests cubren:
  - conflicto de serie con las dos versiones y lo que se perdería;
  - comentario rechazado con su texto y editado con conflicto;
  - imagen rechazada con "Descargar";
  - cuenta retenida con "Volver a conectar";
  - al abrir, "N cambios sincronizados" desde `lastBackgroundSync` y los conflictos que dejó;
  - al reconectar la cuenta, `flush`;
  - cerrar sesión vacía también miniaturas, imágenes y pendientes;
  - la sección de `/privacy` actualizada.

  Cubre: RF-7, RF-8, RF-9, RF-14, RF-15, RF-21, RF-27, RF-40, RF-43, RF-47, RF-48 | Módulo: changes-sheet, offline-provider, privacy

- [ ] T12 Validar RF por RF y documentar
  Hecho cuando hay en este archivo:
  - la tabla RF-1 a RF-48 con el test que cubre cada uno;
  - las medidas de RNF-2 (copia con 300 miniaturas y 50 comentarios en 200 eventos, y 20 pendientes);
  - capturas a 390, 768 y 1440 px en claro y oscuro de la galería sin red, un comentario pendiente y un conflicto de serie;
  - los recorridos manuales de los criterios de finalización: Google e iCloud de prueba, series con dos usuarios, comentarios e imágenes en el iPhone, envío con la app cerrada en Chrome de Android y en escritorio, y envío al abrir en el iPhone;
  - `AGENTS.md` actualizado (estado, "Añadido por la spec 035", trampas de Background Sync y de las URL firmadas).

  Cubre: todos | Módulo: validación

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T2, T6 |
| RF-2 | T2, T6 |
| RF-3 | T2 |
| RF-4 | T6, T9 |
| RF-5, RF-6 | T5, T6 |
| RF-7 | T6, T9, T11 |
| RF-8 | T9, T11 |
| RF-9 | T6, T11 |
| RF-10 | T2, T7, T10 |
| RF-11 | T1, T2, T7, T10 |
| RF-12 | T2, T10 |
| RF-13 | T2, T3, T10 |
| RF-14 | T3, T7, T11 |
| RF-15 | T7, T11 |
| RF-16 | T2 |
| RF-17 | T3 |
| RF-18 | T10 |
| RF-19, RF-20 | T1, T10 |
| RF-21 | T7, T11 |
| RF-22 | T1, T7 |
| RF-23, RF-24 | T1, T2, T10 |
| RF-25 | T10 |
| RF-26 | T7 |
| RF-27 | T7, T11 |
| RF-28 | T7 |
| RF-29 | T3, T4 |
| RF-30 | T10 |
| RF-31 | T4, T10 |
| RF-32 | T1, T10 |
| RF-33, RF-34 | T2, T10 |
| RF-35 | T4, T10 |
| RF-36 | T1, T2, T10 |
| RF-37 | T10 |
| RF-38 | T7 |
| RF-39 | T8, T9 |
| RF-40 | T8, T11 |
| RF-41 | T4, T8 |
| RF-42 | T8, T9 |
| RF-43 | T11 |
| RF-44 | T8, T9 |
| RF-45, RF-46 | T9 |
| RF-47 | T4, T11 |
| RF-48 | T11 |
| RNF-1 a RNF-6 | T6, T8, T9, T12 |

## Dudas abiertas

Ninguna.
