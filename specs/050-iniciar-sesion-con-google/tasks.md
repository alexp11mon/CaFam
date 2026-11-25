# Tasks 050 — Iniciar sesión con Google

Spec: `specs/050-iniciar-sesion-con-google/spec.md`. Plan: `specs/050-iniciar-sesion-con-google/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: en curso. Bloqueo externo previsto: crear el cliente OAuth y activar el proveedor en Supabase (pasos de producción 1–3) lo hace el usuario; sin ello, T5 queda pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1.

## Tareas

- [x] T1 Nombre del perfil desde Google
  Hecho cuando: `npm run test:db -- signup` en verde con un usuario creado con `full_name` y otro con `name`.

  Cubre: RF-4 | Evidencia: 2026-11-25, migración `20261201100000_oauth_profile_name.sql` aplicada en dev; `npm run test:db -- signup` 3/3 (`full_name` recortado a 50, `name`, y la parte local del email si Google no manda nombre; zona `Europe/Madrid` hasta la primera entrada); P8 en verde.
- [x] T2 Botón, acción y callback
  Hecho cuando: `npm test -- google-button oauth-actions auth-callback-route route-access` en verde: URL de Google con PKCE, `next` seguro, cancelación y error, botón oculto sin la variable.

  Cubre: RF-1, RF-2, RF-9, RNF-1, RNF-2 | Evidencia: 2026-11-25, `npx vitest run --project unit google-button oauth-actions auth-callback-route route-access` en verde (URL de Google con `skipBrowserRedirect` y PKCE de `@supabase/ssr`, solo `openid email profile`, `next` seguro, cancelación y error, botón oculto sin `NEXT_PUBLIC_GOOGLE_LOGIN=1`); P8 en verde. Logotipo oficial en `components/brand/google-logo.tsx` (colores como atributos `fill`, que la guardia de diseño no toca).
- [x] T3 Formas de entrar
  Hecho cuando: `npm test -- sign-in-methods identity-actions delete-account-dialog` en verde: enlazar, desvincular solo si queda otra, crear contraseña, borrar sin contraseña.

  Cubre: RF-5 a RF-8 | Evidencia: 2026-11-25, `npx vitest run --project unit sign-in-methods identity-actions delete-account-dialog account-delete-action` en verde: "Conectar Google" con `linkIdentity` de vuelta a Ajustes, "Desconectar Google" solo con contraseña, "Crear contraseña" sin la actual (marca `has_password` en los metadatos, porque Supabase no dice si la hay), borrar sin contraseña con el propio email; P8 en verde. Una cuenta solo de Google no cambia el email ni la contraseña hasta crear una (se explica en Ajustes). Si Supabase no deja desvincular la única identidad aunque haya contraseña, se verá en la prueba real (T5).
- [x] T4 Zona en la primera entrada y privacidad
  Hecho cuando: `npm test -- time-zone-check` en verde y `/privacy` con la sección; capturas de login y Ajustes a 390 y 1440 px en claro y oscuro.

  Cubre: RF-4, RF-10, RF-11, RNF-3 | Evidencia: 2026-11-25, `npx vitest run --project unit time-zone-check auth-callback-route` en verde (`/auth/callback` añade `?tzcheck=<zona>` a una cuenta recién creada sin zona; el aviso "Hemos puesto tu zona en … ¿Es correcta?" con "Cambiar" sale solo si difiere de la del navegador); `/privacy` con la sección "Entrar con Google" (nombre y email, la foto no se guarda, no da acceso a Google Calendar); P8 en verde. Capturas `capturas/login-google-*` y `ajustes-formas-de-entrar-*` a 390 y 1440 px, claro y oscuro, con una build con `NEXT_PUBLIC_GOOGLE_LOGIN=1`. `npm test` 3906/3906 (dos pruebas de tiempo, `write-ics` y `agenda-view`, fallan a veces si corren junto a la reconstrucción de graphify; solas pasan).
- [ ] T5 Prueba real
  Hecho cuando: en dev (puerto 3000) con el proveedor activo: cuenta nueva con Google, cuenta existente enlazada por email, desvincular y volver a entrar con contraseña.

  Cubre: RF-2, RF-3, RF-5 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md, README (login social; Apple imposible a coste cero) y constitución (stack: Supabase Auth con Google) actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2, RF-9 | T2 |
| RF-3 | T5 |
| RF-4 | T1, T4 |
| RF-5 a RF-8 | T3 |
| RF-10, RF-11 | T4 |
