# Plan 037 — El "+" no tapa el botón Enviar del chat

Spec: `specs/037-boton-crear-en-el-chat/spec.md` (aprobada el 2026-11-18). Sin migraciones ni dependencias.

## Decisión

- **D1** `CreateButton` (`components/shell/create-fab.tsx`) no pinta nada cuando es flotante (`floating`) y la sección activa es `assistant` (`activeSection`, `lib/shell/nav.ts`). La versión de la barra superior no cambia. Se oculta en vez de moverse porque en el chat no aporta nada y, movido, seguiría compitiendo con la barra de entrada y el teclado. Cubre: RF-1, RF-2, RF-3.

- **D2** `app/dashboard/assistant/page.tsx` deja de usar `lg:h-dvh`: desde 769 px manda su `tab:h-[calc(100dvh-4rem-…)]`, que ya descuenta la barra superior. Cubre: RF-4.

## Riesgos

- Activity (spec 008) deja otras rutas ocultas en el DOM, pero el "+" vive en el marco, no en la página, y se recalcula con `usePathname()` al navegar.
