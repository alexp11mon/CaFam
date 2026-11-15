# Plan 027 — Venito y el chat del asistente

Spec: `specs/027-venito-y-asistente/spec.md`. Aprobado de antemano (2026-11-15).

## Módulos

| Módulo | Cambio |
|--------|--------|
| `src/components/brand/venito.tsx` (nuevo) | El SVG con sus expresiones |
| `globals.css`, `lib/theme/accents.ts` | Tokens `seal*`, animaciones `venito-*`, textura `bg-chat` |
| `src/lib/assistant/suggestions.ts` (nuevo, puro) | Qué chips tocan en cada contexto |
| `src/components/assistant/assistant-chat.tsx` | Mismo estado y peticiones; pintado nuevo (cabecera, burbujas, hora, escribiendo, barra de entrada, chips) |
| `src/components/assistant/assistant-panel.tsx` (nuevo) | El `<dialog>` del chat en el marco, con carga diferida, alto visible y cierre deslizando |
| `src/components/shell/assistant-fab.tsx` | La cara de Venito; abre el panel; actividad |
| `src/components/shell/app-frame.tsx` | Monta el panel |
| `src/app/dashboard/assistant/page.tsx` | El chat a página completa |
| `ui/empty-state.tsx`, `ui/error-screen.tsx`, `app/offline/page.tsx` | Venito |
| `/privacy` | Sin cambios de fondo: se sigue sin guardar la conversación |

## Decisiones

- **D1 El chat es un panel del marco, no una navegación.** Abrirlo deja de costar un viaje al servidor (024: 205–357 ms la primera vez) y la conversación sobrevive al cambiar de pantalla. La ruta se conserva para enlaces y para quien recargue.
- **D2 `<dialog>` modal también en escritorio.** Un solo comportamiento probado (foco atrapado, Escape, fondo inerte). En escritorio el fondo es casi transparente y tocar fuera cierra. Alternativa descartada: panel no modal en escritorio (dos caminos de foco que mantener).
- **D3 La conversación sigue solo en memoria.** Guardarla exigiría esquema nuevo con RLS y cambiar `/privacy`; lo que se gana (recuperarla tras recargar) no compensa guardar lo que el usuario pregunta sobre su vida. El panel montado una vez da la persistencia que se nota en el uso real.
- **D4 Los chips que son preguntas completas se envían; los que necesitan un dato rellenan.** Un toque y respuesta es lo que hace útil un acceso rápido; rellenar sin enviar obligaría a un segundo toque en todos. Riesgo: gastar una de las 30 preguntas por un toque accidental; se acepta (hay "Cancelar").
- **D5 Los colores de Venito son tokens propios, no el acento.** La mascota es marca: no puede volverse amarilla o gris según el usuario.
- **D6 El alto del panel en el móvil sigue a `visualViewport`**, porque en iOS el teclado no cambia `dvh` y la barra de entrada quedaría debajo.
- **D7 El dibujo vive en un solo componente con un `mood`**, no en seis archivos: comparten cabeza y cambian ojos, boca y aletas.
- **D8 El progreso por pasos de la 024 es el texto de "escribiendo…"**: no se inventa un estado nuevo.

## Riesgos

- R1 Muchos tests del chat fijan textos y estructura: se actualizan a conciencia; los nombres accesibles ("Tu pregunta", "Enviar", "Adjuntar imagen", "Nueva conversación", "Cancelar", "Reintentar") se conservan.
- R2 Activity y `<dialog>`: el panel vive en el marco (no en una ruta), así que no se oculta con Activity; la página completa no usa diálogo.
- R3 `visualViewport` no existe en jsdom: el hook lo tolera.

## Verificación

P8; capturas; `measure.mjs` (abrir el chat).
