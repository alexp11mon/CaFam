# Spec 031 — Venito pasa a ser una morsa

> Estado: **Aprobada** por el usuario con su petición del 2026-11-16 ("Quiero cambiar a Venito, me gustaría que fuera una morsa con la forma de la imagen que te adjunto") y la imagen de referencia (`referencia.jpg`, "opción 2a·1, 2a en azul marino").

## Contexto

La spec 030 dibujó a Venito como una foca secretario con gafas, cuello y corbata. El usuario quiere sustituirla por la morsa de su referencia: dibujo de línea, cuerpo alto y redondeado, gafas redondas, hocico de dos lóbulos con puntos, nariz, colmillos largos, bigotes y aletas; trazo azul marino sobre cuerpo blanco.

## Requisitos

- RF-1 Venito es una **morsa** de línea como la de la referencia: cuerpo en forma de huevo alto, aleta a la derecha y otra abajo a la izquierda, **gafas redondas** con puente, ojos tras las gafas, hocico de dos lóbulos con tres puntos en cada uno, nariz rellena, **dos colmillos largos** hasta el pie y bigotes de tres trazos a cada lado. Sin cuello ni corbata.
- RF-2 **Trazo azul marino** sobre cuerpo blanco en claro; en oscuro se invierte a **trazo claro** sobre cuerpo oscuro. Colores como tokens propios (`walrus-line`, `walrus-body`), nunca el acento ni un color suelto.
- RF-3 Las seis expresiones se conservan: reposo (párpados a media altura), saludo (aleta levantada), pensando (ojos abiertos mirando arriba, una ceja levantada y dos puntos), conforme (ojos en arco), confundido (un ojo entornado y "?") y durmiendo (ojos cerrados y "z z").
- RF-4 **En pequeño** (botón del asistente, cabecera y burbujas del chat, 32–48 px) se quitan los bigotes largos y el trazo es más grueso para que se lea a 40 px.
- RF-5 Se conservan las reglas de la 027: SVG propio, decorativo salvo que tenga nombre, gestos solo con `transform` y `opacity` y quietos con `prefers-reduced-motion`.

## Fuera de alcance

Cambiar el icono de la app o el logotipo (siguen siendo la ficha violeta con la "C").
