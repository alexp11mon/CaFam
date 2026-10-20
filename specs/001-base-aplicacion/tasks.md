# Tasks 001 - Base de la aplicación

> Estado: **Borrador, pendiente de aprobación** (requiere plan aprobado).
> Spec: `specs/001-base-aplicacion/spec.md`. Plan: `specs/001-base-aplicacion/plan.md`.
> Reglas: una tarea cada vez, test primero, y al cerrar cada tarea se ejecuta y reporta el checklist de "Verificación obligatoria" de la constitución (P7, P8).

## Tareas

- [ ] T1 Inicializar git y el proyecto Next.js 16 con TypeScript estricto, Tailwind y estructura de carpetas
  Pasos: Anexo B del plan, pasos 1–2; crear `src/components/`, `src/lib/`, `src/types/`, `tests/unit/`, `tests/integration/`; activar regla ESLint `@typescript-eslint/no-explicit-any` en error.
  Hecho cuando: `npm run build` termina sin errores, `npm run dev` sirve `http://localhost:3000` y `git status` muestra el repositorio en la rama `main` sin `node_modules/` ni `.next/`. Cubre: base (RNF-5) | Módulo: ui-shell

- [ ] T2 Configurar Prettier, Vitest (proyectos `unit` y `db`) y todos los scripts de verificación
  Pasos: instalar dependencias de desarrollo del Anexo B paso 3; `vitest.config.ts` con proyectos `unit` (jsdom, `tests/unit/`) y `db` (node, `tests/integration/`); scripts `typecheck`, `format`, `format:check`, `test`, `test:db`; test de humo en `tests/unit/smoke.test.ts`; test `tests/unit/no-secrets.test.ts` que falla si algún archivo de `src/` contiene `SUPABASE_SECRET_KEY` o `service_role` (P4).
  Hecho cuando: `npm run typecheck`, `npm run lint`, `npm run format:check` y `npm test` terminan en verde. Cubre: base (P4, P8) | Módulo: validación

- [ ] T3 Crear los proyectos Supabase `dev` y `prod`, configurar Auth y las variables de entorno
  Pasos: crear `calendario-dev` y `calendario-prod` (región UE, plan Free); en ambos, desactivar "Confirm email" y fijar contraseña mínima de 8; Anexo B pasos 4–5; crear `.env.example` con las 4 variables del plan; `.env.local` y `.env.test.local` con valores de `dev`; añadir scripts `db:push` y `db:types`.
  Hecho cuando: `npx supabase link` enlaza con `calendario-dev` sin error, `git check-ignore .env.local .env.test.local` devuelve ambos archivos y `.env.example` está versionado sin valores reales. Cubre: RF-1 (D6), RNF-4 | Módulo: supabase-clients

- [ ] T4 Crear la migración del esquema base (enum, tablas, índices, restricciones y triggers) con su test
  Pasos: test primero en `tests/integration/schema.test.ts` (crear usuario con la clave secreta → existe perfil con `display_name`, "Mi calendario" y membresía `owner`; evento con `ends_at < starts_at` falla; borrar usuario borra en cascada perfil, calendarios, eventos y membresías); migración `supabase/migrations/<timestamp>_base_schema.sql` según "Modelo de datos" del plan; `npm run db:push`; `npm run db:types`.
  Hecho cuando: `npm run test:db -- schema` en verde y `src/types/database.ts` generado contiene las tablas `profiles`, `calendars`, `calendar_members` y `events`. Cubre: RF-4, casos límite de datos | Módulo: database

- [ ] T5 Crear la migración de políticas RLS y funciones de permiso con la matriz de tests de permisos
  Pasos: test primero en `tests/integration/rls.test.ts` con 4 usuarios de prueba (propietario, editor, lector, ajeno; editor y lector insertados con la clave secreta) que cubra la tabla de políticas del plan: ajeno no ve calendario/miembros/eventos; lector ve pero no crea, modifica ni borra eventos; editor crea, modifica y borra eventos; solo el propietario modifica o borra el calendario; nadie inserta ni modifica `calendar_members`; cada usuario ve y edita solo su perfil; `anon` no ve nada; consulta a `pg_tables` confirma `rowsecurity = true` en todas las tablas de `public`; migración `<timestamp>_rls_policies.sql`.
  Hecho cuando: `npm run test:db -- rls` en verde con todos los casos de la matriz. Cubre: RF-15, RF-16, RF-17, RF-18, RF-19, RF-20 | Módulo: access-policies

- [ ] T6 Implementar los clientes de Supabase y el proxy de protección de rutas
  Pasos: test primero en `tests/unit/route-access.test.ts` para `getRouteAccess(pathname, hasSession)` (sin sesión: `/dashboard` y `/dashboard/x` → `/login`; con sesión: `/login` y `/signup` → `/dashboard`; `/`, `/offline`, `/sw.js`, `/manifest.webmanifest` y estáticos → `allow`); `src/lib/supabase/{server,client,proxy}.ts`; `src/proxy.ts` usando `getClaims()` y matcher que excluye estáticos.
  Hecho cuando: `npm test -- route-access` en verde y, con `npm run dev`, abrir `/dashboard` sin sesión redirige a `/login`. Cubre: RF-8, RF-9, RF-10 | Módulo: route-guard, supabase-clients

- [ ] T7 Implementar el registro con validación, traducción de errores y formulario accesible
  Pasos: tests primero en `tests/unit/auth-schemas.test.ts` (email normalizado, límites 7/8/72/73 de contraseña, nombre vacío y de 51 caracteres), `tests/unit/auth-error-messages.test.ts` (tabla de códigos del plan) y `tests/unit/signup-form.test.tsx` (errores junto al campo, botón deshabilitado mientras está pendiente, email conservado tras error); `src/lib/auth/schemas.ts`, `src/lib/auth/error-messages.ts`, Server Action `signUp`, página `/signup` y `src/components/auth/signup-form.tsx`; test `tests/integration/signup.test.ts` para email duplicado.
  Hecho cuando: `npm test -- auth signup` y `npm run test:db -- signup` en verde, y en `npm run dev` un registro nuevo lleva a `/dashboard`. Cubre: RF-1, RF-2, RF-3, RF-11, RF-12 | Módulo: auth, auth-validation, auth-errors

- [ ] T8 Implementar el inicio y el cierre de sesión
  Pasos: tests primero en `tests/unit/login-form.test.tsx` (mensaje "Email o contraseña incorrectos.", botón deshabilitado mientras está pendiente) y `tests/integration/login.test.ts` (credenciales correctas devuelven sesión, incorrectas devuelven `invalid_credentials`); Server Actions `signIn` y `signOut`, página `/login`, `src/components/auth/login-form.tsx`.
  Hecho cuando: `npm test -- login` y `npm run test:db -- login` en verde, y en `npm run dev` se verifica login correcto → `/dashboard`, recarga conserva la sesión, logout → `/login` y volver atrás no muestra el panel. Cubre: RF-5, RF-6, RF-7, RF-10, RF-11, RF-12 | Módulo: auth

- [ ] T9 Crear el layout responsive, la portada y el panel con la lista de calendarios y su rol
  Pasos: test primero en `tests/unit/calendar-list.test.tsx` (muestra nombre, color y "Propietario"/"Editor"/"Lector"; lista vacía muestra "Todavía no tienes calendarios."); `layout.tsx` con `viewport`, `lang="es"` y componentes base en `src/components/ui/`; portada `/`; `src/app/dashboard/page.tsx` y `src/components/dashboard/calendar-list.tsx` con cabecera que incluye nombre visible y botón "Cerrar sesión".
  Hecho cuando: `npm test -- calendar-list` en verde y en Chrome DevTools (modo dispositivo) `/`, `/login`, `/signup` y `/dashboard` no tienen scroll horizontal a 360 px, 768 px y 1920 px, con "Cerrar sesión" visible sin hacer scroll. Cubre: RF-13, RF-14, RF-24, RNF-7 | Módulo: dashboard, ui-shell

- [ ] T10 Configurar la PWA: manifest, iconos, metadatos de iOS, service worker y pantalla offline
  Pasos: test primero en `tests/unit/manifest.test.ts` (`name`, `short_name`, `display: "standalone"`, `start_url: "/dashboard"`, iconos 192, 512 y 512 maskable); `src/app/manifest.ts`; iconos en `public/icons/` y `apple-touch-icon`; metadatos `appleWebApp` en `layout.tsx`; `public/sw.js` (precache `/offline` y estáticos, red primero en navegaciones con respaldo `/offline`, sin cachear HTML ni Supabase, caché versionada); cabeceras de `/sw.js` en `next.config.ts`; `src/components/pwa/service-worker-register.tsx`; página `/offline` con "Reintentar"; ayuda de instalación solo en Safari iOS.
  Hecho cuando: `npm test -- manifest` en verde y, con `npm run build && npm start`, Chrome DevTools > Application muestra el manifest sin errores, el service worker activo y, en modo "Offline", la navegación a una página muestra "Sin conexión". Cubre: RF-21, RF-22, RF-23 | Módulo: pwa

- [ ] T11 Desplegar en Vercel con el proyecto Supabase `prod` y el cron de keep-alive
  Pasos: test primero en `tests/unit/keep-alive-route.test.ts` (sin cabecera o con secreto erróneo → 401; con `Bearer ${CRON_SECRET}` → 200); `src/app/api/cron/keep-alive/route.ts`; `vercel.json` con cron diario `0 6 * * *`; aplicar migraciones a `prod` (`npx supabase link` a prod + `npm run db:push`); repositorio privado en GitHub; proyecto en Vercel Hobby con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `CRON_SECRET` (sin `SUPABASE_SECRET_KEY`); Site URL de Supabase `prod` apuntando a la URL de Vercel.
  Hecho cuando: `npm test -- keep-alive` en verde, la URL de producción carga `/login` por HTTPS y el panel de Vercel muestra el cron con una ejecución manual terminada en 200. Cubre: RF-25, RNF-4, RNF-8 | Módulo: keep-alive

- [ ] T12 Validar la spec completa RF por RF en producción y comprobar el fuera de alcance
  Pasos: ejecutar el checklist completo de la constitución; demo del flujo de "Criterios de finalización" en la URL de producción; instalar la app en un móvil real (Android o iOS) y en un escritorio; medir la carga de `/login` con perfil "Fast 4G" (RNF-6); recorrer el flujo solo con teclado (RNF-7); revisar que nada de "Fuera de alcance" está en el código; marcar cada fila de la trazabilidad con su evidencia.
  Hecho cuando: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:db` y `npm run build` en verde, las 25 filas de la trazabilidad tienen evidencia y el usuario aprueba explícitamente el cierre de la spec 001. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

| RF | Tareas | Evidencia esperada |
|----|--------|--------------------|
| RF-1 | T7, T3 | Registro en dev y prod lleva al panel |
| RF-2 | T7 | `signup.test.ts`, `auth-error-messages.test.ts` |
| RF-3 | T7 | `auth-schemas.test.ts`, `signup-form.test.tsx` |
| RF-4 | T4 | `schema.test.ts` |
| RF-5 | T8 | `login.test.ts` + demo |
| RF-6 | T8 | `login-form.test.tsx`, `auth-error-messages.test.ts` |
| RF-7 | T8 | Demo de logout |
| RF-8 | T6 | `route-access.test.ts` + demo |
| RF-9 | T6 | `route-access.test.ts` |
| RF-10 | T6, T8 | Demo: recarga y reapertura conservan sesión |
| RF-11 | T7, T8 | `auth-error-messages.test.ts` |
| RF-12 | T7, T8 | `auth-error-messages.test.ts`, `signup-form.test.tsx` |
| RF-13 | T9 | `calendar-list.test.tsx` + demo |
| RF-14 | T9 | Revisión a 360 px y 1920 px |
| RF-15 | T5 | `rls.test.ts` |
| RF-16 | T5 | `rls.test.ts` |
| RF-17 | T5 | `rls.test.ts` |
| RF-18 | T5 | `rls.test.ts` |
| RF-19 | T5 | `rls.test.ts` |
| RF-20 | T5 | `rls.test.ts` |
| RF-21 | T10, T12 | DevTools Application + instalación en escritorio/Android |
| RF-22 | T10, T12 | Instalación en iOS (si se dispone de dispositivo) |
| RF-23 | T10 | Modo Offline en DevTools |
| RF-24 | T9, T12 | Revisión a 360/768/1920 px |
| RF-25 | T11 | Ejecución del cron en 200 |

Módulos del plan cubiertos: database (T4), access-policies (T5), supabase-clients (T3, T6), route-guard (T6), auth-validation (T7), auth-errors (T7), auth (T7, T8), dashboard (T9), ui-shell (T1, T9), pwa (T10), keep-alive (T11), validación (T2, T12).

## Dudas abiertas

- Ninguna que bloquee tareas. Si las dudas de producto de la spec se resuelven distinto a la recomendación, solo cambian textos en T7/T9, `manifest.ts` en T10 y el valor por defecto de `time_zone` en T4.
- RF-22 requiere un iPhone o iPad para verificarse; si no hay ninguno disponible, se documenta como no verificado en T12.
