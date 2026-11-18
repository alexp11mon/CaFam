# Spec 050 — Iniciar sesión con Google

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Solo hay registro e inicio de sesión con email y contraseña (001). El "login social" está en la hoja de ruta. Supabase Auth trae el proveedor Google gratis en el plan Free, y el proyecto ya tiene un proyecto de Google Cloud (`CaFam`) con la pantalla de consentimiento publicada (009).

**Apple queda fuera**: "Sign in with Apple" exige una cuenta del Apple Developer Program (99 USD al año), lo que choca con P2 (coste cero). Se documenta como imposible a coste cero.

## Objetivo

"Continuar con Google" en el inicio de sesión y el registro, enlazado con las cuentas existentes por email verificado, sin romper el email y contraseña.

## Requisitos funcionales

- RF-1: `/login` y `/signup` muestran "Continuar con Google" (botón secundario con el logotipo de Google según sus normas de marca) separado por "o" del formulario.
- RF-2: Pulsarlo lleva al consentimiento de Google (solo `openid email profile`) y vuelve a `/auth/callback`, que crea la sesión y entra en `/dashboard/calendar` (o en `next` si es `/invite/<token>`, 003).
- RF-3: Si ya existe una cuenta CaFam con el mismo email (verificado en Google), se entra en **esa** cuenta (enlace automático de identidades de Supabase): mismos calendarios y datos.
- RF-4: Si no existe, se crea la cuenta con el nombre de Google (`display_name`, recortado a 50) y "Mi calendario"; la zona horaria se toma del navegador en la primera entrada (aviso "Hemos puesto tu zona en Europe/Madrid. ¿Es correcta?" con "Cambiar" a Ajustes si difiere de la del navegador).
- RF-5: En Ajustes, sección "Formas de entrar": muestra "Email y contraseña" y "Google (a***@gmail.com)"; "Conectar Google" enlaza (`linkIdentity`) y "Desconectar Google" desvincula (`unlinkIdentity`) si queda otra forma de entrar.
- RF-6: Una cuenta creada solo con Google puede **añadir una contraseña** desde Ajustes ("Crear contraseña", sin pedir la actual), y entonces puede desconectar Google.
- RF-7: Cambiar de email (006) en una cuenta con Google enlazado explica que Google seguirá entrando con su propio email.
- RF-8: Borrar la cuenta (006) pide la contraseña; sin contraseña (solo Google), pide confirmar con Google de nuevo (reautenticación) o escribir el email.
- RF-9: Cancelar en Google vuelve a `/login` con "Has cancelado el inicio de sesión con Google"; un error, con "No se ha podido entrar con Google".
- RF-10: La conexión de **Google Calendar** (007) sigue siendo independiente: entrar con Google no da acceso al calendario de Google.
- RF-11: `/privacy` explica qué se recibe de Google al entrar (nombre, email, foto no se guarda).

## Requisitos no funcionales

- RNF-1: Sin dependencias (`@supabase/ssr` con PKCE).
- RNF-2: El proxy y `getRouteAccess` permiten `/auth/callback` sin sesión.
- RNF-3: Identidad Nexo; el botón de Google respeta sus normas (logotipo oficial en SVG, colores propios de Google permitidos solo en el logotipo, D3).

## Fuera de alcance

- Apple (P2), Microsoft (Enmienda 1), GitHub y otros proveedores.

## Riesgos

- El enlace automático depende de que el email esté verificado en los dos lados: con la 049 activa, las cuentas nuevas lo están; las anteriores se confirmaron solas.
- Si el usuario no configura el proveedor en Supabase, el botón falla: se oculta si la variable `NEXT_PUBLIC_GOOGLE_LOGIN` no es `1`.

## Criterios de finalización

- Tests del callback, de los botones, de "Formas de entrar" y de `getRouteAccess`; prueba real en dev en el puerto 3000 con una cuenta de Google.
- P8 en verde; AGENTS.md (autenticación, rutas, variables), README, constitución (Supabase Auth con Google) y `/privacy` actualizados.

## Dudas abiertas

Ninguna.
