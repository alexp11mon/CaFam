# Medición de rendimiento (spec 024)

Aproximación reproducible de un iPhone: Chromium con emulación de iPhone 13, CPU 4× más lenta y red tipo 4G. No sustituye a la prueba en un iPhone real.

## Preparación (una vez)

```bash
npx supabase start -x studio,logflare,vector,imgproxy,edge-runtime,mailpit,supavisor
```

`.env.local` apunta al proxy (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399`) y `.env.test.local` al Supabase local directo (`http://127.0.0.1:54321`) con su `SUPABASE_SECRET_KEY`. `CRON_SECRET` debe coincidir con `cron_secret` de Vault.

## Medir

```bash
node scripts/perf/latency-proxy.mjs 30 &
```

```bash
npm run build
```

```bash
NODE_OPTIONS="--import ./scripts/perf/mock-groq.mjs" GROQ_API_KEY=mock npx next start -p 3100 &
```

```bash
node --env-file=.env.test.local scripts/perf/measure.mjs despues
```

```bash
node --env-file=.env.test.local scripts/perf/paint.mjs
```

- `latency-proxy.mjs [ms] [puerto] [destino]`: añade el retraso a cada consulta a Supabase y las cuenta (`/__stats`, `/__reset`).
- `mock-groq.mjs`: responde a las llamadas a Groq con un retraso fijo (`MOCK_GROQ_MS`, 900 por defecto): una llamada a `list_events` y luego el texto. Solo para medir; nunca forma parte de la app.
- `measure.mjs <etiqueta>`: siembra un usuario `@cafam.test` con 639 eventos, mide y lo borra. Escribe `results/<etiqueta>.json`. Variables: `PERF_CPU` (4), `PERF_REPEAT` (6), `PERF_BASE`, `PERF_PROXY`.
- `paint.mjs`: fotogramas al desplazar la agenda y la semana, con y sin `backdrop-filter`.

Qué mide `measure.mjs`: carga del calendario (JS pedido, consultas), cambio de periodo en mes, semana y día (tiempo desde que se suelta el dedo hasta que el periodo nuevo está en el DOM y hasta que no quedan animaciones; peticiones; consultas; tareas largas; CLS), abrir el chat, y una pregunta al asistente (primera señal y respuesta).
