# Paso a producción de la spec 006 — Gestión de cuenta

> Lo ejecuta el usuario (AGENTS.md §3, "Acciones externas"). Nada de esto se ha aplicado todavía en producción. Proyecto de producción: `calendario-prod` (ref `yznbdoskvtxeasujtirk`).

El orden importa: el código nuevo usa columnas, tablas y funciones que no existen hasta aplicar las migraciones, y el envío programado de correos falla hasta que existen las claves de Brevo en Vault.

## 1. Migraciones (antes de desplegar el código)

Desde la raíz del repositorio, en la rama `006-gestion-de-cuenta`:

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh   # volver a dev inmediatamente
```

`db push` aplica, en este orden:

1. `20261024100000_account_orphan_schema.sql`: propietario anulable, `orphaned_at`, tablas de avisos, decisiones, cola de correo y límite de recuperación.
2. `20261024110000_account_recovery_limit.sql`: `request_recovery`.
3. `20261024120000_delete_own_account.sql`: `delete_own_account`.
4. `20261024130000_decide_orphan_calendar.sql`: `decide_orphan_calendar`.
5. `20261024140000_copy_calendar_for_owner.sql`: `copy_calendar_for_owner`.
6. `20261024150000_apply_orphan_decisions.sql`: `apply_orphan_decisions`.
7. `20261024160000_account_mail_jobs.sql`: activa `pg_cron` y `pg_net`, `send_pending_emails` y los tres trabajos programados.
8. `20261024170000_account_notices_read.sql`: cerrar avisos (`UPDATE (read_at)`).
9. `20261024180000_skip_test_addresses.sql`: la cola no envía a direcciones `.test`.

Comprobación: en el panel de prod, **Database → Cron Jobs** debe mostrar `account-apply-orphans`, `account-send-emails` y `account-purge-recovery`.

## 2. Claves de Brevo en Vault (prod)

En el **SQL Editor del proyecto de producción** (no en la terminal), con tus valores:

```sql
select vault.create_secret('TU_CLAVE_API_XKEYSIB', 'brevo_api_key', 'Clave API de Brevo para avisos de cuenta');
select vault.create_secret('alexponmon@gmail.com', 'brevo_sender_email', 'Remitente verificado en Brevo');
select name from vault.secrets;   -- deben salir los dos nombres
```

Puedes reutilizar la misma clave API de dev o crear otra en Brevo (**SMTP y API → Claves API**). La restricción de IP de Brevo ya está desactivada para toda la cuenta.

## 3. Auth en prod (panel de Supabase, proyecto de producción)

1. **Authentication → URL Configuration → Site URL**: `https://calendario-familia-five.vercel.app`.
2. **Authentication → Emails → SMTP**: activado, con
   - Sender email: `alexponmon@gmail.com`; Sender name: `CaFam` (o `CalenderFam`).
   - Host `smtp-relay.brevo.com`, puerto `587`.
   - Username: el login SMTP de Brevo (`…@smtp-brevo.com`); Password: una clave **SMTP** (`xsmtpsib-…`), no la clave API.
3. **Authentication → Emails → Reset password**: asunto `Restablecer tu contraseña de CalenderFam`, con este enlace en el cuerpo:
   ```
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Cambiar mi contraseña</a>
   ```
4. **Authentication → Emails → Change email address**: asunto `Confirma tu nuevo email de CalenderFam`, con este enlace:
   ```
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirmar mi nuevo email</a>
   ```
5. **Authentication → Emails → Security → Email address changed**: activado (aviso al email anterior, RF-9). Guardar.
6. **Authentication → Rate Limits**: subir el límite de correos por hora.

## 4. Desplegar el código

Con las migraciones y la configuración ya aplicadas:

```
git switch main
git merge --ff-only 006-gestion-de-cuenta
git push origin main
```

Vercel despliega `main` a producción. La primera petición puede tardar unos segundos (arranque en frío).

## 5. Validar en producción

1. `/forgot-password` con tu email: llega el correo y el enlace abre `/reset-password`; guardar una contraseña nueva te deja en el calendario.
2. `/dashboard/settings`: guardar el perfil y cambiar la contraseña.
3. Cambio de email (pendiente también en dev, T9): pedirlo hacia otra dirección tuya, confirmar el enlace y comprobar que la anterior recibe el aviso.
4. Borrar cuenta: solo con cuentas de prueba creadas para ello, nunca con la tuya. Si se prueba con un calendario compartido, comprobar el aviso, el grupo "Sin propietario" y las decisiones, y borrar después las cuentas de prueba.

Si todo funciona, pide el cierre de la spec 006.
