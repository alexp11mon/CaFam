# Plan 050 — Iniciar sesión con Google

Spec: `specs/050-iniciar-sesion-con-google/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

```
LoginForm ─ GoogleButton ─ signInWithGoogle (Server Action)
   └ supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origen>/auth/callback?next=…, scopes: "openid email profile" } })
   └ redirect(url)                                  (el verificador PKCE queda en la cookie de @supabase/ssr)
Google ─▶ https://<ref>.supabase.co/auth/v1/callback ─▶ <origen>/auth/callback?code=…
/auth/callback (Route Handler) ─ exchangeCodeForSession(code) ─ safeNext(next) ─ redirect
handle_new_user (trigger existente) ─ display_name desde raw_user_meta_data.full_name/name
```

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261201100000_oauth_profile_name.sql` | `handle_new_user` lee `display_name`, o `full_name`/`name` de Google, recortado a 50 |
| `src/app/(auth)/oauth-actions.ts` | `signInWithGoogle(next)` (RF-2) |
| `src/app/auth/callback/route.ts` | Intercambio del código, errores, `next` seguro (RF-2, RF-9) |
| `src/lib/auth/route-access.ts` | `/auth/callback` pública (RNF-2) |
| `src/components/auth/google-button.tsx`, `login-form.tsx`, `signup-form.tsx` | RF-1 |
| `src/components/account/sign-in-methods.tsx`, `src/app/dashboard/settings/identity-actions.ts` | `linkIdentity`, `unlinkIdentity`, crear contraseña (RF-5, RF-6) |
| `src/components/account/delete-account-dialog.tsx`, `account-actions.ts` | Borrado sin contraseña (RF-8) |
| `src/components/account/time-zone-check.tsx` | Aviso de zona en la primera entrada (RF-4) |
| `src/app/privacy/page.tsx` | RF-11 |
| `.env.example` | `NEXT_PUBLIC_GOOGLE_LOGIN` |

## Decisiones

- D1: Proveedor de Supabase Auth y no el OAuth propio de la 007: Supabase gestiona la sesión, el enlace de identidades y la seguridad; el OAuth de la 007 es para la API de Calendar y guarda tokens en Vault, otra cosa.
- D2: Mismo proyecto de Google Cloud (`CaFam`) con un **cliente OAuth nuevo** "CaFam Login" cuyo URI de retorno es el de Supabase: los permisos `openid email profile` no exigen verificación de Google.
- D3: El logotipo de Google es la única excepción a los tokens (normas de marca de Google); va como SVG en `components/brand/google-logo.tsx` con un comentario para la guardia de diseño (se añade a su lista de excepciones).
- D4: Enlace automático de identidades (comportamiento por defecto de Supabase con emails verificados) y no manual: es lo que espera un usuario.
- D5: Apple fuera (P2): exige cuenta de pago de Apple Developer.

## Pasos de producción (los ejecuta el usuario)

1. Google Cloud Console, proyecto `CaFam` → Credenciales → Crear ID de cliente OAuth (aplicación web) "CaFam Login" con el URI de redirección autorizado `https://yznbdoskvtxeasujtirk.supabase.co/auth/v1/callback` (y para dev `https://uthubyzhonrtrmbcqcjh.supabase.co/auth/v1/callback`).
2. Supabase (prod y dev) → Authentication → Sign In / Providers → Google: activar con el ID y el secreto del cliente.
3. Supabase → Authentication → URL Configuration → Redirect URLs: añadir `https://calendario-familia-five.vercel.app/auth/callback` (prod) y `http://localhost:3000/auth/callback` (dev).
4. Vercel: `NEXT_PUBLIC_GOOGLE_LOGIN=1` (Production). Redeploy.
5. Migración:
```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- Las previews de Vercel no están en las Redirect URLs: el botón no funciona ahí (se documenta como la trampa de las previews de la 007).
