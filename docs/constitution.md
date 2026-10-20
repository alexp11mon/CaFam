# Constitution - CalendarioFamilia

## Contexto y objetivo

CalendarioFamilia es una aplicación web progresiva (PWA) de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso estrictamente personal entre familia y amigos. Cada usuario se registra, gestiona sus calendarios desde un panel, crea eventos y los comparte con otras personas asignándoles un rol (Lector o Editor). También puede suscribirse en solo lectura a calendarios externos (Google, iCloud, Outlook) mediante enlaces iCal/.ics para verlos en la misma interfaz.

Queda fuera a propósito: cualquier uso comercial, monetización, publicidad, analítica de terceros, multi-organización o funcionalidades de equipo/empresa, y cualquier servicio que tenga coste económico.

### Hoja de ruta de specs (orientativa, cada una exige su propia spec aprobada)

| Spec | Alcance |
|------|---------|
| 001-base-aplicacion | Proyecto base, autenticación email/contraseña, esquema de datos base con permisos, panel esqueleto, PWA instalable, despliegue |
| 002-calendarios-y-eventos | CRUD de calendarios y eventos, vistas mensual, semanal y diaria |
| 003-comparticion | Enlace de invitación único, ID de calendario + PIN, gestión de roles Lector/Editor |
| 004-suscripciones-ical | Fase 1 de integración: suscripción de solo lectura a enlaces .ics de Google, iCloud y Outlook |
| 005-gestion-de-cuenta | Recuperación de contraseña, cambio de email, borrado de cuenta (requiere SMTP gratuito) |
| 006-sincronizacion-oauth | Fase 2 (futura): sincronización bidireccional con APIs vía OAuth 2.0 |

## Principios innegociables

- P1: Uso personal sin ánimo de lucro: el proyecto no incluye publicidad, venta de datos, tracking ni analítica de terceros. Se verifica revisando `package.json` y los imports en cada diff: no puede aparecer ningún SDK de ads, analytics o tracking.
- P2: Coste cero: todo servicio usado funciona en su capa gratuita (Supabase Free, Vercel Hobby, GitHub Free) y ningún servicio tiene tarjeta de pago asociada al proyecto. Se verifica revisando en la spec que cada servicio nuevo indica su plan gratuito y sus límites.
- P3: Privado por defecto: ningún dato de un calendario es visible para quien no sea su propietario o un miembro invitado con rol explícito, y toda tabla del esquema `public` tiene Row Level Security activado. Se verifica con `npm run test:db` en verde (matriz de permisos) y con el test que comprueba que ninguna tabla de `public` tiene RLS desactivado.
- P4: Los secretos solo viven en el servidor: ninguna clave secreta (`service_role`/secret key de Supabase, `CRON_SECRET`, tokens OAuth) lleva prefijo `NEXT_PUBLIC_`, se importa desde código de cliente ni se sube a git. Se verifica con `git check-ignore .env.local` y buscando `NEXT_PUBLIC_.*SECRET` y `service_role` en el diff (cero resultados en `src/`).
- P5: PWA mobile-first: toda pantalla se usa sin scroll horizontal entre 360 px y 1920 px de ancho y la app es instalable (manifest + service worker válidos). Se verifica en Chrome DevTools > Application (manifest sin errores, service worker activo) y con prueba manual en móvil y escritorio.
- P6: Stack cerrado: solo se usan lenguajes, dependencias, servicios y herramientas listados en "Stack permitido"; cualquier otro exige aprobación explícita registrada en la spec que lo introduce. Se verifica comparando `package.json` y los imports con esta constitución y la spec activa.
- P7: Flujo SDD obligatorio: no se escribe código sin spec, plan y tareas aprobados explícitamente por el usuario, en ese orden, y cada tarea se implementa de una en una con su test primero. Se verifica comprobando que cada cambio de código cita una tarea `Tn` de un `tasks.md` aprobado.
- P8: Ninguna tarea se da por hecha sin ejecutar y reportar la verificación obligatoria. Se verifica con el checklist de "Verificación obligatoria" completo y su salida reportada al cerrar cada tarea.

## Stack permitido

- Lenguaje y versión: TypeScript 5.x en modo `strict`, sobre Node.js 24 LTS (mínimo Node 20.9, requisito de Next.js 16).
- Frontend: Next.js 16 (App Router, Turbopack, Server Components y Server Actions), React 19, Tailwind CSS 4.
- Backend / BaaS: Supabase Free (PostgreSQL con RLS, Supabase Auth email/contraseña). Región de datos en la UE.
- Hosting: Vercel Hobby (incluye su Cron Job diario) con repositorio en GitHub (privado).
- PWA: nativa de Next.js (`app/manifest.ts`) + service worker propio en `public/sw.js`, sin librerías PWA.
- Dependencias de producción aceptadas: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, y las que genera `create-next-app` por defecto.
- Dependencias de desarrollo aceptadas: `typescript`, `@types/*`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `eslint-config-prettier`, `prettier`, `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `supabase` (CLI para migraciones y generación de tipos).
- Herramientas obligatorias: npm como gestor de paquetes (con `package-lock.json` versionado), git, Vitest para tests, ESLint + Prettier para lint y formato, Supabase CLI para migraciones.

## Stack prohibido

- Cualquier servicio, hosting o API de pago, o capa gratuita que exija tarjeta de crédito.
- SDKs de publicidad, analítica, tracking o telemetría de terceros (Google Analytics, Meta Pixel, Hotjar, Sentry, etc.).
- Librerías PWA de terceros (`next-pwa`, `@serwist/*`, Workbox) sin aprobación en spec: el service worker es propio.
- ORMs u otras capas de acceso a datos sobre Supabase (Prisma, Drizzle) y backends paralelos: Supabase es la única fuente de datos.
- Otro gestor de paquetes (yarn, pnpm, bun) o lockfiles distintos de `package-lock.json`.
- Cualquier dependencia no listada en "Stack permitido" sin aprobación en la spec que la introduce (por ejemplo, la librería de vistas de calendario o de parseo .ics se decide y aprueba en su spec).

## Convenciones

- Formato: Prettier automático; `npm run format` para formatear y `npm run format:check` para verificar.
- Tipado: `strict: true`, prohibido `any` explícito (regla de ESLint en error); `npm run typecheck` (`tsc --noEmit`) sin errores.
- Nombres de código: inglés; camelCase para variables y funciones, PascalCase para componentes React y tipos, UPPER_SNAKE_CASE para constantes globales.
- Nombres de archivos y carpetas: kebab-case (`login-form.tsx` exporta `LoginForm`), salvo los nombres reservados de Next.js (`page.tsx`, `layout.tsx`, `proxy.ts`, `[param]`, `(grupo)`).
- Rutas URL: en inglés (`/login`, `/signup`, `/dashboard`), coherentes con los nombres de carpetas.
- Base de datos: snake_case; tablas en plural (`calendars`), columnas en singular (`owner_id`); toda tabla con `created_at` y, si es editable, `updated_at`; cambios de esquema solo mediante migraciones en `supabase/migrations/`, nunca editando a mano en el panel de Supabase.
- Fechas: se guardan como `timestamptz` (UTC) y se muestran en la zona horaria del usuario.
- Estructura: `docs/` (constitución y docs generales), `specs/NNN-nombre/` (`spec.md`, `plan.md`, `tasks.md`), `src/` (código de la app), `tests/unit/` y `tests/integration/`, `supabase/migrations/`, `public/` (iconos, service worker). Los ficheros de configuración de herramientas viven en la raíz.
- Idioma: español en docs, specs, mensajes de commit y textos visibles para el usuario (incluidos errores); inglés en identificadores de código, nombres de archivos y comentarios técnicos. Se verifica en revisión del diff.
- Git: rama `main` desplegable siempre; una rama por spec (`001-base-aplicacion`); commits pequeños con prefijo Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) y referencia a la tarea (`feat: registro de usuario (T7)`).
- Variables de entorno: documentadas en `.env.example` sin valores reales; los valores viven en `.env.local` (ignorado por git) y en el panel de Vercel.

## Verificación obligatoria

Checklist que cierra cada tarea (se reporta la salida de cada comando):

- [ ] Tipos sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`
- [ ] Formato correcto: `npm run format:check`
- [ ] Tests unitarios y de componentes en verde: `npm test`
- [ ] Tests de base de datos y permisos en verde: `npm run test:db` (obligatorio si la tarea toca esquema, RLS o acceso a datos; ver P3)
- [ ] Build de producción sin errores: `npm run build`
- [ ] Prueba manual en móvil (≤ 768 px) y escritorio si la tarea toca interfaz (ver P5)
- [ ] Aprobación explícita del usuario antes de pasar de fase (spec → plan → tareas → implementación) y al cerrar cada spec

## Dudas abiertas

- Ninguna pendiente. Las decisiones de stack de esta versión (Next.js 16 + Supabase Free + Vercel Hobby + Tailwind CSS 4) fueron confirmadas por el usuario en la spec 001.
