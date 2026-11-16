# Plan 029 — Pantallas restantes y cierre

Spec: `specs/029-pantallas-restantes-y-cierre/spec.md`. Aprobado de antemano (2026-11-15).

## Enfoque

Las pantallas secundarias ya pintan con tokens y componentes base, así que cambian de identidad con las specs 025 y 030 sin tocarlas. Esta spec revisa el resultado pantalla a pantalla con capturas, corrige lo que no encaja y deja las herramientas de cierre.

| Módulo | Cambio |
|--------|--------|
| `components/connections/provider-notice.tsx`, `import/import-form.tsx`, `recurrence/recurrence-editor.tsx` | Restos de botones en tinta de la identidad original: pasan a los estilos compartidos |
| `components/ui/chip.tsx` | `ChipLink` |
| `app/dashboard/calendars/page.tsx` | Acción principal y fila de chips |
| `app/page.tsx` | Venito en la portada |
| `scripts/e2e-phone.mjs`, `scripts/screenshots.mjs` | Recorrido y capturas reproducibles |
| `AGENTS.md` | Actualización completa |

## Decisiones

- **D1 Revisar con una hoja de capturas de todas las pantallas** en lugar de rediseñar cada una a mano: detecta lo que desentona con poco coste y deja evidencia.
- **D2 El recorrido es un script versionado**, no un test de `npm test`: necesita la app compilada y un Supabase, como `test:db`, y Playwright no es dependencia del proyecto.
- **D3 Mover el evento se prueba con Alt + flecha**: el arrastre con el dedo (mantener pulsado 500 ms) no se puede emular con fiabilidad; el teclado ejercita el mismo guardado.
