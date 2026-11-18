# Plan 053 — Internacionalización: inglés además del español

Spec: `specs/053-i18n-ingles/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Diccionarios** en `src/i18n/<área>.ts`, cada uno exporta `{ es: {...}, en: {...} }` con las mismas claves (tipo `Messages<typeof es>` que obliga a que `en` tenga todas). Las cadenas con variables son funciones (`(n: number) => …`), con plurales por `Intl.PluralRules`.
- **Servidor**: `getLocale()` (cookie → `profiles.locale` → `Accept-Language`) en `lib/i18n/locale.ts`; `t(área)` devuelve el diccionario del idioma. Las Server Actions y los módulos de errores reciben el idioma.
- **Cliente**: `LocaleProvider` en el layout raíz con el idioma; `useT(área)` importa el diccionario de esa área. Para no enviar los dos idiomas (RNF-1), cada área se divide en `<área>.es.ts` y `<área>.en.ts`, y el componente de servidor pasa el objeto del idioma activo como prop serializable al `LocaleProvider` de su sección (el español sigue en el paquete por ser el idioma por defecto; el inglés solo viaja si se elige).
- **Fechas**: los formateadores de `lib/calendar/format.ts` y compañía reciben `locale` (por defecto `es-ES`).
- **Venito**: el prompt añade "Responde en inglés" con `locale = en`.
- **Correos**: `email_outbox` guarda el idioma del destinatario y la plantilla elige el texto.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261204100000_profile_locale.sql` | `profiles.locale text default 'es' check in ('es','en')`; `handle_new_user` nombra "My calendar" si el registro es en inglés; correos por idioma |
| `src/lib/i18n/locale.ts`, `plural.ts`, `format.ts` | Detección, plurales, formateadores |
| `src/i18n/*.es.ts`, `*.en.ts` | Diccionarios por área: shell, calendar, events, recurrence, comments, images, sharing, import, sync, account, auth, settings, notes, assistant, offline, search, push, trash, errors |
| `src/components/i18n/locale-provider.tsx` | Contexto y `useT` |
| `src/app/layout.tsx`, `proxy.ts` | `lang`, cookie |
| `src/components/settings/locale-picker.tsx`, `settings/actions.ts` (`setLocale`) | RF-1 |
| Todos los componentes y módulos de mensajes | Sustituir literales por claves, área a área |
| `tests/unit/i18n-complete.test.ts`, `i18n-no-literals.test.ts` | RF-8 |
| `scripts/perf/measure.mjs` | Medida de RNF-1 antes y después |

## Decisiones

- D1: Diccionarios propios tipados (RNF-2): TypeScript garantiza las claves; una librería añadiría peso y una dependencia (P6).
- D2: Idioma en el perfil y en una cookie (como el tema): el servidor pinta en el idioma correcto sin parpadeo.
- D3: `en-GB` con 24 h y lunes primero: coherente con los cálculos de semana de la app (lunes primero en todo el código) y sin rediseñar las vistas.
- D4: El manifest queda en español: el `name` "CaFam" no cambia y `description` es secundaria; un manifest por idioma complicaría el service worker.
- D5: Por áreas y con el test de literales (RF-8) como red: permite integrar área a área sin dejar la app a medias, porque el español sigue completo en todo momento.
- D6: Condición del usuario (RNF-1, RNF-3): si la medida empeora, la spec no se integra.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- Tamaño del cambio: tocará casi todos los componentes; los conflictos con otras ramas se evitan haciéndola la última.
