# Plan 049 — Cuenta: verificar el email, traspasar un calendario y exportar los datos

Spec: `specs/049-cuenta-verificacion-traspaso-exportar/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Verificación**: es una opción de Supabase Auth ("Confirm email"), no código: `signUp` ya llama a `supabase.auth.signUp` con `emailRedirectTo`; si no hay sesión en la respuesta, redirige a `/signup/check-email?email=<enmascarado>` (el email real se guarda en una cookie corta `cafam_pending` para "Reenviar", nunca en la URL). `resendConfirmation` llama a `auth.resend({ type: "signup" })` con un límite propio en la base de datos (`auth_email_requests`, como `request_recovery`). `/auth/confirm` acepta `type=signup` y `type=email` → `/dashboard/calendar?confirmed=1`. `signIn` traduce `email_not_confirmed`.
- **Traspaso**: función `transfer_calendar(p_calendar_id, p_new_owner)` `SECURITY DEFINER` que activa `app.account_transfer` (la marca de la 006 que deja cambiar `owner_id`), cambia roles, revoca invitaciones, códigos, feed y suscripción, y escribe avisos y correo (`email_outbox`, 006).
- **Exportación**: acción `loadAccountExport()` que devuelve con RLS el JSON del perfil, calendarios, categorías, miembros por nombre (`calendar_members_with_names`), eventos (paginados), comentarios propios, notas y la lista de imágenes subidas; el navegador escribe los `.ics` con `write-ics` (043), descarga las imágenes una a una con `downloadImage` y arma el `.zip` con `zip-store.ts`, y lo descarga con un `Blob`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261130100000_account_more.sql` | `request_signup_resend` (límite), `transfer_calendar`, plantilla de correo de traspaso en `email_outbox`, `pg_cron` `account-purge-unconfirmed` (borra `auth.users` sin confirmar de más de 7 días, solo si no tienen calendarios con otros miembros) |
| `src/app/(auth)/actions.ts` | `signUp` sin sesión → comprobar email; `signIn` con `email_not_confirmed` |
| `src/app/(auth)/signup/check-email/page.tsx`, `src/components/auth/check-email.tsx` | RF-1, RF-3 |
| `src/app/auth/confirm/route.ts` | `type=signup|email` (RF-2) |
| `src/lib/auth/error-messages.ts`, `next-path.ts` | Textos y `next` a través de la confirmación (RF-5) |
| `src/app/dashboard/calendars/transfer-actions.ts`, `src/components/sharing/transfer-dialog.tsx` | RF-7 a RF-11 |
| `src/lib/export/zip-store.ts` (puro) | ZIP *store* con CRC-32 y nombres UTF-8 (bit 11) |
| `src/lib/export/account-files.ts` (puro) | Nombres seguros de archivo y `LEEME.txt` |
| `src/app/dashboard/settings/export-actions.ts`, `src/components/account/export-data.tsx` | RF-12 a RF-15 |

## Decisiones

- D1: `.zip` en el navegador (RNF-2): una función de Vercel Hobby tiene 60 s y memoria limitada; el navegador ya sabe descargar las imágenes con RLS.
- D2: *Store* sin compresión: los JPEG ya están comprimidos y el JSON pesa poco; escribir *deflate* sin librería no compensa (`CompressionStream("deflate-raw")` existe, pero no en todos los Safari).
- D3: Traspaso sin aceptación del receptor (fuera de alcance): el receptor ya es miembro y puede salir; con aviso basta.
- D4: Purga de cuentas sin confirmar a los 7 días (RF-6), para que la lista de usuarios no se llene de registros abandonados.

## Pasos de producción (los ejecuta el usuario)

1. Comprobar en el SQL Editor de prod que no hay usuarios sin confirmar: `select count(*) from auth.users where email_confirmed_at is null;` (debe ser 0).
2. Supabase prod → Authentication → Emails → plantilla **Confirm signup**: enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`, asunto "Confirma tu email en CaFam" y texto en español.
3. Aplicar la migración:
```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```
4. Desplegar la app.
5. Authentication → Sign In / Providers → Email → activar **Confirm email**. (En este orden: la app nueva ya sabe manejar el registro sin sesión.)
6. Hacer lo mismo en dev (plantilla y "Confirm email") para que `test:db` y las pruebas coincidan; los tests crean usuarios con la clave secreta ya confirmados.

## Riesgos

- Brevo tiene 300 correos al día: los reenvíos están limitados (RF-1).
