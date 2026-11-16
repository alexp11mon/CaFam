# Plan 031 — Venito morsa

> Aprobado por el usuario con su petición (ver spec).

## Decisiones

- D1 Un solo SVG en `viewBox 0 0 120 120` (como antes), con las partes con `data-part` (`head`, `eyes`, `flipper`, `glasses`, `tusks`, `whiskers`) para que los gestos de `globals.css` sigan funcionando sin cambios.
- D2 Tokens nuevos `--walrus-line` y `--walrus-body` (claro `#22364F` / `#FFFFFF`; oscuro `#DCE3EE` / `#232139`), definidos en `lib/theme/accents.ts` (`VENITO`) y copiados en `globals.css`. Se retiran los `seal*`. Los puntos del hocico usan `walrus-line` al 55 %.
- D3 Prop `compact` (por defecto `false`): sin bigotes y trazo de 4,4 en lugar de 3,4. La usan el botón flotante y los Venito del chat de 40 px o menos.
- D4 La referencia mostraba el cuerpo blanco con su azul claro de fondo; aquí el fondo es el de la superficie donde va (como señala su nota "Ojo").

## Verificación

P8 completa y capturas de Venito a tamaño grande y real, en claro y oscuro.
