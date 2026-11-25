# Spec 049 — Cuenta: verificar el email, traspasar un calendario y exportar los datos

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Cerrada el 2026-11-25.

## Contexto

La 006 dejó desactivada la confirmación de email (el registro devuelve sesión al momento) y fuera de alcance el traspaso voluntario de calendarios y la exportación de los datos de la cuenta. Brevo ya envía los correos de Auth por SMTP en dev y prod.

## Objetivo

Tres mejoras de cuenta: verificar el email al registrarse sin afectar a los usuarios existentes, traspasar un calendario propio a otro miembro y descargar todos los datos de la cuenta en un `.zip`.

## Requisitos funcionales

### Verificación del email

- RF-1: Al registrarse, la cuenta queda pendiente hasta pulsar el enlace del correo "Confirma tu email en CaFam". Tras el registro se muestra "Te hemos enviado un enlace a a***@gmail.com. Ábrelo para entrar." con "Reenviar" (como mucho una vez por minuto y 3 cada 15 minutos) y "Cambiar de email" (vuelve al registro).
- RF-2: El enlace pasa por `/auth/confirm` con `type=signup` (o `email`) y entra en `/dashboard/calendar` con la sesión iniciada y el aviso "Email confirmado".
- RF-3: Iniciar sesión con una cuenta sin confirmar dice "Confirma tu email antes de entrar" con "Reenviar el enlace".
- RF-4: Los usuarios existentes no se ven afectados: todos tienen `email_confirmed_at` (la confirmación estaba desactivada, así que Supabase los confirmó al registrarse). Se comprueba con una consulta antes de activar.
- RF-5: Una invitación (`/invite/<token>`, 003) se conserva a través del registro y la confirmación (`next`).
- RF-6: Las cuentas sin confirmar se borran a los 7 días (`pg_cron`), sin calendarios que conservar porque no han podido entrar.

### Traspaso de un calendario

- RF-7: En las opciones del calendario (Propietario), "Traspasar a otro miembro" elige entre sus miembros (Editores y Lectores); confirma con "Ana pasará a ser la propietaria de «Familia». Tú serás Editor."
- RF-8: El traspaso es inmediato: el nuevo propietario pasa a `owner` y el antiguo a `editor`. Avisos en la app (`account_notices`) y por correo al nuevo propietario ("Ahora eres el propietario de «Familia»").
- RF-9: No se puede traspasar un calendario traído de Google o iCloud (la cuenta conectada es del propietario): se explica que primero hay que "Dejar de traer" y conservarlo.
- RF-10: Las invitaciones y el ID con PIN activos se revocan al traspasar (el nuevo propietario crea los suyos). El enlace de suscripción `.ics` (043) y la suscripción a un enlace (044) también.
- RF-11: Los grupos y preferencias de cada persona no cambian.

### Exportar los datos de la cuenta

- RF-12: En Ajustes, "Descargar mis datos" prepara en el navegador un archivo `cafam-<fecha>.zip` con progreso y "Cancelar".
- RF-13: Contiene: `perfil.json` (nombre, email, zona, ajustes), `calendarios.json` (los calendarios de los que es miembro con su rol, categorías y miembros por nombre), `calendarios/<nombre>.ics` (los eventos de cada uno, con el escritor de la 043), `comentarios.json` (los suyos, con el evento), `notas.json` (sus notas personales y las compartidas que creó), `imagenes/<evento>/<n>.jpg` (las imágenes que subió) y `LEEME.txt` explicando cada archivo.
- RF-14: Nunca incluye datos de otras personas que el usuario no podría ver en la app, emails ajenos, tokens ni contraseñas de cuentas conectadas.
- RF-15: Con más de 300 imágenes o 500 MB, se pregunta si incluirlas.

## Requisitos no funcionales

- RNF-1: Sin dependencias: `.zip` sin compresión (método *store*) escrito a mano con CRC-32, válido para Windows, macOS, iOS y Android.
- RNF-2: Coste cero: se genera en el navegador (las imágenes se descargan por `downloadImage` con RLS, 012), sin trabajo en Vercel.
- RNF-3: Identidad Nexo; capturas del registro pendiente, del traspaso y de la exportación.

## Fuera de alcance

- Importar el `.zip` de vuelta, traspasar varios calendarios a la vez, traspaso con aceptación del receptor.

## Riesgos

- Activar "Confirm email" en Supabase sin la plantilla correcta dejaría a nuevos usuarios sin poder entrar: los pasos de producción lo hacen en orden y se prueba en dev.
- Traspaso por error: se pide confirmar escribiendo el nombre del calendario.

## Criterios de finalización

- Tests de la acción de registro (sin sesión), de `/auth/confirm`, del traspaso (integración con roles y revocaciones) y del `.zip` (estructura y CRC, abierto con `tar -tf` o PowerShell `Expand-Archive` en la prueba).
- P8 en verde con `test:db`; AGENTS.md (autenticación, sin "Confirm email desactivado"), README y constitución actualizados.

## Dudas abiertas

Ninguna.
