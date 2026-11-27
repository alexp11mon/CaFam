<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- END:nextjs-agent-rules -->

# CaFam — guía para agentes

Lo imprescindible para trabajar en el proyecto. El bloque de arriba lo gestiona `next dev`: no lo edites. El detalle de cada funcionalidad está en su spec (`specs/NNN-nombre/spec.md`, `plan.md`, `tasks.md`) y en el grafo de graphify; la fuente de verdad de las reglas es [`docs/constitution.md`](docs/constitution.md). Ante una contradicción manda la spec más reciente.

> Última actualización: 2026-11-27 (resumido). Specs cerradas hasta la 049, la 051, la 052 y la 053; la 050 hecha salvo su prueba real; la 054 hecha, pendiente de cierre (rama `054-pantalla-ahora`, sobre `main`).

## 0. Mapa del proyecto: graphify (obligatorio, enmienda 13)

Grafo de conocimiento en `graphify-out/` (no se versiona). Usa siempre `python -m graphify` (el lanzador no está en el PATH):

```
python -m graphify query "¿cómo se envía la cola sin conexión?"   # subgrafo (BFS); --dfs, --budget N
python -m graphify explain "flush()"                              # un nodo y sus vecinos
python -m graphify path "EventPanel" "applyOfflineChange"         # camino entre dos conceptos
python -m graphify update .                                       # re-extrae el código (AST, ~25 s); --force si borraste código
python -m graphify hook status
```

1. **Antes de buscar o abrir archivos** (Grep, Glob, Read…), consulta el grafo y lee solo lo que te señala. Los hooks `PreToolUse` de `.claude/settings.json` lo recuerdan. Pon esta regla en el prompt de los subagentes que exploren código.
2. `graphify-out/GRAPH_REPORT.md` solo para revisiones amplias de arquitectura.
3. Los hooks de git lo regeneran tras commit, checkout y merge. Si creas, mueves o borras archivos, ejecuta `python -m graphify update .` antes de cerrar la tarea (parte de la verificación).
4. `update` solo extrae código; los `.md` necesitan `/graphify . --update` (gasta tokens): solo si el usuario lo pide.
5. Máquina nueva: `pip install graphifyy`, `python -m graphify update .`, `python -m graphify hook install`.

## 1. Qué es

**CaFam**: PWA de calendario compartido, mobile-first, instalable (iOS, Android, escritorio), de uso **estrictamente personal** entre familia y amigos. Sin ánimo de lucro, sin publicidad ni analítica, **coste cero** (Supabase Free, Vercel Hobby, GitHub Free, Brevo, Groq gratuito).

- Nombre único **CaFam** en todas partes (los nombres antiguos los impide `tests/unit/project-name.test.ts`; solo se conservan la URL de Vercel y migraciones ya aplicadas).
- Producción: <https://calendario-familia-five.vercel.app> · Repo privado: <https://github.com/alexp11mon/CaFam>
- Idioma: **español** en la interfaz, docs, specs y commits; **inglés** en identificadores, archivos y comentarios técnicos. La interfaz también está en **inglés** (053, enmienda 15): ver §9 "Textos e idioma".

## 2. Funcionalidades (por spec)

Todas cerradas salvo la 036 (hecha; falta `EVAL_PART=write npm run eval:assistant` y su cierre). Las specs 001–004 citan cuenta como "005" y OAuth como "006": hoy son 006 y 007.

| Spec | Qué añadió |
|------|-----------|
| 001 | Base: auth email/contraseña, esquema con RLS, PWA, despliegue, cron keep-alive |
| 002 | Calendarios, categorías, eventos; vistas; filtros por persona con orden guardado; juntar calendarios |
| 003 | Compartir por enlace (`/invite/[token]`) o ID + PIN; roles Lector/Editor; miembros |
| 004 | Importar `.ics` (enlace o archivo) a un calendario nuevo (2 MB, 2.000 eventos) |
| 005 | Acento elegible (`profiles.accent`); calendario como inicio; vista agenda (identidad sustituida por la 030) |
| 006 | Recuperar/cambiar contraseña y email, perfil, borrar cuenta (calendarios compartidos quedan "sin propietario" 15 días), correo con Brevo |
| 007 | Sincronización de **Google** por OAuth (`/dashboard/connections`), cuentas (hasta 5), calendarios (hasta 20), grupos de calendarios |
| 008 | Ventana de evento sobre el calendario (rutas `@modal`), alta rápida, arrastrar para crear, `TimeField`, atajos, vista recordada |
| 009 | Escritura bidireccional en Google (primero Google, luego CaFam), subir calendario, `/privacy` |
| 010 | Renombrado a CaFam |
| 011 | Tema claro/oscuro/sistema (`profiles.theme` + cookie `cafam-theme`), movimiento con tokens |
| 012 | Imágenes en eventos (Supabase Storage, cualquier miembro, reducidas en el dispositivo) |
| 013 | Eventos recurrentes (RRULE, excepciones, alcance "solo este / siguientes / todos") |
| 014 | Comentarios en eventos (cualquier miembro) |
| 015 | Asistente de chat con Groq (herramientas de solo lectura, 30 preguntas/día) |
| 016 | Calendario estilo Google en el móvil: bloques rellenos (`EventBlock`), deslizar, agenda continua |
| 017 | Mover/redimensionar arrastrando, menú contextual, "Deshacer", hoja inferior, pellizco, atajos E/G/? |
| 018 | **iCloud** por CalDAV (`tsdav`) con contraseña de app; capa de proveedores `lib/sync/providers/` |
| 019 | Tarjeta de detalle en escritorio, fines de semana, duración por defecto, tecla C, **tiempo real** (Supabase Realtime) |
| 020 | Bloques "Ocupado" de otros (con consentimiento), sincronización cada 15 min + avisos push de Google |
| 021 | Animaciones y microinteracciones (`lib/motion/`, tokens `--motion-*`) |
| 022 | Eventos desde una imagen en el asistente (propuesta editable, nada se crea hasta "Crear") |
| 023 | Auditoría: seguridad SQL, cabeceras, `hasCronSecret`, páginas de error, accesibilidad, Ctrl/⌘+Z |
| 024 | Rendimiento: ventana ancha de eventos y cambio de periodo sin red (`pushState`), asistente en streaming NDJSON |
| 025–026 | Componentes base (`components/ui`), hoja de filtros en el móvil |
| 027 | Venito (mascota) y chat como panel del marco |
| 028 | **Notas** (listas y texto, personales o compartidas por calendario) |
| 029 | Revisión de pantallas secundarias, `scripts/e2e-phone.mjs` |
| 030–031 | Identidad **Nexo** (enmienda 11) y Venito morsa (enmienda 12) |
| 032 | Panel lateral desplazable, grupos/personas plegables (`useFolded`) |
| 033 | `next` 16.4.6, `npm audit` a 0 |
| 034–035 | **Modo sin conexión**: copia en IndexedDB, cola de cambios, conflictos, `/offline`, Background Sync, también Google/iCloud, series, comentarios e imágenes |
| 036 | Venito crea eventos y propone cambios (confirmar, "Deshacer", nunca borra) |
| 037 | "+" flotante oculto en el asistente |
| 038 | La sincronización solo borra traídos que solapan la ventana leída |
| 039 | Búsqueda de eventos (`/dashboard/search`, tecla `/`, sin tildes, también sin conexión) |
| 040 | Recordatorios y notificaciones **Web Push** (VAPID propio con `node:crypto`) |
| 041 | Alta en lenguaje natural ("Escribe el evento", analizador propio en `lib/nl/`, sin IA) |
| 042 | Vistas Año y 4 días (atajos Y, X) |
| 043 | Exportar `.ics` y enlace secreto de suscripción |
| 044 | Importar a un calendario existente sin duplicar y "Mantener actualizado" desde un enlace (cada 6 h) |
| 045 | Zona horaria por evento (`start_tz`, `end_tz`) |
| 046 | Papelera de 30 días (`/dashboard/trash`) y pila de deshacer/rehacer de 20 acciones (enmienda 14) |
| 047 | Compartir un evento (Web Share o menú), recibir lo compartido (`share_target` → `sw.js` → IndexedDB `cafam-share` → `/dashboard/share`), accesos directos y número del icono (`profiles.badge_today`) |
| 048 | Notas: fecha por elemento (`note_items.due_date/due_time`), orden fraccionario arrastrando (`lib/notes/order.ts`), tareas en el calendario (`calendar_tasks`, `TaskBlock`), notas de un evento (`notes.event_id`), Venito crea notas (`create_notes`, `add_note_items`) |
| 049 | Confirmar el email al registrarse, traspasar un calendario (`transfer_calendar`, solo no traídos, revoca invitaciones/código/feed/suscripción) y "Descargar mis datos" (`.zip` *store* hecho a mano en `lib/export/`, en el navegador) |
| 050 | "Continuar con Google" con Supabase Auth (PKCE, `/auth/callback`), "Formas de entrar" en Ajustes; falta la prueba real (T5) |
| 052 | Venito propone borrar (papelera, "Deshacer") y crear series por campos (`ruleFromFields`), siempre con tarjeta que confirmar; conversaciones guardadas opcionales (`profiles.save_chats`, `assistant_conversations`: 50, 90 días, sin imágenes; menú del chat); dictado y lectura en voz alta con la Web Speech API del navegador (`lib/speech/`) |
| 053 | Interfaz en inglés: `profiles.locale` (Ajustes → Idioma, cookie y navegador sin sesión), catálogo `src/i18n/en/`, fechas con `dateFormat(locale)`, Venito responde en el idioma del perfil, correos por idioma (`email_outbox.locale`) |
| 054 | Pantalla **Ahora** (`/dashboard/now`): qué hace cada persona seguida ahora y después (`lib/now/cards.ts`, `NowBoard`, también sin conexión); "Pantalla de inicio" (`profiles.home`, `/dashboard` redirige, en el proxy para cargas de documento); `?only=<persona>` en el calendario; barra inferior "Ahora · Calendario · Notas · Más" |
| 051 | Diferidos de la 023: autor impuesto (trigger `events_author`, `convert_keep_author`), cuota del asistente reservada (`assistant_reserve`/`answered`/`release`), CSP completa + *Report-Only* (`lib/security/csp.ts`, `/api/csp-report`), plazo y reintento en los helpers de `test:db`, medida de la lectura por rango |

### Pendiente del usuario (comprueba antes si ya está hecho)

1. `supabase db push` a **prod antes de desplegar** de las migraciones aplicadas solo en dev: las de la 023 (`restore_event_guard`, `assistant_busy_scope`, `join_code_lock`), 028 (`notes`, `notes_calendar_functions`), 038 (`sync_apply_window`), 039 (`event_search`), 040 (`push`), 042 (`views_year`), 043 (`ics_feeds`), 044 (`ics_import_into`, `ics_subscriptions`), 045 (`event_time_zone`, `event_time_zone_keep`, `ics_feed_zone`), 046 (`trash_30_days`), 047 (`profile_badge`), 048 (`notes_more`), 049 (`account_more`), 050 (`oauth_profile_name`), 052 (`assistant_conversations`), 053 (`profile_locale`) y 054 (`profile_home`, ya aplicada en dev; **antes de desplegar**: `/dashboard` y el proxy leen `profiles.home`) —en dev tampoco están aplicadas: `npm run db:push`, `npm run db:types` y `npm run test:db -- assistant-conversations profile-locale`— y 051 (`event_author`, `assistant_quota_reserve`; **antes de desplegar**: la ruta del asistente llama a `assistant_reserve`).
2. Claves VAPID (`node scripts/make-vapid-keys.mjs`) en Vercel y `sync_app_url` en el Vault de prod.
3. Pruebas en iPhone/Android: push, sin conexión, Google/iCloud reales, papelera, zona horaria; eval y cierre de la 036.

Siguientes trabajos propuestos: periodos contiguos ya pintados (cambio de mes < 80 ms con CPU lenta), sacar zod del JS inicial, rediseñar formularios largos con estilo Nexo, quitar la cabecera *Report-Only* de la CSP tras revisar los avisos `csp-report` en producción, actualizaciones mayores de herramientas (cada una con su spec).

## 3. Reglas que más afectan a un agente

- **Flujo SDD (P7):** nada de código sin `spec.md` → `plan.md` → `tasks.md` aprobados **explícitamente** por el usuario, en ese orden, en `specs/NNN-nombre/`. Una tarea `Tn` cada vez, **test primero** (rojo → verde); cada commit cita su tarea. Skills: `spec-generator`, `plan-generator`, `tasks-generator`, `constitution-generator`. Pasar de fase y cerrar una spec exigen aprobación explícita. (Arreglos rápidos: ver memoria, sin spec y commit `fix:`.)
- **Verificación obligatoria (P8):** reporta la salida de
  ```
  npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
  npm run test:db   # si la tarea toca esquema, RLS o acceso a datos
  ```
  más prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Marca `[x]` en `tasks.md`.
- **Privado por defecto (P3):** toda tabla de `public` tiene RLS; la base de datos es la frontera de seguridad.
- **Secretos solo en el servidor (P4):** `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `GROQ_API_KEY`, `VAPID_PRIVATE_KEY`… nunca `NEXT_PUBLIC_`, nunca en git. La app **nunca usa `service_role`**; `tests/unit/no-secrets.test.ts` lo vigila.
- **Stack cerrado (P6):** solo las dependencias de §4; otra exige aprobación registrada en su spec. Prohibido: servicios de pago, analítica/telemetría (GA, Sentry…), librerías PWA (`next-pwa`, Serwist, Workbox), ORMs, backends paralelos, gestores distintos de npm.
- **Identidad visual (P9, Nexo):** solo tokens y componentes de `components/ui` (guardia `design-tokens.test.ts`); capturas a 390, 768 y 1440 px, claro y oscuro, con Violeta y Ámbar (`scripts/screenshots.mjs`). Móvil primero.
- **Acciones sobre producción** (`supabase db push` a prod, `git push`, merges a `main`): las ejecuta el usuario; prepárale los comandos exactos.

## 4. Stack

TypeScript 5 `strict` (sin `any`), Node 24 · **Next.js 16.4.6** (App Router, Turbopack, Server Components/Actions, `cacheComponents`), React 19.3 · Tailwind CSS 4 (`@tailwindcss/postcss`) · Supabase Free (Postgres 17 + RLS, Auth, Storage, Realtime, `pg_cron`, `pg_net`, Vault) con `@supabase/ssr` · `zod` 4 · Vercel Hobby (funciones en `dub1`) · PWA con `src/app/manifest.ts` y `public/sw.js` propios · Vitest 5 (proyectos `unit` jsdom y `db` node) + Testing Library · ESLint 9 + Prettier 3 · Supabase CLI (devDependency).

Dependencias de producción (no deben crecer sin aprobación): `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `ical.js` 2.2.1 (solo servidor: `lib/ics/parse-ics.ts`, `lib/recurrence/expand.ts`, `lib/sync/icloud-ics.ts`; en el cliente solo con `import()` en `lib/offline/series-overlay.ts`) y `tsdav` 2.5.0 exacta (solo `lib/sync/providers/icloud.ts`). LLM: Groq por `fetch`, sin SDK.

## 5. Estructura

```
AGENTS.md (CLAUDE.md lo importa) · docs/constitution.md · specs/NNN-nombre/
src/
  proxy.ts                 # "middleware" de Next 16: refresca sesión + getRouteAccess()
  app/
    layout.tsx, globals.css (tokens @theme, acentos, @utility), manifest.ts, page.tsx (portada)
    (auth)/                # login, signup, forgot-password, reset-password + actions.ts
    auth/confirm/          # verifyOtp de los correos de Auth
    dashboard/             # marco (layout.tsx + slot @modal); calendar/, calendars/, events/, notes/,
                           # settings/, connections/, assistant/, search/, trash/, join/, import/
    invite/[token]/, offline/, privacy/
    api/                   # assistant, cron/keep-alive, ics/{export,refresh,[token]}, images/purge,
                           # oauth/[provider]/{start,callback}, offline/{apply,image}, push/run,
                           # sync/{run,google-push}
  components/
    ui/                    # Button, IconButton, TextField, Select, Card, Chip, Sheet, EmptyState, Switch, Toast, TimeField…
    shell/                 # AppFrame, TopNav (≥769 px), TopBar + BottomBar (móvil), CreateButton, AssistantFab, icons
    calendar/ (vistas, workspace, EventBlock, EventCard, QuickCreate, EventModal, NlField, undo-stack…),
    assistant/, notes/, offline/, recurrence/, comments/, images/, connections/, sharing/, groups/,
    search/, account/, auth/, brand/ (LogoMark, Venito), pwa/
  lib/                     # lógica pura testeada + queries.ts (lecturas con RLS) por dominio:
    auth, calendar, recurrence, sync (+ providers/), ics, offline, assistant, nl, push, search,
    notes, comments, images, sharing, availability, motion, theme, shell, hooks, supabase/{server,client,proxy}
  types/database.ts        # GENERADO (npm run db:types); no editar ni formatear
public/sw.js, public/icons/ · supabase/migrations/ · tests/{unit,integration,fixtures} · scripts/ (e2e, capturas, perf)
```

Archivos en kebab-case (`login-form.tsx` exporta `LoginForm`), salvo los reservados de Next. Rutas URL en inglés.

## 6. Arquitectura

Monolito Next.js en Vercel + Supabase (Auth y Postgres, donde **RLS impone los permisos**). Server Components leen con la sesión del usuario; Server Actions escriben.

### Rutas

- **Acceso:** función pura `getRouteAccess(pathname, hasSession)` en `lib/auth/route-access.ts`; una ruta nueva se protege **ahí**. `/dashboard/*` exige sesión (→ `/login`); `/login` y `/signup` sin sesión; `?next=` solo se sigue si es `/invite/<token>`. `/` con sesión redirige a `/dashboard/calendar` (lo hace la página).
- `/dashboard/calendar?view=agenda|month|week|day|4days|year&date=YYYY-MM-DD` (sin `view`: `profiles.last_view`).
- `/dashboard/events/new` y `/dashboard/events/[id]`: dentro de la app se abren en ventana (`@modal/(.)events/…`); recarga o enlace, página completa. Los datos salen de `load-new-event.ts` y `load-event.ts`.
- Páginas de calendario: `edit` y `share` solo propietario, `categories` propietario/editor, `members` cualquier miembro, `upload` propietario de uno normal; si no, 404.
- **APIs con `Authorization: Bearer ${CRON_SECRET}`** (POST, comprobado con `hasCronSecret`): `sync/run`, `images/purge`, `push/run`, `ics/refresh` (las despierta `pg_cron` vía `*_trigger()` con `sync_app_url` del Vault) y `cron/keep-alive` (GET, cron diario de Vercel).
- **Públicas:** `/offline`, `/privacy`, `/invite/[token]` (preview con sesión; `no-referrer`, `noindex`), `/api/sync/google-push` (siempre 200), `/api/ics/<token>.ics` (el token es la credencial; 404/429 sin cuerpo).
- **Con sesión:** `/api/assistant` (POST NDJSON `status`/`action`/`done`/`error`; 400/401/429 en JSON; GET 204 precalienta), `/api/ics/export`, `/api/offline/{apply,image}` (los usa el service worker), `/api/oauth/[provider]/{start,callback}`.
- Cabeceras de seguridad en `next.config.ts`: la regla global va primera porque **gana la última que coincide**. La CSP sale de `buildCsp()` (`lib/security/csp.ts`): un origen externo nuevo (imágenes, `fetch`, formularios) debe añadirse ahí o el navegador lo bloquea. `script-src` lleva `'unsafe-inline'` porque Next inserta scripts en línea por petición y el nonce es incompatible con PPR (051 D3); un script en línea propio nuevo necesita su hash en `scriptHashes`. `/api/csp-report` es pública y solo registra.

### Autenticación

`signUp` valida con zod (email en minúsculas, contraseña 8–72, nombre 1–50) y envía `display_name` y `time_zone` (del navegador; inválida → `Europe/Madrid`). "Confirm email" (049): sin sesión en la respuesta, `signUp` guarda el email y el `next` en la cookie httpOnly `cafam_pending` y lleva a `/signup/check-email?email=<enmascarado>`; "Reenviar" limitado por `request_signup_resend` (1/min, 3/15 min); `/auth/confirm` acepta `type=signup|email` → `/dashboard/calendar?confirmed=1` (o la invitación guardada); `signIn` traduce `email_not_confirmed`. Mientras siga desactivado en Supabase, el registro entra al momento. Cuentas sin confirmar se purgan a los 7 días. **Google (050):** "Continuar con Google" (`GoogleButton`, oculto sin `NEXT_PUBLIC_GOOGLE_LOGIN=1`) → `signInWithGoogle` (`signInWithOAuth` con PKCE, solo `openid email profile`) → `/auth/callback` (`exchangeCodeForSession`, `next` seguro o `/dashboard/settings` al enlazar; añade `?tzcheck=<zona>` a una cuenta recién creada, que lee `TimeZoneCheck`). `handle_new_user` toma `full_name`/`name`. "Formas de entrar" en Ajustes (`linkIdentity`, `unlinkIdentity` solo con contraseña, "Crear contraseña" marca `user_metadata.has_password` porque Supabase no dice si hay contraseña: usa `signInMethods()`); sin contraseña, borrar la cuenta pide solo el email. Es independiente de la conexión de Google Calendar (007). Apple, imposible a coste cero (99 USD/año). Errores traducidos en `lib/auth/error-messages.ts`. `signOut` con `scope: "local"`. Correo de Auth por SMTP de Brevo; avisos de cuenta desde Postgres (`pg_net` → API de Brevo, claves en Vault).

### Base de datos (conceptos clave)

- Roles `calendar_role`: `owner | editor | viewer` (Propietario, Editor, Lector). El propietario también tiene su fila en `calendar_members`. Permisos con `is_calendar_member(id)` y `calendar_role_for(id)` (`SECURITY DEFINER`, `search_path = ''`). Leen los miembros; escriben eventos owner y editor; calendarios solo owner. `anon` no ve nada.
- **Funciones `SECURITY DEFINER` con `search_path = ''`**; las que usa el servidor sin sesión reciben `p_secret`, comparado con `cron_secret` del Vault (así nunca hace falta `service_role`). Códigos propios: `CF404` (no existe / no es para ti), `CF429` (límite, con mensaje), `CF410`; `22023` argumento inválido, `42501` sin permiso. Hashes ocultos con permisos por columna.
- **Fechas:** eventos con hora = instantes UTC mostrados en la zona del **perfil** (leída del servidor) o en la suya propia (`start_tz`/`end_tz`, 045). Día completo: 00:00 **UTC** del primer día a 00:00 UTC del día siguiente al último (exclusivo), mostrado por fecha UTC.
- **Series (013):** una fila con `recurrence` (RRULE sin `DTSTART`), `recurrence_tz`, `recurrence_until`, `exdates`; se expanden al leer con `ical.js`. Repetición sin fila: id `<uuid>_<YYYYMMDDTHHMMSSZ>` (`parseEventId`, nunca `z.uuid()`). Excepción: fila con `series_id` y `original_start`. SQL no expande reglas: los argumentos los calculan `planSeriesChange`/`planSeriesDelete`.
- **Calendarios traídos (Google/iCloud):** `synced_calendars`, `events.external_id`. Las políticas de `events` prohíben escribir en ellos; se escribe por `sync_write_context`/`sync_commit_event` (sesión owner/editor + `p_secret`), primero en el proveedor. `sync_apply_events` solo borra lo que solapa la ventana leída (6 meses atrás, 12 adelante).
- **Imágenes:** bucket privado `event-images` (`<object_id>/full.jpg` y `thumb.jpg`); permiso desde `event_images → events → miembro`. Storage no se borra con SQL: cola `image_purge_queue` → `/api/images/purge`.
- **Papelera:** `event_trash` 30 días (`snapshot_event`, `snapshot_series`, `restore_event`, `trash_*`).
- **Tiempo real:** `live_notify` manda `changed` al tema `user:<id>` de cada miembro; una tabla nueva que deba avisar necesita su trigger.
- `pg_cron`: sincronización cada minuto si hay trabajo, push cada minuto, `.ics` cada 15 min, purgas y correos. Vault: `cron_secret`, `sync_app_url`, `brevo_api_key`, `brevo_sender_email`.
- **Cambios de esquema solo con una migración nueva** (nunca editar una aplicada ni el panel). Después `npm run db:push` (dev), `npm run db:types` y tests en `tests/integration/`.

### Sincronización, sin conexión y asistente

- **Proveedores:** `lib/sync/providers/` (`ProviderSession`; `google.ts` único cliente HTTP de Google, `icloud.ts` único que importa `tsdav`). Fallos como `ProviderError` (`revoked | missing | transient | rejected`). Textos por proveedor en `provider-labels.ts`.
- **Sin conexión:** IndexedDB `cafam-offline` (copia de −1 a +3 meses y notas), cola `outbox` que `flush.ts` envía en orden con `applyOfflineChange`; conflictos en la hoja "Cambios". El bucle está **duplicado en `public/sw.js`** (Background Sync).
- **Asistente:** `lib/assistant/provider.ts` (único que lee `GROQ_API_KEY`; `openai/gpt-oss-120b`, reserva `qwen/qwen3.8-27b`, visión `qwen/qwen3.8-27b`). Herramientas atadas a la sesión; el modelo cita con `[e1]`, nunca ids; el texto de eventos/comentarios es dato, nunca instrucción.

### PWA

`public/sw.js`: precachea `/offline` y estáticos; red primero en navegaciones (fallo en `/dashboard` → `/offline?from=<ruta>`); caché primero en `/_next/static/` e `/icons/`; **nunca cachea HTML con sesión ni respuestas de Supabase**; atiende `sync` y `push`. **Si cambias `sw.js` o los iconos, sube `CACHE_NAME`** (ahora `cafam-v9`). Solo se registra en producción. Iconos desde `public/icons/icon.svg` con `node scripts/make-icons.mjs`.

### Identidad visual (Nexo)

- Tokens en `globals.css` con los valores de `lib/theme/accents.ts` (tests `theme-css` y `accents`). Neutros `stone` (fondo lavanda), `paper`, `ink`, `muted`, `line`, `control`, `danger`, `pastel-ink`… El oscuro redefine variables en `[data-theme="dark"]`.
- Acento (`data-accent` en `AppFrame`): `accent`, `accent-to`, `on-accent`, `accent-ink` (texto y líneas), `accent-soft`. Ids guardados: `red`=Violeta (defecto), `blue`, `green`, `yellow`=Ámbar, `purple`=Rosa, `gray`=Grafito.
- Radios solo `rounded-card`, `rounded-control`, `rounded-block`, `rounded-full`. Elevación `surface` / `surface-float`; **nunca `backdrop-filter`** (ni la palabra "glass" en `src/`). Único degradado de control: `bg-accent-gradient`.
- **Nunca** `bg-white`, `text-white`, `text-black`, `dark:`, colores de la paleta de Tailwind ni hex en clases; un color que viene de datos va en `style`. Inter; `tabular-nums` en horas y cifras. Iconos SVG propios en `components/shell/icons.tsx`. Animaciones ≤ 400 ms con versión para `prefers-reduced-motion`.

## 7. Entornos y variables

| Entorno | Supabase | Uso |
|---------|----------|-----|
| dev | `calendario-dev` (ref `uthubyzhonrtrmbcqcjh`) | `npm run dev`, `test:db`. **El link de la CLI apunta siempre aquí** |
| prod | `calendario-prod` (ref `yznbdoskvtxeasujtirk`) | Vercel |

- Vercel despliega cada push a `main` y hace previews de las ramas (apuntan a prod y no tienen Google). Una rama por spec; integración con `git merge --ff-only`; `main` siempre desplegable.
- Migraciones a prod (las ejecuta el usuario):
  ```
  npx supabase link --project-ref yznbdoskvtxeasujtirk
  npx supabase db push
  npx supabase link --project-ref uthubyzhonrtrmbcqcjh   # volver a dev inmediatamente
  ```
- Variables (en `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET` (= `cron_secret` del Vault), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `SYNC_PUSH_URL` (solo Vercel Production), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_GOOGLE_LOGIN` (`1` con el proveedor activo), y `SUPABASE_SECRET_KEY` **solo en `.env.test.local`**. `.env.local` y `.env.test.local` apuntan a dev: no los leas ni los muestres.
- Google: app "CaFam" publicada sin verificar (tope 100 usuarios). Scopes en `lib/sync/scopes.ts`; sin todos, la cuenta es de solo lectura (`can_write = false`). En dev el OAuth solo funciona en el puerto 3000.
- Pasos de configuración manual: correo en spec 006, sincronización en `specs/007-sincronizacion-oauth/plan.md` ("Pasos de producción").

## 8. Comandos

```
npm run dev            # puerto 3000 (el usuario suele tenerlo abierto: usa npx next start -p 3100)
npm run typecheck | lint | format | format:check
npm test [-- filtro]   # unit (jsdom)
npm run test:db        # integración contra Supabase dev
npm run db:push        # migraciones al proyecto enlazado (dev)
npm run db:types       # regenera src/types/database.ts
npm run eval:assistant # 39 preguntas a Groq (~10 min, gasta cuota; EVAL_ONLY=36-39, EVAL_PART=read|write)
npm run eval:schedule  # 12 horarios al modelo con visión (~12 min, gasta cuota)
```

## 9. Patrones del código

- **`cacheComponents`:** leer cookies/sesión solo en un componente `async` dentro de `<Suspense>`, con `await connection()` antes de crear el cliente. `page.tsx` síncrono; `params`/`searchParams` se esperan dentro. `[id]` inválido o ajeno → `notFound()`.
- **Cliente de Supabase:** `@/lib/supabase/server` (Server Components, Actions, Route Handlers, con tipo `Database`), `client` en Client Components, `proxy` solo en `proxy.ts`.
- **Server Actions que escriben:** zod con mensajes en español, `requireActionUser()` (componentes: `requireUser()`), errores con `getCalendarErrorMessage`, `revalidatePath("/dashboard", "layout")` antes de `redirect()` (fuera del `try`). Devuelven estado tipado (`fieldErrors`, `formError`, `values`). Un `update`/`delete` con 0 filas se explica con `canSeeCalendar`/`canSeeEvent`.
- **Formularios React 19:** campos **no controlados** (`defaultValue` desde `state.values`); ids con `useId()`; `useActionState` pasa `(prevState, formData)` también a las acciones con `bind`.
- **Ventana de evento:** con `useEventModal()` el formulario envía `mode=modal` y la acción devuelve `{ done }`; `finish(done)` avisa, vuelve atrás y refresca. Atiende cada resultado **una sola vez** por objeto de estado (`useRef`), por Activity. `data-autofocus` para el foco inicial de un `<dialog>`.
- **Calendarios traídos:** decide la interfaz con `canWriteEvents`, `moveTargets`, `readOnlyReason`, `canMerge` (`lib/sync/read-only.ts`), nunca `role !== "viewer"`. Escrituras con `writeEvent` y `writeEngineDeps(supabase)`; el motor con `engineDeps()` (clave publicable + `CRON_SECRET`). Un componente `"use client"` no importa el motor.
- **Navegar por el calendario:** `useCalendarGo()` y `CalendarLink`, nunca `router.push(calendarHref(...))`. Datos que cambian con el periodo, desde `useEventWindow` o una acción perezosa. Enlaces repetidos (días, eventos) con `prefetch={false}`.
- **Móvil/escritorio:** variantes `max-tab:` (≤ 768 px) y `tab:` (≥ 769 px), no `md:`; en JS `useIsPhone()`. Ventanas del móvil con `Sheet`; cierra el `<dialog>` en la limpieza del efecto.
- **Autor y cuota (051):** `events.created_by` lo pone el trigger `events_author` en las escrituras directas del cliente (rol `authenticated`); las funciones `SECURITY DEFINER` conservan el autor que elijan. La cuota del asistente se reserva con `assistant_reserve()` (CF429) y se confirma (`assistant_answered`) o libera (`assistant_release`); el cliente ya no inserta en `assistant_questions`.
- **Escrituras de eventos/notas desde la interfaz:** pasan por `lib/offline/event-actions.ts` o `note-actions.ts` (`withOutbox`) y necesitan su tipo en `OfflineChange`, `describe.ts`, `applyOfflineChange`/`offline-writes.ts` **y** su caso en `sw.js` (con caso en `tests/unit/offline-flush-cases.ts`). Red: `useConnection()`, nunca `navigator.onLine` a secas.
- **Interacciones con eventos:** `useEventInteractions()` (optimista, "Deshacer", menú); deshacer apila con `useUndoToast()`; refrescos ajenos en pausa con `useHoldLive`. Pantallas con datos ajenos: `useLiveCalendar(userId)`.
- **Textos e idioma (053):** el texto español es la clave; su inglés va en `src/i18n/en/<área>.ts` (sin él falla `i18n-complete`). Cliente: `const t = useT()` → `t("Guardar")`, `t("Hola, {name}", { name })`, plurales con `plural()`; `useLocale()` para fechas con `dateFormat(locale, opciones)` (`lib/i18n/format.ts`, nunca `toLocaleString` ni `Intl.DateTimeFormat("es-ES")` a mano). Server Component: `<T>{"Texto"}</T>` o `<T vars={{ n }}>{"{n} eventos"}</T>`; para un atributo DOM, `aria-labelledby` a un `<span hidden><T>…</T></span>`. Props de título de `PageShell`, `Section`, `Row`, `EmptyState`, `ErrorScreen`, `AuthCard`, `EventModal`, `FoldSection`, `ConfirmDialog` (con `vars`) se pasan en español: el componente traduce (lista en `TRANSLATED_PROPS` de `tests/unit/i18n-scan.ts`). Funciones puras que componen textos: últimos parámetros `t: T = spanishT`, `locale: Locale = DEFAULT_LOCALE`. Servidor que compone textos con valores (asistente, acciones): `translator(await getProfileLocale(supabase, userId))`. Las Server Actions devuelven español y el componente lo traduce al mostrarlo. Nunca una plantilla `` `…${x}…` `` con texto visible: usa `{x}`. El catálogo inglés no debe llegar al JS en español (solo `layout.tsx` del panel, `translator.ts` y el `import()` de `BrowserLocale`).
- **Atajos:** en `SHORTCUTS` (`lib/calendar/shortcuts.ts`), que alimenta teclas y ayuda (?).
- **Movimiento:** duraciones y curvas de los tokens (`motionMs`, `motionToken`); animaciones de script con `play()`.
- **Hora actual:** `useNow()` en cliente; nada de `Date.now()` en el cuerpo de un Server Component. Valores solo del navegador con `useSyncExternalStore`.
- **Accesibilidad:** etiqueta visible en cada campo, errores con `aria-describedby` y `role="alert"`, botones `min-h-11`, todo usable con teclado. Avisos con `useToast().show()`.
- **Tests:** Testing Library por rol/etiqueta con textos en español; Route Handlers con `// @vitest-environment node`; integración crea y borra usuarios con `tests/integration/helpers.ts` (dominio `@cafam.test`).
- **Comentarios** en inglés, breves, el porqué con su requisito (`// ... (RF-26, plan D13)`). **Commits** Conventional en español con la tarea: `feat: registro de usuario (T7)`.

## 10. Trampas conocidas

**Next y React**
- `middleware.ts` es `proxy.ts`; consulta `node_modules/next/dist/docs/` antes de usar una API. `LayoutProps<"/ruta">` de una ruta nueva no existe hasta el build: tipa `children` a mano.
- **Activity:** Next conserva la página anterior oculta en el DOM (ids duplicados; en Playwright filtra `visible=true`). Las rutas interceptadas reaparecen con su estado y efectos: `EventModal` cierra el diálogo y remonta en la limpieza; los formularios atienden cada resultado una vez. Al borrar desde la ventana, la ruta interceptada devuelve `<GoneEvent />`, no `notFound()` (convertiría toda la página en 404).
- `setState` en el cuerpo de un efecto lo prohíbe el lint: hazlo en la limpieza. `react-hooks/refs` prohíbe devolver un `ref` desde un hook.
- `pushState` funciona porque Next lo parchea; no uses claves `__NA`/`_N` en el `state`.
- El cuerpo de Server Actions está limitado (`bodySizeLimit` 3 MB). El service worker no puede llamar a Server Actions (por eso existen `/api/offline/*`).
- `hidden` en `LinkButton` no oculta (gana `inline-flex`): envuélvelo. `not-sr-only` reactiva el salto de línea. Una regla de CSS en `@layer` pierde ante una utilidad.
- Un toque genera un `click` sintético tras `pointerup`; el evento `close` de un `<dialog>` llega después del cambio de estado.

**Base de datos y Supabase**
- Una migración aplicada no se edita: la corrección va en otra. En plpgsql `PERFORM` reinicia `FOUND`. `now()` es igual en toda la transacción (usa `clock_timestamp()`). Tablas temporales en `SECURITY DEFINER`: `pg_temp.nombre` y `on commit drop`. `pg_timezone_names` es lento en triggers.
- PostgREST devuelve como mucho 1.000 filas (pagina con `allRows`); un `insert` de varias filas necesita las mismas claves en todas.
- Los tipos generados no admiten `null` en argumentos de funciones (`as never` / `null as unknown as string`).
- Storage: el CDN cachea por URL y token; `downloadImage` usa `/object/authenticated/…?v=<uuid>` con `no-store` (no lo cambies). URL firmadas de subida fallan si el objeto ya existe.
- **Tras usar el link de prod, vuelve a enlazar dev.**
- En dev `pg_cron` no llega a `localhost`: llama a mano a `POST /api/sync/run`, `/api/push/run`… con `Bearer $CRON_SECRET`. Si arrancas con `SYNC_PUSH_URL` se crean canales reales de Google: bórralos.
- `test:db` es intermitente (límite de Auth `Request rate limit reached`): los helpers ya reintentan la gestión de usuarios (2 y 5 s) y cortan un cuelgue a los 15 s con "Supabase dev no respondió…" (051, `tests/integration/net.ts`); si aun así falla, repite o usa `--no-file-parallelism`. Drena los calendarios pendientes de dev. El reloj local va por delante del de la BD: para "caducar" algo retrasa una hora.

**Proveedores y formatos**
- `ical.js` deja los `TZID` como hora de pared: `parse-ics.ts` los convierte. iCloud empareja repeticiones por la hora de pared de la serie (`RECURRENCE-ID`/`EXDATE` con la misma `TZID`). Las reglas de prueba se escriben como la app (`FREQ=WEEKLY;INTERVAL=1;BYDAY=TH`).
- La descarga de `.ics` usa `node:https` con `lookup` propio (anti-SSRF): no la cambies por `fetch`; un `.ics` en `localhost` se rechaza.
- Groq: cuota **por organización** (200K tokens/día y 8K/min por modelo, compartida por dev, evals y prod); no lances el eval más de una o dos veces al día; si se corta deja usuarios `@cafam.test` en dev. Responde a veces 400 `tool_use_failed`, 413 o 5xx (pasa al modelo de reserva). Con imágenes no funcionan las herramientas ni `json_schema` estricto.
- Un evento borrado en CaFam durante una sincronización puede reaparecer hasta la siguiente; un evento traído anterior a la ventana nunca se borra; si Google mueve un evento entre calendarios pierde sus imágenes. No son fallos.
- Brevo reescribe el remitente a `…@<id>.brevosend.com`: busca ahí un correo "perdido".

**Herramientas y entorno**
- `core.autocrlf=true`: si `format:check` falla en masa por CRLF, `npx prettier --write .`. `docs/`, `specs/` y `AGENTS.md` están en `.prettierignore`. Al editar con Python: `encoding='utf-8', newline=''`. Evita heredocs en Bash para escribir archivos: usa Write.
- Tailwind solo escanea `src/`.
- Navegador real: `playwright-cli` global; usa `chromium.launch({ channel: "msedge" })`. Arranca con `npx next start -p 3100`; al parar, mata el PID del puerto (`netstat -ano | grep :3100`). Limpia cookies tras borrar un usuario de prueba y borra `.playwright-cli/` al terminar. `networkidle` puede no llegar nunca (Realtime).
- El panel del navegador de la app no registra service workers (sin conexión y push se prueban con Playwright + Edge: `scripts/e2e-offline*.mjs`, `e2e-push.mjs`); oculto, pausa animaciones y falla capturas.
- jsdom: sin `showModal()`, `scrollIntoView`, layout, `elementsFromPoint` ni `cancel` al pulsar Escape (simúlalos); `user.upload` no llega al `FormData`. En tests espera al texto (`findByText`) antes de comprobar `aria-describedby`. Pasa arrays estables a los arneses de las vistas. El IndexedDB de memoria no tiene `close()`.
- `es-ES` no agrupa números de 4 cifras: usa `formatCount`. Los cursores de comentarios usan `created_at` tal cual (microsegundos).
- iOS no admite `share_target` ni accesos directos, y el número del icono solo con la PWA instalada y avisos: solo funciona "Compartir". El `POST /share-target` lo atiende `sw.js`; sin service worker que controle la página, Next responde 404 (no es un fallo). Lo compartido vive 10 min en IndexedDB `cafam-share`. Prueba real: `scripts/e2e-share.mjs`.
- La primera petición tras un despliegue puede tardar (arranque en frío). iOS no cambia el icono instalado hasta reinstalar la app. Cambiar las claves VAPID invalida todas las suscripciones.

## 11. Fuera de alcance hasta su spec

Otros idiomas además de español e inglés, el manifest y los títulos de pestaña traducidos; sincronizar en dos direcciones un calendario importado, importar el `.zip` exportado o traspasar con aceptación, entrar con Apple (de pago), GitHub u otros proveedores, Microsoft (exige tarjeta), avisos por correo o de notas, lo excluido en las specs 034/035; en el asistente: borrar varios eventos a la vez (más de 3), cambiar la regla de una serie existente, voz propia (servidor) o sincronizar conversaciones con otros miembros; en notas: gesto de deslizar en un elemento, avisos de tareas y la sección "Notas" de un evento sin conexión.
