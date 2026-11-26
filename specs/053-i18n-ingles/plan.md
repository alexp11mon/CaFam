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

### Ajustes durante la implementación (2026-11-26)

Cambian el "cómo" de los diccionarios para cumplir RNF-1 sin tocar los requisitos:

- D7: **El texto español es la clave** (estilo *gettext*): solo existe el catálogo inglés (`src/i18n/en/<área>.ts`, `Record<string, string>`). El español no envía diccionario ni claves al navegador; `t("Guardar")` devuelve el propio texto en español. Las variables van como `{nombre}` (`t("Hola, {name}", { name })`) y los plurales eligen la forma española con `plural()`, que es a su vez la clave de la inglesa. El test de completitud (RF-8) comprueba que cada texto español de la interfaz tiene su traducción y que no sobran.
- D8: **Se traduce en el cliente**: `useT()` en los componentes de cliente y `<T>` (hoja de cliente) en los de servidor, así ninguna parte estática del PPR pasa a leer cookies. Las Server Actions siguen devolviendo español y el componente lo traduce al mostrarlo.
- D9: **El idioma llega al cliente** por `LocaleProvider`: en el marco dinámico del panel (que ya lee la sesión) con el idioma del perfil y el catálogo inglés como prop, de modo que el servidor pinta ya en inglés; en las páginas sin sesión, el proveedor raíz lee la cookie o el navegador y carga el catálogo con `import()` (en inglés, el primer pintado de esas páginas puede salir en español; en español no cambia nada). `<html lang>` lo pone un script de arranque como el del tema.
- D10: Las fechas usan `intlLocale(locale)` (`es-ES` o `en-GB`, 24 h) con `useLocale()` en el cliente.
- D11 (añadida en la implementación): los textos que el servidor compone con valores dentro (estados y propuestas de Venito, resultado de "Actualizar ahora", resumen de una serie) se traducen donde se componen con `translator(locale)` (`src/i18n/translator.ts`, solo servidor), con el idioma leído por `getProfileLocale(supabase, userId)`. Las funciones puras que construyen textos reciben `t: T = spanishT` y `locale: Locale = DEFAULT_LOCALE` como últimos parámetros, así sus llamadas antiguas siguen en español. Los componentes que reciben títulos (`PageShell`, `Section`, `ConfirmDialog` con `vars`, `EmptyState`, `AuthCard`…) traducen sus propias props, de modo que un Server Component les pasa el texto español tal cual. Las *instrucciones* al modelo siguen en español y piden responder en el idioma del perfil.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- Tamaño del cambio: tocará casi todos los componentes; los conflictos con otras ramas se evitan haciéndola la última.
