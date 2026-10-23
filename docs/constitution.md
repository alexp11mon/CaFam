# Constitution - CalendarioFamilia

## Contexto y objetivo

CalendarioFamilia es una aplicación web progresiva (PWA) de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso estrictamente personal entre familia y amigos. Cada usuario se registra, gestiona sus calendarios desde un panel, crea eventos y los comparte con otras personas asignándoles un rol (Lector o Editor). También puede importar calendarios externos (Google, iCloud, Outlook) desde un enlace o un archivo iCal/.ics, que se convierten en calendarios propios editables y compartibles.

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
| 007-sincronizacion-oauth | Fase 2: sincronización de solo lectura (proveedor → CaFam) con Google y Microsoft vía OAuth 2.0, actualización automática y manual, y grupos de calendarios. La sincronización bidireccional queda para una versión futura con su propia spec |
| 008-mejoras-de-experiencia | Calendario al estilo de Google Calendar (analizado con REA): alta y detalle en una ventana sobre el calendario, ventana rápida junto al hueco, arrastrar para crear, selector de hora, atajos de teclado, vista recordada |

Las specs se numeran por orden de redacción. Las specs 001 a 004, ya cerradas, citan la gestión de cuenta como "spec 005" y OAuth como "spec 006": desde el 2026-10-22 son la 006 y la 007 (las specs cerradas no se editan).

## Principios innegociables

- P1: Uso personal sin ánimo de lucro: el proyecto no incluye publicidad, venta de datos, tracking ni analítica de terceros. Se verifica revisando `package.json` y los imports en cada diff: no puede aparecer ningún SDK de ads, analytics o tracking.
- P2: Coste cero: todo servicio usado funciona en su capa gratuita (Supabase Free, Vercel Hobby, GitHub Free) y ningún servicio tiene tarjeta de pago asociada al proyecto. Se verifica revisando en la spec que cada servicio nuevo indica su plan gratuito y sus límites.
- P3: Privado por defecto: ningún dato de un calendario es visible para quien no sea su propietario o un miembro invitado con rol explícito, y toda tabla del esquema `public` tiene Row Level Security activado. Se verifica con `npm run test:db` en verde (matriz de permisos) y con el test que comprueba que ninguna tabla de `public` tiene RLS desactivado.
- P4: Los secretos solo viven en el servidor: ninguna clave secreta (`service_role`/secret key de Supabase, `CRON_SECRET`, tokens OAuth) lleva prefijo `NEXT_PUBLIC_`, se importa desde código de cliente ni se sube a git. Se verifica con `git check-ignore .env.local` y buscando `NEXT_PUBLIC_.*SECRET` y `service_role` en el diff (cero resultados en `src/`).
- P5: PWA mobile-first: toda pantalla se usa sin scroll horizontal entre 360 px y 1920 px de ancho y la app es instalable (manifest + service worker válidos). Se verifica en Chrome DevTools > Application (manifest sin errores, service worker activo) y con prueba manual en móvil y escritorio.
- P6: Stack cerrado: solo se usan lenguajes, dependencias, servicios y herramientas listados en "Stack permitido"; cualquier otro exige aprobación explícita registrada en la spec que lo introduce. Se verifica comparando `package.json` y los imports con esta constitución y la spec activa.
- P7: Flujo SDD obligatorio: no se escribe código sin spec, plan y tareas aprobados explícitamente por el usuario, en ese orden, y cada tarea se implementa de una en una con su test primero. Se verifica comprobando que cada cambio de código cita una tarea `Tn` de un `tasks.md` aprobado.
- P8: Ninguna tarea se da por hecha sin ejecutar y reportar la verificación obligatoria. Se verifica con el checklist de "Verificación obligatoria" completo y su salida reportada al cerrar cada tarea.
- P9: Identidad visual propia y accesible: toda pantalla sigue las reglas de "Identidad visual y diseño de interfaz", usa solo los tokens de diseño definidos en `src/app/globals.css` (nunca colores, tamaños o radios sueltos) y cumple WCAG 2.2 AA (texto 4,5:1, elementos gráficos 3:1, objetivos táctiles de 44 px, foco visible, todo usable con teclado). Se verifica en cada tarea que toca interfaz con capturas a 390, 768 y 1440 px revisadas contra la lista de prohibiciones de esa sección y con la comprobación de contraste de cada color de acento.

## Stack permitido

- Lenguaje y versión: TypeScript 5.x en modo `strict`, sobre Node.js 24 LTS (mínimo Node 20.9, requisito de Next.js 16).
- Frontend: Next.js 16 (App Router, Turbopack, Server Components y Server Actions), React 19, Tailwind CSS 4.
- Backend / BaaS: Supabase Free (PostgreSQL con RLS, Supabase Auth email/contraseña). Región de datos en la UE.
- Hosting: Vercel Hobby (incluye su Cron Job diario) con repositorio en GitHub (privado).
- PWA: nativa de Next.js (`app/manifest.ts`) + service worker propio en `public/sw.js`, sin librerías PWA.
- Dependencias de producción aceptadas: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, y las que genera `create-next-app` por defecto.
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

La interfaz deja de ser la plantilla por defecto (azul sobre blanco) y adopta un estilo propio, sobrio y editorial, inspirado en la imagen de referencia `docs/referencia.jpg`. Esa imagen es **solo local**: está en `.gitignore`, no se sube a GitHub ni se copia en el código, y si falta, esta sección es la fuente de verdad. Se toma de ella el lenguaje visual, no sus pantallas ni sus funciones.

### Qué se toma de la referencia

- **Fondo piedra cálido y paneles un tono más claros.** La pantalla es un plano de color piedra; la barra lateral y los paneles se separan por un escalón de tono, no por sombras. Tinta casi negra para el texto y gris cálido para lo secundario.
- **El número del día como protagonista.** En la vista de agenda/día, la fecha se compone con un número enorme y muy grueso (el gesto distintivo de la referencia) con el día de la semana pequeño y en el color de acento al lado. Es la única excepción a la escala tipográfica contenida de una app.
- **Eventos como filas de texto, no como bloques de color.** Hora en negrita con la hora de fin en gris, una barra vertical fina con el color del calendario o de la categoría, título en negrita y el lugar o la nota en gris. El color identifica, no rellena.
  - **Excepción (enmienda del 2026-10-23, spec 008 plan D9, aprobada por el usuario):** en la **vista mes**, los eventos de día completo y de varios días son una barra **rellena** con el color pastel del calendario, con el texto en tinta y un contorno `ink/15`, como en Google Calendar; los eventos con hora del mes son un **punto** del color + hora + título, sin relleno. Toda la paleta tiene un contraste ≥ 4,5:1 con la tinta (`palette.test.ts`). Fuera de esa barra el color sigue siendo solo una marca.
- **Un único color de acento para "ahora" y "hoy":** el día de hoy en el mini calendario (cuadrado relleno), la línea de la hora actual, las abreviaturas de los días y el elemento seleccionado. En nada más.
- **Botones de acción en negro**, totalmente redondos (píldora o círculo), con texto blanco; los secundarios, sin relleno o en el tono del panel. El botón flotante "+" (crear evento) es un círculo negro.
- **Mini calendario mensual** compacto con puntos de color bajo los días que tienen eventos (un punto por calendario, máximo tres).
- **Personas como avatares circulares** (iniciales sobre un tinte pálido propio de cada persona, porque la app no guarda fotos), usados en el filtro por persona y en la lista de miembros.
- **Una superficie de color pleno por pantalla como máximo**, para lo más urgente (p. ej. el próximo evento con su cuenta atrás), en lugar de tarjetas iguales.
- **Escritorio en columnas** (navegación estrecha, panel con mini calendario y listas, área principal de agenda) y **móvil como composición propia**: título grande con la fecha, contenido a ancho completo y barra inferior con botones circulares y la acción principal como píldora negra centrada.

### Qué se ignora de la referencia

Su contenido y sus funciones, que no existen en la app ni están en su alcance: el "Ai Assistant" y cualquier panel de IA (P1, P2), notas de voz, temporizador, documentos, tareas, integraciones con terceros, videollamadas y fotos de perfil. También sus restos de plantilla: emojis como iconos, textos en inglés y la marca "SAI".

### Color

- Tokens orientativos medidos sobre la referencia (el plan de la spec 005 fija los valores finales y comprueba su contraste): fondo `stone` ≈ `#E8E5DD`, panel `paper` ≈ `#F2F0EA`, tinta `ink` ≈ `#141414`, texto secundario `muted` lo bastante oscuro para 4,5:1 sobre `paper` (≈ `#66635D`), líneas `line` ≈ `#DAD6CC`.
- **Color de acento elegido por el usuario** entre seis: rojo (el de la referencia, por defecto), azul, verde, amarillo, morado y gris. Cada acento define a la vez su relleno, el color del texto que va encima y su variante para texto o líneas sobre el fondo, de modo que los seis cumplen P9 (el amarillo, por ejemplo, nunca se usa como texto sobre fondo claro y lleva tinta encima).
- El acento de la interfaz y los **colores de los calendarios** (paleta pastel cerrada de la spec 002) son cosas distintas: los calendarios colorean datos (barras, puntos, avatares); el acento marca "hoy", "ahora" y la selección. La información nunca depende solo del color (hoy también va en negrita o con relleno; los estados llevan texto).
- Sin tema oscuro (sigue fuera de alcance).

### Tipografía, forma y espacio

- **Una sola familia neo-grotesca** cargada con `next/font` (sin dependencias nuevas), con pesos del 400 al 800 y cifras tabulares (`tabular-nums`) en horas, fechas y contadores. La elige el plan de la spec 005. Sin monoespaciada.
- Escala corta: pocas tallas visibles (orientativo 12/14/16/20/28) más el número del día gigante. Títulos de pantalla de 20 a 32 px; mayúsculas solo al inicio de frase.
- Radios decididos una vez: paneles con radio medio (≈ 16 px), controles y botones totalmente redondos.
- Márgenes laterales de 16 px en móvil y una rejilla única en escritorio; el espacio entre bloques es mayor que el espacio dentro de ellos.
- Movimiento solo como respuesta (pulsar, foco, abrir un diálogo), con alternativa para `prefers-reduced-motion`.

### Prohibido en la interfaz

Degradados; sombras en lo que está en reposo (solo en lo que flota: diálogos, menús); cristal o desenfoque de fondo; brillos; emojis; iconos dentro de cuadrados o círculos de color; filas de tarjetas idénticas con icono encima; etiquetas pequeñas en mayúsculas con espaciado; etiquetas o "píldoras" encima de un título; textos de relleno (lorem ipsum, "Usuario 1"); el acento en todos los botones o en la navegación; más de un color de acento en pantalla; y paletas violeta/índigo como base (el morado solo existe como acento elegido por el usuario).

### Cómo se trabaja la interfaz

- Los componentes de `src/components/ui/` son la única fuente de botones, campos y avisos; una variante nueva se añade ahí, no en la página.
- Para diseñar o revisar pantallas se usan las skills `design-taste-frontend` (reglas de pantallas de aplicación, `references/app-screens.md`), `frontend-design` y `web-design-guidelines`.
- Ninguna librería de componentes, iconos o animación sin aprobación en la spec que la introduce (P6); los iconos se dibujan como SVG propios en línea, de trazo fino y un solo estilo.

### Interacción del calendario (spec 008)

El calendario se comporta como Google Calendar para que quien lo conozca lo entienda sin explicación. Se estudió con REA (`specs/008-mejoras-de-experiencia/analisis-google-calendar.md`) **solo su comportamiento**: no se copia código, estilos, iconos ni imágenes de Google, y su aspecto sigue siendo el de esta sección.

- **Crear sin salir del calendario.** Un hueco vacío (o un arrastre con ratón en semana y día) abre una **ventana rápida** junto al hueco (título, día y horas, calendario); "Más opciones" lleva al formulario completo con lo escrito. El alta, el detalle y la edición se abren en una **ventana sobre el calendario**, a pantalla completa en el móvil; el enlace o la recarga muestran la página completa.
- **Atajos sin modificadores** (N, T, ←, →, A, M, S, D), nunca mientras se escribe ni con una ventana abierta, y visibles en los botones de vista.
- **Horas como combobox**: se escriben o se eligen de una lista de 30 en 30 minutos; la de fin muestra la duración y sigue a la de inicio.
- **Aviso breve** abajo tras guardar, borrar o duplicar, que se anuncia a los lectores de pantalla. Sin "Deshacer".
- Lo que flota y lleva sombra: la ventana de evento, la ventana rápida, la lista de horas y el aviso (además de diálogos, la hoja "Más" y los tooltips). La guardia `design-tokens.test.ts` mantiene la lista.
- Fuera de alcance hasta su spec: mover o redimensionar eventos arrastrando.

## Verificación obligatoria

Checklist que cierra cada tarea (se reporta la salida de cada comando):

- [ ] Tipos sin errores: `npm run typecheck`
- [ ] Lint sin errores: `npm run lint`
- [ ] Formato correcto: `npm run format:check`
- [ ] Tests unitarios y de componentes en verde: `npm test`
- [ ] Tests de base de datos y permisos en verde: `npm run test:db` (obligatorio si la tarea toca esquema, RLS o acceso a datos; ver P3)
- [ ] Build de producción sin errores: `npm run build`
- [ ] Prueba manual en móvil (≤ 768 px) y escritorio si la tarea toca interfaz (ver P5)
- [ ] Si la tarea toca interfaz: capturas a 390, 768 y 1440 px revisadas contra "Identidad visual y diseño de interfaz" y contraste comprobado con los seis acentos (ver P9)
- [ ] Aprobación explícita del usuario antes de pasar de fase (spec → plan → tareas → implementación) y al cerrar cada spec

## Dudas abiertas

- Las decisiones de stack de esta versión (Next.js 16 + Supabase Free + Vercel Hobby + Tailwind CSS 4) fueron confirmadas por el usuario en la spec 001.
- Resueltas en la spec 005: la tipografía es Inter Tight; los valores de los seis acentos y de los neutros están en `src/lib/theme/accents.ts` (con su contraste comprobado en `accents.test.ts`); y el acento se guarda por usuario en `profiles.accent`, así que se ve igual en todos sus dispositivos.
