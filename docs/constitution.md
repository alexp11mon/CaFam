# Constitution - CaFam

## Contexto y objetivo

CaFam es una aplicación web progresiva (PWA) de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso estrictamente personal entre familia y amigos. Cada usuario se registra, gestiona sus calendarios desde un panel, crea eventos (también repetidos, con imágenes y comentarios) y los comparte con otras personas asignándoles un rol (Lector o Editor). También puede importar o sincronizar calendarios externos y preguntar a un asistente de chat por sus eventos y por la disponibilidad común.

**Nombre:** el proyecto se llama **CaFam** en todas partes (marca, PWA, documentación, specs, configuración, comentarios e identificadores; `cafam` en minúsculas donde haga falta). Los nombres anteriores del proyecto (listados en la spec 010) no se usan, salvo en la URL de producción de Vercel, que se conserva, y en las migraciones ya aplicadas, que no se editan (enmienda 3, 2026-10-29).

Queda fuera a propósito: cualquier uso comercial, monetización, publicidad, analítica de terceros, multi-organización o funcionalidades de equipo/empresa, y cualquier servicio que tenga coste económico.

### Hoja de ruta de specs (orientativa, cada una exige su propia spec aprobada)

| Spec | Alcance |
|------|---------|
| 001-base-aplicacion | Proyecto base, autenticación email/contraseña, esquema de datos base con permisos, panel esqueleto, PWA instalable, despliegue |
| 002-calendarios-y-eventos | CRUD de calendarios y eventos, vistas mensual, semanal y diaria |
| 003-comparticion | Enlace de invitación único, ID de calendario + PIN, gestión de roles Lector/Editor |
| 004-importacion-ics | Fase 1 de integración: importación única de un .ics (enlace o archivo) de Google, iCloud u Outlook a un calendario propio editable |
| 005-identidad-visual | Rediseño de todas las pantallas existentes con la identidad visual propia (sección "Identidad visual y diseño de interfaz") y elección del color de acento por el usuario |
| 006-gestion-de-cuenta | Recuperación de contraseña, cambio de email, borrado de cuenta (requiere SMTP gratuito) |
| 007-sincronizacion-oauth | Fase 2: sincronización de solo lectura (proveedor → CaFam) con Google vía OAuth 2.0, actualización automática y manual, y grupos de calendarios. Microsoft se quitó el 2026-10-27 (registrar la aplicación exige tarjeta, P2). Cerrada el 2026-10-28 con la aplicación de Google en "Prueba" (Enmienda 2). La sincronización bidireccional pasa a la 009; Microsoft queda para una versión futura con su propia spec |
| 008-mejoras-de-experiencia | Calendario al estilo de Google Calendar (analizado con REA): alta y detalle en una ventana sobre el calendario, ventana rápida junto al hueco, arrastrar para crear, selector de hora, atajos de teclado, vista recordada |
| 009-sincronizacion-bidireccional | Fase 3: sincronización en los dos sentidos con Google (crear, cambiar, mover y borrar eventos de los calendarios traídos, renombrar, crear y subir calendarios), política de privacidad pública y publicación de la aplicación de Google sin verificar |
| 010-renombrar-cafam | Renombrar todo el proyecto a CaFam (código, configuración, documentación, specs cerradas y repositorio) |
| 011-rediseno-visual | Modo oscuro con selector, transparencias (glassmorphism), animaciones, microinteracciones y transiciones entre vistas y calendarios |
| 012-imagenes-en-eventos | Adjuntar imágenes a los eventos (también en calendarios traídos de Google) con Supabase Storage |
| 013-eventos-recurrentes | Eventos repetidos con reglas personalizables y edición de una repetición, de las siguientes o de toda la serie |
| 014-comentarios-en-eventos | Notas y comentarios en los eventos por cualquier miembro del calendario, Lectores incluidos |
| 015-asistente-de-chat | Asistente de chat en lenguaje natural que consulta los eventos y la disponibilidad común entre usuarios, con un proveedor LLM gratuito |
| 016-calendario-estilo-google | Calendario como Google Calendar en el móvil: eventos como bloques rellenos, cabecera con cajón y botón flotante, deslizar para cambiar de periodo, agenda continua y fila de meses. Se hace antes de la 013 |
| 017-mover-eventos-y-menu | Mover y redimensionar eventos arrastrando (dedo y ratón), menú contextual en el ordenador (color, duplicar, borrar), "Deshacer" en los avisos, detalle en hoja inferior en el móvil, pellizcar para ampliar las horas y más atajos. Va después de la 016 y antes de la 013 |
| 018-sincronizacion-icloud | Sincronización en los dos sentidos con los calendarios de iCloud (iPhone) por CalDAV, con contraseña específica de app y el mismo alcance que Google en la 007 y la 009. Enmienda 6 (iCloud como servicio aceptado y `tsdav` como dependencia) |
| Futura (sin número) | Recordatorios con notificaciones push (Web Push, gratis; en iOS solo con la app instalada) |
| Futura (sin número) | Búsqueda de eventos por título, lugar y descripción |
| Futura (sin número) | Compartir e integrar con el sistema: compartir un evento, recibir `.ics` o fotos compartidas, accesos directos y número de eventos de hoy en el icono |
| Futura (sin número) | Alta de eventos en lenguaje natural ("Cena con Ana mañana a las 21"), sin IA ni coste |

Las specs se numeran por orden de redacción. Las specs 001 a 004, ya cerradas, citan la gestión de cuenta como "spec 005" y OAuth como "spec 006": desde el 2026-10-22 son la 006 y la 007. Las specs cerradas no se editan, con una única excepción: el cambio de nombre a CaFam de la spec 010, que solo sustituye el nombre y no toca requisitos, decisiones ni evidencias (enmienda 3).

## Principios innegociables

- P1: Uso personal sin ánimo de lucro: el proyecto no incluye publicidad, venta de datos, tracking ni analítica de terceros. El único tercero que puede recibir datos de calendario para procesarlos es el proveedor LLM del asistente de chat: solo recibe lo necesario para responder a la pregunta del usuario que lo usa, está declarado en `/privacy` y nunca recibe datos de Google Calendar si sus condiciones le permiten entrenar con ellos (política de datos de usuario de las APIs de Google). Se verifica revisando `package.json` y los imports en cada diff (ningún SDK de ads, analytics o tracking) y, en la spec 015, las condiciones del proveedor elegido.
- P2: Coste cero: todo servicio usado funciona en su capa gratuita (Supabase Free, incluidos Storage y Realtime —200 conexiones a la vez y 2 millones de mensajes al mes—, Vercel Hobby, GitHub Free, Brevo y el proveedor LLM del asistente) y ningún servicio tiene tarjeta de pago asociada al proyecto. Se verifica revisando en la spec que cada servicio nuevo indica su plan gratuito, sus límites y cómo se respetan (cuotas de imágenes, límite de preguntas al asistente).
- P3: Privado por defecto: ningún dato de un calendario (eventos, imágenes, comentarios, disponibilidad) es visible para quien no sea su propietario o un miembro invitado con rol explícito, toda tabla del esquema `public` tiene Row Level Security activado y todo bucket de Storage es privado con políticas en `storage.objects`. El asistente de chat consulta con la sesión del usuario, así que nunca ve más que él; la disponibilidad de otra persona solo se usa si esa persona lo ha consentido. Se verifica con `npm run test:db` en verde (matriz de permisos, también de Storage) y con el test que comprueba que ninguna tabla de `public` tiene RLS desactivado.
- P4: Los secretos solo viven en el servidor: ninguna clave secreta (`service_role`/secret key de Supabase, `CRON_SECRET`, tokens OAuth, contraseñas específicas de app de iCloud, clave del proveedor LLM) lleva prefijo `NEXT_PUBLIC_`, se importa desde código de cliente ni se sube a git. Se verifica con `git check-ignore .env.local` y buscando `NEXT_PUBLIC_.*SECRET` y `service_role` en el diff (cero resultados en `src/`).
- P5: PWA mobile-first: toda pantalla se usa sin scroll horizontal entre 360 px y 1920 px de ancho y la app es instalable (manifest + service worker válidos). Se verifica en Chrome DevTools > Application (manifest sin errores, service worker activo) y con prueba manual en móvil y escritorio.
- P6: Stack cerrado: solo se usan lenguajes, dependencias, servicios y herramientas listados en "Stack permitido"; cualquier otro exige aprobación explícita registrada en la spec que lo introduce. Se verifica comparando `package.json` y los imports con esta constitución y la spec activa.
- P7: Flujo SDD obligatorio: no se escribe código sin spec, plan y tareas aprobados explícitamente por el usuario, en ese orden, y cada tarea se implementa de una en una con su test primero. Se verifica comprobando que cada cambio de código cita una tarea `Tn` de un `tasks.md` aprobado.
- P8: Ninguna tarea se da por hecha sin ejecutar y reportar la verificación obligatoria. Se verifica con el checklist de "Verificación obligatoria" completo y su salida reportada al cerrar cada tarea.
- P9: Identidad visual propia y accesible: toda pantalla sigue las reglas de "Identidad visual y diseño de interfaz", usa solo los tokens de diseño definidos en `src/app/globals.css` (nunca colores, tamaños o radios sueltos) y cumple WCAG 2.2 AA en el tema claro y en el oscuro (texto 4,5:1, elementos gráficos 3:1, objetivos táctiles de 44 px, foco visible, todo usable con teclado, también sobre superficies transparentes). Se verifica en cada tarea que toca interfaz con capturas a 390, 768 y 1440 px en los dos temas revisadas contra la lista de prohibiciones de esa sección y con la comprobación de contraste de cada color de acento en los dos temas.

## Stack permitido

- Lenguaje y versión: TypeScript 5.x en modo `strict`, sobre Node.js 24 LTS (mínimo Node 20.9, requisito de Next.js 16).
- Frontend: Next.js 16 (App Router, Turbopack, Server Components y Server Actions), React 19, Tailwind CSS 4.
- Backend / BaaS: Supabase Free (PostgreSQL con RLS, Supabase Auth email/contraseña, Supabase Storage para las imágenes de los eventos, Supabase Realtime (Broadcast con canales privados, desde la spec 019; enmienda 7), `pg_cron`, `pg_net` y Vault). Región de datos en la UE.
- Hosting: Vercel Hobby (incluye su Cron Job diario) con repositorio en GitHub (privado).
- PWA: nativa de Next.js (`app/manifest.ts`) + service worker propio en `public/sw.js`, sin librerías PWA.
- Servicios externos aceptados: Google Calendar API (OAuth, spec 007 y 009), iCloud por CalDAV (con contraseña específica de app, spec 018; enmienda 6), Brevo (correo, spec 006) y un proveedor LLM con capa gratuita sin tarjeta para el asistente de chat, que elige y aprueba la spec 015 (Gemini queda descartado porque su capa gratuita no puede usarse con usuarios de la UE). El proveedor LLM se llama con `fetch` desde el servidor, sin SDK.
- Dependencias de producción aceptadas: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `ical.js` (aprobada en la spec 004 para leer `.ics`; desde la enmienda 3 también se usa para expandir reglas de repetición, en módulos de `src/lib/` del servidor o puros), `tsdav` (cliente CalDAV, MIT, aprobado en la spec 018 para iCloud; solo en el servidor; enmienda 6) y las que genera `create-next-app` por defecto.
- Animación: solo CSS (transiciones, `@keyframes`) y APIs nativas del navegador (View Transitions API); ninguna librería de animación.
- Dependencias de desarrollo aceptadas: `typescript`, `@types/*`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `eslint-config-prettier`, `prettier`, `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `supabase` (CLI para migraciones y generación de tipos).
- Herramientas obligatorias: npm como gestor de paquetes (con `package-lock.json` versionado), git, Vitest para tests, ESLint + Prettier para lint y formato, Supabase CLI para migraciones.

## Stack prohibido

- Cualquier servicio, hosting o API de pago, o capa gratuita que exija tarjeta de crédito.
- SDKs de publicidad, analítica, tracking o telemetría de terceros (Google Analytics, Meta Pixel, Hotjar, Sentry, etc.).
- Librerías PWA de terceros (`next-pwa`, `@serwist/*`, Workbox) sin aprobación en spec: el service worker es propio.
- ORMs u otras capas de acceso a datos sobre Supabase (Prisma, Drizzle) y backends paralelos: Supabase es la única fuente de datos.
- Otro gestor de paquetes (yarn, pnpm, bun) o lockfiles distintos de `package-lock.json`.
- Cualquier dependencia no listada en "Stack permitido" sin aprobación en la spec que la introduce (por ejemplo, la librería de vistas de calendario o de parseo .ics se decide y aprueba en su spec).

## Convenciones

- Formato: Prettier automático; `npm run format` para formatear y `npm run format:check` para verificar.
- Tipado: `strict: true`, prohibido `any` explícito (regla de ESLint en error); `npm run typecheck` (`tsc --noEmit`) sin errores.
- Nombres de código: inglés; camelCase para variables y funciones, PascalCase para componentes React y tipos, UPPER_SNAKE_CASE para constantes globales.
- Nombres de archivos y carpetas: kebab-case (`login-form.tsx` exporta `LoginForm`), salvo los nombres reservados de Next.js (`page.tsx`, `layout.tsx`, `proxy.ts`, `[param]`, `(grupo)`).
- Rutas URL: en inglés (`/login`, `/signup`, `/dashboard`), coherentes con los nombres de carpetas.
- Base de datos: snake_case; tablas en plural (`calendars`), columnas en singular (`owner_id`); toda tabla con `created_at` y, si es editable, `updated_at`; cambios de esquema solo mediante migraciones en `supabase/migrations/`, nunca editando a mano en el panel de Supabase.
- Fechas: se guardan como `timestamptz` (UTC) y se muestran en la zona horaria del usuario.
- Estructura: `docs/` (constitución y docs generales), `specs/NNN-nombre/` (`spec.md`, `plan.md`, `tasks.md`), `src/` (código de la app), `tests/unit/` y `tests/integration/`, `supabase/migrations/`, `public/` (iconos, service worker). Los ficheros de configuración de herramientas viven en la raíz.
- Idioma: español en docs, specs, mensajes de commit y textos visibles para el usuario (incluidos errores); inglés en identificadores de código, nombres de archivos y comentarios técnicos. Se verifica en revisión del diff.
- Git: rama `main` desplegable siempre; una rama por spec (`001-base-aplicacion`); commits pequeños con prefijo Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) y referencia a la tarea (`feat: registro de usuario (T7)`).
- Variables de entorno: documentadas en `.env.example` sin valores reales; los valores viven en `.env.local` (ignorado por git) y en el panel de Vercel.

## Identidad visual y diseño de interfaz

> **Enmienda 11 (2026-11-16, spec 030).** Esta sección sustituye a la identidad "Orilla" de la enmienda 10 (spec 025), que a su vez había sustituido a la original. El usuario vio Orilla y pidió "cambiar totalmente el estilo visual y de usabilidad" para que se parezca a su prototipo "Nexo", y una mascota con gafas, "foca secretario". Se conservan la interacción del calendario (más abajo), la accesibilidad de P9, los temas claro, oscuro y "como el sistema", el acento elegible y las reglas de rendimiento de la spec 024.

La identidad se llama **Nexo**: fondo lavanda, tarjetas blancas con sombra suave teñida, tinta casi negra con un punto violeta y un acento violeta que se vuelve **degradado** en la acción principal. Limpia, luminosa, de aplicación de productividad. La mascota es **Venito**, una foca vista de frente con gafas, cuello y corbata: el secretario de la casa.

### Móvil primero

- Cada pantalla se diseña primero a **390 px**. El escritorio debe ser bueno, pero es secundario.
- Objetivos táctiles de **44 px** o más en el móvil. Margen lateral de 16 px.
- **Safe areas** de iOS (`env(safe-area-inset-*)`) en todo lo fijo. Alturas con `dvh`/`svh`, nunca `100vh`.
- Los campos de texto miden **16 px o más** (por debajo, iOS amplía la página) y el campo activo nunca queda tapado por el teclado.
- Lo que el dedo arrastra **no espera**: nada que responda a un gesto pasa por una transición con captura previa ni por la red (spec 024).

### Color

- **Neutros** (tokens `stone`, `paper`, `ink`, `muted`, `line`, `control`, `danger`; se conservan sus nombres): fondo lavanda `stone` `#F3F2FA`, tarjetas `paper` `#FFFFFF`, tinta `ink` `#1D1B2E`, texto secundario `muted` `#6F6C86` (4,5:1), línea fina `line` `#E9E7F5` y borde de control `control` con 3:1. En oscuro: fondo `#0F0E1A` y tarjetas `#18172A`, con tinta clara.
- **Acento elegido por el usuario** entre seis: **Violeta** (por defecto), **Azul**, **Verde**, **Ámbar**, **Rosa** y **Grafito** (identificadores guardados `red`, `blue`, `green`, `yellow`, `purple`, `gray`). Cada uno define relleno, **segundo tono del degradado** (`accent-to`), texto encima, variante para texto y líneas, borde y su versión suave (`accent-soft`), en los dos temas. El texto cumple 4,5:1 sobre los dos extremos del degradado (test).
- **El acento es "aquí estás" y "aquí se actúa"**: hoy, la hora actual, la selección, el destino activo y la acción principal. La acción principal y la pestaña activa llevan el **degradado del acento** (`bg-accent-gradient`), el único degradado de un control. Lo activo en reposo (navegación del móvil, chips, avatar) lleva `accent-soft`.
- Los **colores de los calendarios** (paleta pastel de la spec 002) son datos del usuario y no cambian. Los eventos son bloques rellenos de su color con el texto en `pastel-ink`. La información nunca depende solo del color.
- Tema **claro, oscuro o "como el sistema"**, guardado por usuario. El tema cambia las variables, nunca las clases.

### Tipografía, forma y espacio

- **Inter** cargada con `next/font`, una sola familia; cifras tabulares en horas, fechas y contadores. Títulos en **semibold** con interlineado ajustado (`tracking-tight`); cuerpo en 400–500. Sin monoespaciada.
- Se permiten **etiquetas pequeñas en mayúsculas con espaciado** para cabeceras de columna y de sección (iniciales de los días, "PENDIENTES"), nunca para texto de lectura.
- **Radios** como tokens: **tarjeta** 20 px (tarjetas, hojas, la navegación flotante), **control** 12 px (botones, campos, filas), **bloque** 8 px (bloques de evento y marcas) y **círculo** (avatares, botones flotantes, pestañas, chips y casillas de las listas).
- **Elevación** como tokens: **reposo** (borde fino y sombra mínima teñida, `surface`) y **flotante** (sombra amplia teñida, `surface-float`: hojas, ventanas, menús, avisos, la navegación del móvil y los botones flotantes).
- **Sin desenfoque de fondo** (`backdrop-filter`) en ninguna parte.

### Navegación

- **Hasta 768 px**: cabecera fina con la marca (en el calendario, el mes), el tema y el avatar; **píldora flotante** abajo con Calendario, Notas, Calendarios y Más (icono y nombre; la activa con `accent-soft`); y **botones flotantes** a la derecha, sobre la píldora: Venito (44 px) encima de **"+"** (56 px, degradado).
- **Desde 769 px**: **barra superior** con la marca, las pestañas en píldora centradas (la activa con degradado), "Nuevo evento" o "Nueva nota", Venito, el tema y el avatar. Sin barra lateral.
- **"+"** crea lo propio de la pantalla (un evento; una nota en Notas). **"Más"** reúne el resto de destinos y cerrar sesión.
- Cada vista lleva **su cabecera dentro del contenido**: título grande, subtítulo y sus controles (en el calendario, "Hoy ‹ ›" y el selector de vista en píldora).
- Las ventanas del móvil son **hojas inferiores**; en escritorio, ventanas centradas.

### Iconos, marca y mascota

- Iconos **SVG propios en línea**, trazo de 1,75 px con extremos redondos sobre rejilla de 24 px.
- **Marca**: ficha redondeada violeta con una "C" blanca abierta y el punto de "hoy" en su boca; el nombre "CaFam" en Inter semibold. La marca no cambia con el acento del usuario.
- **Venito** es un SVG propio, reconocible a 40 px: foca de frente con **gafas redondas, cuello y corbata**, gesto serio (no hace falta que sea adorable). Expresiones: reposo, saludo, pensando, conforme, confundido y dormido. Colores propios (`seal*`), nunca el acento. Aparece en el botón del asistente, el chat, los estados vacíos, los errores y la pantalla sin conexión.

### Movimiento

- Los tokens de curvas y duraciones de la spec 021 se conservan. Cada animación dura como mucho 400 ms y solo anima `transform`, `opacity` o un recorte. Con `prefers-reduced-motion: reduce`, cada animación se sustituye por un cambio inmediato o un fundido.
- Marcar un elemento de una lista hace un "pop" breve de la casilla y tacha el texto con una línea que avanza.
- Un periodo nuevo del calendario se pinta en la misma actualización, sin transición con captura (spec 024).

### Prohibido en la interfaz

Colores, sombras, radios o degradados sueltos que no sean tokens; `backdrop-filter`; `text-white`, `text-black` y la variante `dark:`; emojis; textos de relleno; más de un color de acento en pantalla; y cualquier campo de texto por debajo de 16 px.

### Cómo se trabaja la interfaz

- Los componentes de `src/components/ui/` son la única fuente de botones, campos, tarjetas, chips, hojas, estados vacíos y avisos.
- La guardia `tests/unit/design-tokens.test.ts` hace cumplir esta sección; `accents.test.ts` y `theme-css.test.ts` mantienen iguales los valores y comprueban el contraste.
- Cada pantalla nueva o rediseñada se revisa con capturas a **390, 768 y 1440 px**, en **claro y oscuro**, con **Violeta y Ámbar**.
- Ninguna librería de componentes, iconos o animación sin aprobación en la spec que la introduce (P6).

### Interacción del calendario (spec 008)

El calendario se comporta como Google Calendar para que quien lo conozca lo entienda sin explicación. Se estudió con REA (`specs/008-mejoras-de-experiencia/analisis-google-calendar.md`) **solo su comportamiento**: no se copia código, estilos, iconos ni imágenes de Google, y su aspecto sigue siendo el de esta sección.

- **Crear sin salir del calendario.** Un hueco vacío (o un arrastre con ratón en semana y día) abre una **ventana rápida** junto al hueco (título, día y horas, calendario); "Más opciones" lleva al formulario completo con lo escrito. El alta, el detalle y la edición se abren en una **ventana sobre el calendario**, a pantalla completa en el móvil; el enlace o la recarga muestran la página completa. Desde la enmienda 5 (spec 017), el **detalle** se abre en el móvil en una **hoja inferior** a media pantalla, que se amplía o se cierra deslizándola; el alta y la edición siguen a pantalla completa.
- **Atajos sin modificadores** (N, T, ←, →, A, M, S, D y, desde la 017, E, G, Supr y ?), nunca mientras se escribe ni con una ventana abierta, y visibles en los botones de vista o en la ayuda de atajos. Los únicos atajos con modificador son Ctrl/Cmd+C y Ctrl/Cmd+V para copiar y pegar un evento, Alt + flechas para moverlo (enmienda 5) y Ctrl/Cmd+Z para "Deshacer" mientras el aviso lo ofrece (enmienda 9).
- **Mover y redimensionar** (enmienda 5, spec 017): los eventos se arrastran con el ratón o, en táctil, tras mantenerlos pulsados 500 ms. Al soltar se guardan sin confirmación. Todo lo que se hace arrastrando se puede hacer también con el teclado.
- **Menú contextual** (enmienda 5): solo con ratón o teclado, con la paleta de colores, "Duplicar" y "Borrar". Sin menú en pantallas táctiles.
- **Horas como combobox**: se escriben o se eligen de una lista de 30 en 30 minutos; la de fin muestra la duración y sigue a la de inicio.
- **Aviso breve** abajo tras guardar, borrar o duplicar, que se anuncia a los lectores de pantalla. Desde la enmienda 5 (spec 017), el aviso de mover, redimensionar, cambiar el color, pegar o borrar un evento ofrece "Deshacer" durante 10 s, solo para la última acción. Borrar un solo evento ya no pide confirmación.
- Lo que flota (la ventana de evento, la ventana rápida, la lista de horas, el aviso, los diálogos, el cajón, el botón flotante "+" y los tooltips) lleva la sombra de "flotante"; las superficies en reposo, como mucho la sombra suave de las transparencias. La guardia `design-tokens.test.ts` mantiene los tokens de sombra.
- **Gestos del móvil** (enmienda 4, spec 016; enmienda 10): deslizar a izquierda o derecha en mes, semana y día cambia de periodo, también sobre la rejilla de horas, sin esperar a la red; la agenda es una lista continua. Todo lo que se hace deslizando también se puede hacer con un control o un atajo.
- **Pellizcar para ampliar** (enmienda 5): en semana y día, pellizcar o Ctrl + rueda cambia la altura de las horas, recordada por dispositivo.
- Fuera de alcance: arrastrar a otro periodo o a otro calendario, seleccionar varios eventos y deshacer más de una acción.

## Verificación obligatoria

Checklist que cierra cada tarea (se reporta la salida de cada comando):

- [ ] Tipos sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`
- [ ] Formato correcto: `npm run format:check`
- [ ] Tests unitarios y de componentes en verde: `npm test`
- [ ] Tests de base de datos y permisos en verde: `npm run test:db` (obligatorio si la tarea toca esquema, RLS o acceso a datos; ver P3)
- [ ] Build de producción sin errores: `npm run build`
- [ ] Prueba manual en móvil (≤ 768 px) y escritorio si la tarea toca interfaz (ver P5)
- [ ] Si la tarea toca interfaz: capturas a 390, 768 y 1440 px en tema claro y oscuro revisadas contra "Identidad visual y diseño de interfaz", contraste comprobado con los seis acentos en los dos temas y movimiento revisado con `prefers-reduced-motion` (ver P9)
- [ ] Aprobación explícita del usuario antes de pasar de fase (spec → plan → tareas → implementación) y al cerrar cada spec

## Dudas abiertas

- Las decisiones de stack de esta versión (Next.js 16 + Supabase Free + Vercel Hobby + Tailwind CSS 4) fueron confirmadas por el usuario en la spec 001.
- Resueltas en la spec 005: la tipografía es Inter Tight; los valores de los seis acentos y de los neutros están en `src/lib/theme/accents.ts` (con su contraste comprobado en `accents.test.ts`); y el acento se guarda por usuario en `profiles.accent`, así que se ve igual en todos sus dispositivos.
- Enmienda 3 (2026-10-29, aprobada por el usuario): nombre CaFam en todas partes, tema oscuro, transparencias, sombras, degradados y animaciones, Supabase Storage, `ical.js` para repeticiones, asistente de chat con un proveedor LLM gratuito y excepción de cambio de nombre en las specs cerradas. Las enmiendas 1 y 2 están en la spec 007.
- Enmienda 4 (2026-10-30, aprobada por el usuario con la spec 016): eventos como bloques rellenos en todas las vistas, composición del móvil al estilo Google Calendar (cabecera, cajón y botón flotante, sin barra inferior), día de la agenda al estilo Google y banda del mes con degradado.
- Enmienda 5 (2026-10-30, aprobada por el usuario con la spec 017): mover y redimensionar eventos arrastrando, menú contextual en el ordenador, "Deshacer" en los avisos (y borrar un evento sin confirmación), detalle en hoja inferior en el móvil, pellizcar para ampliar y atajos nuevos (E, G, Supr, ?, Ctrl/Cmd+C/V y Alt + flechas).
- Enmienda 6 (2026-11-01, aprobada por el usuario con la spec 018): iCloud por CalDAV como servicio externo aceptado, `tsdav` como dependencia de producción del servidor y las contraseñas específicas de app de iCloud entre los secretos de P4.
- Enmienda 7 (2026-11-02, aprobada por el usuario con el plan de la spec 019): Supabase Realtime (Broadcast desde la base de datos con canales privados) para ver al momento los cambios de los demás. Los mensajes no llevan datos de eventos: solo avisan de que hay que volver a leer con RLS.
- Enmienda 8 (2026-11-07, aprobada por el usuario con la spec 021): animar recortes (`clip-path`) para revelar contenido y cambios de color, y ninguna animación con rebote salvo el pulso de confirmación.
- Enmienda 9 (2026-11-11, aprobada de antemano por el usuario con la spec 023): Ctrl/Cmd+Z ejecuta "Deshacer" mientras el aviso lo ofrece, nunca al escribir en un campo. "Deshacer" sustituye a la confirmación de borrado (enmienda 5) y con teclado su botón quedaba al final del orden de tabulación durante 10 s; P9 exige que todo se pueda usar con el teclado.
- Resuelta en la spec 015: una persona consiente que el asistente use su disponibilidad con un ajuste propio, desactivado por defecto. El proveedor LLM es **Groq** (capa gratuita sin tarjeta, sin entrenamiento con los datos y con retención cero activada), con `openai/gpt-oss-120b` y `qwen/qwen3.8-27b` de reserva, llamado con `fetch` y la clave `GROQ_API_KEY` solo en el servidor; 30 preguntas por usuario y día.
- Enmienda 10 (2026-11-15, aprobada de antemano por el usuario con el encargo de rediseño, spec 025): identidad visual **Orilla** en lugar de la anterior (colores, tipografía Figtree, tres radios, dos elevaciones, sin desenfoque de fondo), el acento también como acción principal, navegación con barra inferior y "+" central en lugar del cajón y el botón flotante, hojas inferiores en el móvil, marca nueva y la mascota Venito. Motivo: decisión del usuario de cambiar todo el frontend con el iPhone primero; el desenfoque se retira por rendimiento (spec 024).
- Enmienda 11 (2026-11-16, pedida por el usuario con su prototipo, spec 030): identidad visual **Nexo** en lugar de Orilla (lavanda, violeta con degradado, Inter, radios de 20 y 12 px, sombras teñidas), navegación en píldora (flotante abajo en el móvil con "+" y Venito como botones flotantes; arriba en escritorio, sin barra lateral), cabecera de cada vista dentro del contenido, etiquetas pequeñas en mayúsculas permitidas y Venito como foca secretario con gafas. Motivo: el usuario vio la identidad de la enmienda 10 y prefirió la de su prototipo.
