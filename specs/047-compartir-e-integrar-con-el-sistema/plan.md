# Plan 047 — Compartir e integrar con el sistema

Spec: `specs/047-compartir-e-integrar-con-el-sistema/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

```
Compartir:  EventPanel ─ ShareEventButton ─ shareText(event) + eventIcs(event) (puro) ─ navigator.share | menú
Recibir:    Android ─ POST /share-target (sw.js) ─ IndexedDB cafam-share ─ 303 /dashboard/share?id= ─ ShareInbox
               ├ .ics      → /dashboard/import?shared=<id>     (ImportForm lee el archivo del dispositivo)
               ├ imágenes  → hoja: Venito (AssistantFab con adjuntos) | Añadir a un evento (buscador 039 + useImageUploads)
               └ texto     → /dashboard/events/new?text=<...>  (NlField de la 041)
Icono:      manifest.shortcuts; useAppBadge() en AppFrame (cuenta de hoy, setAppBadge/clearAppBadge)
```

El `POST` de `share_target` lo atiende el service worker y nunca llega al servidor (las rutas de Next no reciben el archivo): así lo compartido no sale del dispositivo hasta que el usuario decide.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `src/app/manifest.ts` | `share_target` y `shortcuts` (RF-5, RF-11) |
| `public/icons/shortcut-*.png`, `scripts/make-icons.mjs` | Iconos de 96 px |
| `public/sw.js` | `fetch` de `POST /share-target`, IndexedDB `cafam-share`, `303`; `push` actualiza el número; `CACHE_NAME` sube |
| `src/lib/share/text.ts`, `event-ics.ts` (puros) | Texto y `.ics` de un evento (RF-1) |
| `src/lib/share/support.ts` | Detección de `share`, `canShare`, `setAppBadge` |
| `src/lib/share/inbox.ts` | Lectura y borrado de `cafam-share` (RF-10) |
| `src/components/calendar/share-event-button.tsx` | Botón y menú (RF-1 a RF-4) |
| `src/app/dashboard/share/page.tsx`, `src/components/share/share-inbox.tsx` | Decidir qué hacer (RF-6 a RF-8) |
| `src/components/import/import-form.tsx` | Acepta un archivo del dispositivo (`?shared=`) |
| `src/components/shell/assistant-fab.tsx` | Abrir con adjuntos |
| `src/lib/hooks/use-app-badge.ts`, ajuste en `profiles.badge_today` | Número en el icono (RF-12) |
| `supabase/migrations/20261128100000_profile_badge.sql` | `profiles.badge_today boolean default true` |
| `src/lib/auth/next-path.ts` | `next` admite `/dashboard/share?id=<uuid>` (RF-9) |

## Decisiones

- D1: El archivo compartido vive en IndexedDB del dispositivo (RF-10), no se sube a un almacén temporal en el servidor: privacidad (P3) y sin coste.
- D2: El enlace compartido es el de siempre (RF-3), sin enlaces públicos: un enlace público sería un permiso nuevo (fuera de alcance).
- D3: El número del icono cuenta solo con la app abierta (y al llegar un aviso): la Badging API no tiene ejecución periódica en segundo plano sin Periodic Background Sync, que solo existe en Chromium instalado y con permisos; no se usa para no depender de él.
- D4: `next-path.ts` amplía su lista blanca solo con la forma exacta `/dashboard/share?id=<uuid>` (sin redirecciones abiertas).

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Tras desplegar: en Android, volver a instalar o esperar a que Chrome relea el manifest para que aparezca CaFam en "Compartir".

## Riesgos

- Cambiar `sw.js` afecta al bucle de envío sin conexión (035): los tests de `offline-sw-sync` deben seguir en verde.
