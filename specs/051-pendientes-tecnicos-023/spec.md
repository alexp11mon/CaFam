# Spec 051 — Pendientes técnicos de la auditoría (023)

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Cerrada el 2026-11-25.

## Contexto

La tabla "Diferido" de la spec 023 dejó hallazgos técnicos sin arreglar. La 038 resuelve el más importante (sincronización). Esta spec recoge los cinco técnicos que pidió el usuario.

## Objetivo

Cerrar esos pendientes sin cambiar nada visible para el usuario salvo los mensajes de error que correspondan.

## Requisitos funcionales

### Autor del evento impuesto por el servidor

- RF-1: Al crear un evento, `events.created_by` es siempre quien lo crea (`auth.uid()`), aunque el cliente mande otro valor. Un Editor ya no puede falsear "Creado por".
- RF-2: `created_by` no se puede cambiar con `update` desde el cliente.
- RF-3: Los casos legítimos de otro autor siguen funcionando: convertir en serie un evento ajeno con imágenes o comentarios (el original queda como primera repetición con su autor; 013 y 023), las copias de calendarios sin propietario (006), juntar calendarios, importar, sincronizar (autor = propietario) y restaurar de la papelera (017/046), todos dentro de funciones del servidor.

### Cuota del asistente sin carreras

- RF-4: Varias preguntas en paralelo no superan las 30 diarias: el hueco se **reserva** antes de llamar al modelo, de forma atómica.
- RF-5: Solo cuentan las preguntas respondidas (015 D9): una reserva cuya respuesta falla, se cancela o no llega en 2 minutos se libera.

### Política de seguridad de contenido (CSP)

- RF-6: Todas las páginas envían una `Content-Security-Policy` con `default-src 'self'`, `connect-src` limitada a la app, Supabase (https y wss del proyecto) y nada más, `img-src 'self' blob: data:` y el Storage de Supabase, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y el OAuth de Google (007, 050), `frame-ancestors 'none'` (023), `manifest-src 'self'` y `worker-src 'self'`.
- RF-7: `script-src` sin orígenes externos. `THEME_SCRIPT` se autoriza por su **hash** SHA-256 (calculado en el build). Ver la decisión D3 del plan sobre los scripts en línea de Next con `cacheComponents`.
- RF-8: Una cabecera `Content-Security-Policy-Report-Only` con la política estricta (sin `'unsafe-inline'`) informa a `/api/csp-report`, que solo registra en los logs de Vercel (sin guardar nada), para comprobar si se puede endurecer.
- RF-9: La app funciona igual con la CSP: login, OAuth de Google e iCloud, imágenes, tiempo real, asistente en streaming, service worker, modo sin conexión y temas sin parpadeo.

### Helpers de `test:db`

- RF-10: Las llamadas de los helpers de integración (`createTestUser`, `deleteTestUser`, clientes de prueba) tienen un plazo de 15 s que convierte un cuelgue en un fallo con mensaje claro ("Supabase dev no respondió en 15 s: …").
- RF-11: Solo los errores de red y `rate limit` de Auth en la creación y el borrado de usuarios se reintentan (2 veces, con espera de 2 y 5 s); nunca las aserciones ni las consultas de los tests (para no tapar fallos reales, motivo de la 023).

### Lectura por rango

- RF-12: Se mide con `EXPLAIN (ANALYZE, BUFFERS)` la consulta de `getEventsInRange` con 20.000 eventos en 30 calendarios como usuario autenticado. Si no usa índice y tarda más de 50 ms, se añade el índice o la reescritura que lo resuelva (p. ej. `calendar_id = any(<mis calendarios>)` explícito antes del rango); si ya es rápida, se documenta la medida y no se cambia nada.

## Requisitos no funcionales

- RNF-1: Sin dependencias nuevas.
- RNF-2: Sin cambios visibles en la interfaz.

## Fuera de alcance

- El resto de "Diferido" de la 023 (recuperación bloqueable, reservas de imágenes, consultas de `profiles`, objetivos táctiles del mes, `vite-tsconfig-paths`, aviso de lint, barra del asistente).

## Riesgos

- Una CSP demasiado estricta rompe la app en producción sin que lo vean los tests: se prueba recorriendo la app con `next start` y la consola abierta (Playwright, errores de CSP = fallo), y el modo *Report-Only* da margen.

## Criterios de finalización

- Tests de integración del autor y de la cuota en paralelo; test de cabeceras; recorrido con Playwright sin errores de CSP; medida de `EXPLAIN` en `tasks.md`.
- P8 en verde con `test:db`; "Diferido" de la 023 y AGENTS.md actualizados.

## Dudas abiertas

Ninguna.
