# Plan 032 — Panel lateral desplazable y calendarios plegables

> Aprobado de antemano por el usuario junto con la spec (2026-11-17).

## Decisiones

- D1 **Panel lateral**: `#calendar-side-panel` ya es `lg:sticky lg:top-56`. Se le añade `lg:max-h-[calc(100dvh-15rem)] lg:overflow-y-auto lg:overscroll-contain` (14rem de la cabecera y la barra del calendario más 1rem de margen abajo) y un pequeño relleno para que la sombra de las tarjetas no se recorte. Sin JavaScript.
- D2 **Plegado recordado**: `lib/calendar/folded.ts` (puro: leer y escribir el conjunto de ids plegados de un JSON tolerante a basura) y `lib/hooks/use-folded.ts`, un almacén de módulo con `useSyncExternalStore` como `use-sidebar-collapsed.ts`, con la clave `cafam-folded`. Snapshot del servidor: nada plegado (todo desplegado, RF-6). Se guardan solo las elecciones explícitas (`{id: plegado}`, como mucho 200, las más viejas fuera); sin elección, cada id toma su valor por defecto (listas desplegadas, categorías plegadas). Las ids (`foldId`) son `group:<id>`, `person:<id>`, `section:calendars`, `section:ungrouped` y `categories:<calendarId>`.
- D3 **Filtros** (`calendar-filters.tsx`): título con un botón `aria-expanded` y el resumen "N de M visibles"; cada grupo/persona con un `IconButton` de flecha (`CaretIcon`, que ya gira con los tokens) "Plegar X"/"Desplegar X" y el recuento "2/3"; categorías bajo una flecha del calendario y "1 categoría oculta". Botón "Ordenar"/"Hecho" (estado local) que muestra `MoveButtons`. Con una sola persona (sin nivel de persona) no hay flecha de grupo. En modo ordenar se despliega todo lo que se ordena (sin cambiar lo guardado), para poder mover los calendarios.
- D4 **"Mis calendarios"**: `GroupSection` con flecha de plegado en la cabecera (misma id `group:<id>`), el número de calendarios y la casilla; Renombrar, Borrar, Subir y Bajar dentro de un menú `<details>`-like propio (`GroupMenu`, botón ⋯ con `aria-expanded` que abre una lista de botones; Escape y clic fuera lo cierran). `ConfirmDialog` sigue igual dentro del menú. "Sin grupo" usa un componente `FoldSection` compartido. `CalendarList` pasa a filas: botón de la fila con `aria-expanded` que despliega los detalles y las acciones actuales (los mismos enlaces y `ConfirmDialog`); un solo abierto por lista (estado local). `GroupForm` se abre desde un `Chip` "Nuevo grupo" en una `Sheet`; al crear, se cierra.
- D5 Sin migraciones, dependencias ni cambios en Server Actions (RF-14).

## Riesgos

- R1 Tests existentes buscan "Subir/Bajar …", "Renombrar …", "Editar …" visibles: se actualizan para abrir antes el modo ordenar, el menú o la fila.
- R2 Activity conserva la página oculta: el almacén de módulo comparte el estado entre la instancia visible y la oculta, que es lo deseado.
