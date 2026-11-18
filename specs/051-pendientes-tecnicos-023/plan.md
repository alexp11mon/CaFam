# Plan 051 — Pendientes técnicos de la auditoría (023)

Spec: `specs/051-pendientes-tecnicos-023/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Autor**: trigger `events_author` `before insert or update` en `events`: en `insert`, si `auth.uid()` no es nulo y la marca de transacción `app.keep_author` no está activa, `new.created_by := auth.uid()`; en `update`, `new.created_by := old.created_by` salvo con la marca. Las funciones `SECURITY DEFINER` que conservan autores (copias, juntar, restaurar, sincronizar) ya corren sin `auth.uid()` o activan la marca. El único caso desde el cliente, convertir en serie con imágenes o comentarios, pasa a una función nueva `convert_keep_author(p_event_id, …)` que activa la marca solo para copiar el autor del original.
- **Cuota**: `assistant_questions` gana `state` (`reserved | answered`) y `expires_at`. `assistant_reserve()` (`SECURITY DEFINER`, `pg_advisory_xact_lock` por usuario) cuenta las respondidas del día y las reservadas vivas; si caben, inserta una reservada y devuelve su id y lo que queda; si no, `CF429`. `assistant_answered(p_id)` y `assistant_release(p_id)`. Las reservadas caducan a los 2 minutos (no cuentan) y `pg_cron` las borra.
- **CSP**: `next.config.ts` añade `Content-Security-Policy` y `Content-Security-Policy-Report-Only` en la regla global (la primera, 023). El hash de `THEME_SCRIPT` se calcula en `next.config.ts` con `node:crypto` importando la constante.
- **Helpers**: `tests/integration/helpers.ts` crea los clientes con `global.fetch` envuelto en `AbortSignal.timeout(15_000)` y `withRetry` solo en `createTestUser`/`deleteTestUser`.
- **Rango**: script `scripts/perf/range-explain.mjs` que siembra en dev y ejecuta `EXPLAIN` como usuario (con `set local role authenticated` y `request.jwt.claims`).

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261202100000_event_author.sql` | Trigger, `convert_keep_author` |
| `supabase/migrations/20261202110000_assistant_quota_reserve.sql` | Columnas y funciones de reserva; política de `insert` del cliente retirada (solo por función) |
| `src/app/dashboard/events/actions.ts` | Conversión con `convert_keep_author` (RF-3) |
| `src/app/api/assistant/route.ts` | Reservar antes, `answered` al terminar, `release` en error y cancelación (RF-4, RF-5) |
| `next.config.ts`, `src/lib/security/csp.ts` (puro) | Construcción de las dos políticas a partir de `NEXT_PUBLIC_SUPABASE_URL` (RF-6 a RF-8) |
| `src/app/api/csp-report/route.ts` | `POST`, registra un resumen con `console.warn`, responde 204, límite de 8 KB |
| `tests/integration/helpers.ts` | Plazo y reintento (RF-10, RF-11) |
| `scripts/perf/range-explain.mjs`, quizá una migración de índice | RF-12 |

## Decisiones

- D1: Marca de transacción `app.keep_author` (como `app.account_transfer` de la 006 y `app.sync_write` de la 009): el patrón ya existe y se prueba igual.
- D2: Reserva con caducidad y no "contar antes": respeta "solo cuentan las respondidas" y cierra la carrera; una reserva huérfana (la función de Vercel murió) no castiga al usuario más de 2 minutos.
- D3: **CSP sin nonce.** La documentación de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, "Static vs Dynamic Rendering with CSP") dice que el nonce obliga a renderizar todo de forma dinámica y es **incompatible con Partial Prerendering**, que el proyecto usa (`cacheComponents`, `partialPrefetching`; spec 024). Además, Next inserta scripts en línea propios (datos del RSC) que cambian por petición y no se pueden autorizar por hash. Por eso la política aplicada lleva `script-src 'self' 'unsafe-inline'` (con el hash de `THEME_SCRIPT` en la política *Report-Only*, donde sí se puede observar la versión estricta) y todo lo demás estricto (RF-6). Es una mejora real (orígenes, `object-src`, `base-uri`, `form-action`, `connect-src`) sin perder rendimiento; endurecer `script-src` queda condicionado a que Next ofrezca hashes para sus scripts con PPR (SRI experimental), anotado en AGENTS.md.
- D4: Reintento solo en la gestión de usuarios (RF-11), que es donde se ven los fallos de red y de `rate limit` de Auth; los tests en sí no se reintentan.
- D5: El índice solo si la medida lo justifica (RF-12): la 023 lo dejó así por falta de medida.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Aplicar antes de desplegar (la ruta del asistente nueva llama a `assistant_reserve`). Tras desplegar, revisar en los logs de Vercel los avisos `csp-report` durante unos días.

## Riesgos

- Algún recurso no previsto (fuentes de `next/font` son locales; imágenes de Google en el aviso de conexión) puede bloquearse: el recorrido de la T3 lo detecta.
