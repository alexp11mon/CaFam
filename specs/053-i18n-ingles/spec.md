# Spec 053 — Internacionalización: inglés además del español

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18), con la condición "solo si no empeora nada". Pendiente de implementar.

## Contexto

Todo el texto visible está en español, escrito directamente en los componentes y en los módulos de mensajes (`error-messages.ts` de cada área, `provider-labels.ts`, `stream.ts`…). Las fechas usan `Intl` con `es-ES`. i18n está en la hoja de ruta. El español sigue siendo el idioma por defecto, el de la documentación y el de las specs.

## Objetivo

Que cada usuario pueda elegir **inglés** en Ajustes y ver la app entera en inglés, con diccionarios propios sin librería, sin empeorar el rendimiento ni la experiencia en español.

## Requisitos funcionales

- RF-1: En Ajustes, "Idioma": "Español" (por defecto) o "English". Se guarda en `profiles.locale` y en la cookie `cafam-locale` (como el tema, 011), para pintar ya en el idioma correcto desde el servidor.
- RF-2: Sin sesión (portada, login, registro, recuperación, `/privacy`, `/invite`), el idioma sale de la cookie o, si no hay, de `Accept-Language` (inglés solo si el primero preferido es inglés); con duda, español.
- RF-3: Todos los textos visibles, `aria-label`, avisos, errores de servidor (zod y traducciones de Supabase), estados vacíos, atajos y ayuda, correos de Brevo de la app (006) y textos de la PWA (manifest por idioma no: se queda en español, D4) están en los dos idiomas.
- RF-4: Fechas, horas, números y listas con `Intl` en el idioma elegido (`es-ES` o `en-GB`; reloj de 24 h en los dos y lunes como primer día, D3). Resúmenes de repetición (013) y tiempos relativos (014) también.
- RF-5: Venito responde en el idioma del usuario (el prompt lo indica) y sus sugerencias están traducidas; el análisis en lenguaje natural (041) sigue entendiendo solo español (se dice en la ayuda del campo en inglés).
- RF-6: `<html lang>` cambia con el idioma.
- RF-7: Los datos del usuario (nombres de calendarios, eventos, notas) no se traducen. "Mi calendario" creado al registrarse se nombra en el idioma del registro.
- RF-8: Un test garantiza que **cada clave existe en los dos diccionarios** y que no quedan textos en español sueltos en los componentes (lista de excepciones explícita para datos y nombres propios).

## Requisitos no funcionales

- RNF-1: **No empeorar nada** (condición del usuario): el JS inicial no crece más de 5 KB comprimidos en español (solo se envía el diccionario del idioma activo, dividido por área y cargado con la ruta); el tiempo de cambio de mes de la 024 no empeora; P8 y todos los tests existentes siguen en verde con el español por defecto.
- RNF-2: Sin dependencias (sin `next-intl` ni `i18next`).
- RNF-3: Si la medida de RNF-1 falla tras optimizar, la spec se queda en la rama sin integrar y se documenta por qué.

## Fuera de alcance

- Otros idiomas (la estructura los permite), traducir la documentación y las specs, el análisis de lenguaje natural en inglés, URLs por idioma.

## Riesgos

- Volumen: más de 2.000 cadenas en cientos de archivos; se hace por áreas, con el test de RF-8 como red.
- Los tests existentes buscan textos en español: siguen funcionando porque el idioma por defecto de los tests es español.

## Criterios de finalización

- Test de diccionarios completos y de textos sueltos; capturas en inglés de las pantallas principales a 390 y 1440 px; medida de RNF-1 en `tasks.md`.
- P8 en verde con `test:db`; AGENTS.md (patrón de textos), README y constitución (idioma: español por defecto, inglés como opción visible) actualizados con una enmienda.

## Dudas abiertas

Ninguna.
