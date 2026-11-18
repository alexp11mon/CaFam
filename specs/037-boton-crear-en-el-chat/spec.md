# Spec 037 — El "+" no tapa el botón Enviar del chat

> Estado: **Cerrada** (2026-11-18) por decisión del usuario. **Aprobada** por el usuario el 2026-11-18 con su petición "Haz esta tarea aquí: Fix '+' button covering Send in the chat", sobre la tarea sugerida al cerrar la spec 036. Constitución: `docs/constitution.md`. Corrige el marco de la spec 030.

## Contexto y objetivo

En el móvil (≤ 768 px), el botón flotante "+" (`CreateButton`, spec 030) está fijo abajo a la derecha, justo encima del botón redondo "Enviar" de la barra de entrada del chat en `/dashboard/assistant`. El "+" tapa "Enviar", que no se puede pulsar con el dedo. Se ve en las capturas `specs/036-venito-crea-y-edita/capturas/tarjetas-390-*.png`. En esa pantalla el "+" sobra: lo que se hace allí es escribir a Venito, que además ya crea eventos (spec 036).

## Requisitos funcionales (EARS)

- RF-1: MIENTRAS el usuario esté en `/dashboard/assistant` en el móvil, EL SISTEMA no mostrará el botón flotante "+".
- RF-2: EL SISTEMA seguirá mostrando el "+" flotante en el resto de pantallas del panel en el móvil, y "Nuevo evento" en la barra superior desde 769 px en todas, la del asistente incluida.
- RF-3: CUANDO el usuario esté en `/dashboard/assistant` a 390 px, EL SISTEMA dejará el botón "Enviar" visible entero y pulsable.
- RF-4: EL SISTEMA ajustará la página `/dashboard/assistant` al hueco bajo la barra superior en todas las anchuras desde 769 px, de forma que la barra de entrada y "Enviar" se vean sin desplazar la página.

> RF-4 se añadió durante la T1 (2026-11-18): las capturas a 1440 px mostraron la barra de entrada cortada por abajo. Desde 1024 px la página medía toda la pantalla (`lg:h-dvh`, del marco con barra lateral de la 025), y la barra superior de la 030 la empujaba 4rem fuera. Es el mismo síntoma: "Enviar" no se ve.

## Fuera de alcance

- Mover o rediseñar el "+" en otras pantallas.
- El panel del chat que abre Venito: ocupa la pantalla como `<dialog>` modal y ya queda por encima del "+".

## Criterios de finalización

- Test del marco en verde; P8 completa.
- Capturas de `/dashboard/assistant` a 390, 768 y 1440 px en claro y oscuro en `capturas/`.
