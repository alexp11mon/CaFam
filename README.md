<div align="center">

# 📅 CaFam

**Calendario compartido, mobile-first e instalable para familia y amigos.**

Eventos recurrentes, imágenes, comentarios, notas y listas compartidas, sincronización con Google e iCloud, Venito (un asistente de chat con LLM gratuito) y tiempo real con Supabase Realtime.

<br/>

[![Producción en Vercel](https://img.shields.io/badge/Producción-Vercel-000000?style=for-the-badge&logo=vercel)](https://calendario-familia-five.vercel.app)
[![Base de datos Supabase](https://img.shields.io/badge/Base%20de%20datos-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Framework Next.js](https://img.shields.io/badge/Framework-Next.js%2016.4-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Lenguaje TypeScript](https://img.shields.io/badge/Lenguaje-TypeScript%205-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Estilos Tailwind CSS](https://img.shields.io/badge/Estilos-Tailwind%20CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![Tests Vitest](https://img.shields.io/badge/Tests-Vitest%205-FF3E00?style=for-the-badge&logo=vitest)](https://vitest.dev)
[![PWA instalable](https://img.shields.io/badge/PWA-Instalable-000000?style=for-the-badge&logo=pwa)](https://calendario-familia-five.vercel.app)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

<br/>
<br/>

</div>

---

## 📋 Índice

1. [¿Qué es CaFam?](#-qué-es-cafam)
2. [Estado del proyecto](#-estado-del-proyecto)
3. [Funcionalidades principales](#-funcionalidades-principales)
4. [Tecnología y stack](#-tecnología-y-stack)
5. [Estructura del repositorio](#-estructura-del-repositorio)
6. [Cómo funciona (flujo de usuario)](#-cómo-funciona)
7. [Rutas principales](#-rutas-principales)
8. [Instalación y desarrollo](#-instalación-y-desarrollo)
9. [Variables de entorno](#-variables-de-entorno)
10. [Base de datos y migraciones](#-base-de-datos-y-migraciones)
11. [Pruebas y calidad de código](#-pruebas-y-calidad-de-código)
12. [PWA y despliegue](#-pwa-y-despliegue)
13. [Seguridad y privacidad](#-seguridad-y-privacidad)
14. [Convenciones de código](#-convenciones-de-código)
15. [Hoja de ruta: specs pendientes y futuro](#-hoja-de-ruta-specs-pendientes-y-futuro)
16. [Fuera de alcance](#-fuera-de-alcance)
17. [Licencia](#-licencia)

---

## 🎯 ¿Qué es CaFam?

**CaFam** es una PWA (Progressive Web App) de calendario compartido, **mobile-first** e instalable en iOS, Android y escritorio, pensada para uso **estrictamente personal** entre familia y amigos.

Cada usuario se registra, ve sus calendarios en un panel, crea eventos, los comparte con roles **Lector** o **Editor** (por enlace o por ID y PIN) e importa calendarios externos (Google, iCloud, Outlook) desde un enlace o archivo `.ics`.

### Pilares del proyecto

| Pilar                     | Descripción                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Sin ánimo de lucro**    | Sin publicidad, sin analítica ni tracking de ningún tipo.                                                                              |
| **Coste cero**            | Solo capas gratuitas: Supabase Free, Vercel Hobby, GitHub Free, Brevo (300 correos/día) y un proveedor LLM gratuito para el asistente. |
| **Privado por defecto**   | Toda tabla de la base de datos tiene RLS (Row Level Security). La base de datos es la frontera de seguridad.                           |
| **Español en toda la UI** | Todo lo visible para el usuario está en español; inglés solo en identificadores, nombres de archivos y comentarios técnicos.           |

- **Producción:** <https://calendario-familia-five.vercel.app>
- **Repositorio (privado):** <https://github.com/alexp11mon/CaFam>

---

## 📊 Estado del proyecto

| Spec | Alcance                                                                | Estado                                            |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| 001  | Base: auth, esquema con RLS, panel esqueleto, PWA, despliegue          | ✅ Cerrada                                        |
| 002  | Calendarios, categorías y eventos; vistas mensual, semanal y diaria    | ✅ Cerrada                                        |
| 003  | Compartición: enlace, ID + PIN, roles Lector/Editor, miembros          | ✅ Cerrada                                        |
| 004  | Importación única de `.ics` (enlace o archivo)                         | ✅ Cerrada                                        |
| 005  | Identidad visual, color de acento, marco, agenda, mini calendario      | ✅ Cerrada                                        |
| 006  | Gestión de cuenta: recuperación, email, contraseña, borrar cuenta      | ✅ Cerrada                                        |
| 007  | Sincronización solo lectura con Google OAuth 2.0 y grupos              | ✅ Cerrada                                        |
| 008  | Mejoras de experiencia: ventana de evento, arrastrar, atajos           | ✅ Cerrada                                        |
| 009  | Sincronización bidireccional con Google                                | ✅ Cerrada                                        |
| 010  | Renombrado a CaFam                                                     | ✅ Cerrada                                        |
| 011  | Modo oscuro, animaciones, microinteracciones                           | ✅ Cerrada                                        |
| 012  | Imágenes en eventos con Supabase Storage                               | ✅ Cerrada                                        |
| 013  | Eventos recurrentes con reglas personalizables                         | ✅ Cerrada                                        |
| 014  | Comentarios en eventos                                                 | ✅ Cerrada                                        |
| 015  | Asistente de chat con proveedor LLM gratuito (Groq)                    | ✅ Cerrada                                        |
| 016  | Calendario estilo Google Calendar en móvil                             | ✅ Cerrada                                        |
| 017  | Mover/redimensionar arrastrando, menú contextual, "Deshacer"           | ✅ Cerrada                                        |
| 018  | Calendarios de iCloud por CalDAV                                       | ✅ Cerrada                                        |
| 019  | Escritorio, móvil y tiempo real (Supabase Realtime)                    | ✅ Cerrada                                        |
| 020  | Disponibilidad ("Ocupado") y sincronización rápida                     | ✅ Cerrada                                        |
| 021  | Animaciones y microinteracciones                                       | ✅ Cerrada                                        |
| 022  | Eventos desde la foto de un horario                                    | ✅ Cerrada                                        |
| 023  | Auditoría y 25 correcciones                                            | ✅ Cerrada (migraciones pendientes en prod)       |
| 024  | Rendimiento: cambio de periodo sin red, asistente en streaming         | ✅ Cerrada                                        |
| 025  | Sistema de diseño y componentes base                                   | ✅ Cerrada                                        |
| 026  | Calendario móvil primero                                               | ✅ Cerrada                                        |
| 027  | Venito y el chat como conversación                                     | ✅ Cerrada                                        |
| 028  | Notas y listas de tareas                                               | ✅ Cerrada (migraciones pendientes en dev y prod) |
| 029  | Pantallas restantes y recorrido en móvil                               | ✅ Cerrada                                        |
| 030  | Identidad visual "Nexo"                                                | ✅ Cerrada                                        |
| 031  | Venito pasa a ser una morsa                                            | ✅ Cerrada                                        |
| 032  | Panel lateral desplazable y calendarios plegables                      | ✅ Cerrada                                        |
| 033  | Next.js 16.4.6 y `npm audit` sin vulnerabilidades                      | ✅ Cerrada                                        |
| 034  | Modo sin conexión: copia en el dispositivo, cola y conflictos          | ✅ Cerrada                                        |
| 035  | Sin conexión, fase 2: Google, iCloud, series, comentarios, imágenes    | ✅ Cerrada                                        |
| 036  | Venito crea eventos y propone cambios desde el chat                    | 🟡 Hecha, pendiente del eval y del cierre         |
| 037  | El "+" no tapa "Enviar" en la pantalla del asistente                   | ✅ Cerrada                                        |
| 038  | La sincronización no borra lo que queda fuera de la ventana            | ✅ Cerrada (migración pendiente en prod)          |
| 039  | Búsqueda de eventos, también sin conexión                              | ✅ Cerrada (migración pendiente en prod)          |
| 040  | Recordatorios y notificaciones push                                    | ✅ Cerrada (migración y claves VAPID pendientes)  |
| 041  | Alta de eventos en lenguaje natural, sin IA                            | ✅ Cerrada                                        |
| 042  | Vistas de año y de 4 días                                              | ✅ Cerrada (migración pendiente en prod)          |
| 043  | Exportar a `.ics` y enlace de suscripción de solo lectura              | ✅ Cerrada (migración pendiente en prod)          |
| 044  | Importar a un calendario existente y mantener actualizado lo importado | ✅ Cerrada (migraciones pendientes en prod)       |
| 045  | Zona horaria por evento                                                | ✅ Cerrada (migraciones pendientes en prod)       |
| 046  | Papelera y deshacer de varias acciones                                 | ✅ Cerrada (migración pendiente en prod)          |
| 047  | Compartir e integrar con el sistema                                    | ✅ Cerrada (migración pendiente en prod)          |

> Las specs 024 a 035 están en `main`. La 036 y la 037 están en la rama `claude/gallant-goldberg-0bzfzk`, pendientes de merge.

> Las specs 001–004 (cerradas, no se editan) citan la gestión de cuenta como "spec 005" y OAuth como "spec 006": hoy son la 006 y la 007.

---

## ✨ Funcionalidades principales

### 🗓️ Calendarios y eventos

- **Panel con calendarios** en el orden guardado por el usuario, con accesos a crear, editar, categorías y juntar.
- **CRUD de calendarios** (nombre, descripción, color pastel de una paleta cerrada) y **categorías por calendario**.
- **CRUD de eventos** (hora, día completo, varios días, descripción, lugar, color propio y categoría).
- **Papelera y deshacer:** lo borrado se guarda 30 días en la Papelera (en "Más" y en las opciones de cada calendario) para restaurarlo; Ctrl/⌘+Z deshace las últimas 20 acciones y Ctrl/⌘+Mayús+Z las rehace.
- **Zona horaria por evento:** un evento con hora puede tener su zona (y otra para el fin, como un vuelo); se edita en ella, cada persona lo ve en la suya y el detalle enseña la hora original. Viaja a Google, iCloud y los `.ics`.
- **Vistas agenda, año, mensual, semanal, de 4 días y diaria** que mezclan todos los calendarios (el año con un punto por calendario en los días con eventos; atajos Y y X), con panel de filtros por persona → calendario → categoría. La visibilidad y el orden se guardan por usuario.
- **Vista agenda** continua (por defecto): bandas de mes, separadores de semana, "Sin eventos" y carga de más días al llegar a un extremo.
- **Cambio de periodo sin red:** el calendario lee una ventana ancha de eventos y cambia de mes, semana o día en el navegador, con precarga de los contiguos.
- **Panel del calendario:** tarjeta de saludo con el próximo evento y cuenta atrás, mini calendario con puntos por calendario y filtros. El panel se desplaza por sí mismo si no cabe.
- **Calendarios plegables:** cada grupo o persona de los filtros se pliega (sin cambiar qué se ve), las categorías van plegadas bajo su calendario, el orden se cambia en el modo "Ordenar" y lo plegado se recuerda en el dispositivo.
- **Grupos de calendarios** para mostrar u ocultar varios a la vez. "Mis calendarios" muestra grupos plegables y cada calendario en una fila que se despliega con sus acciones.
- **Juntar calendarios propios** en uno (fusión real, irreversible, con confirmación).

### ✍️ Alta en lenguaje natural

- "Escribe el evento" en el alta rápida y en el formulario: "Cena con Ana el viernes a las 21 en casa @familia" rellena título, día, horas, lugar, calendario y repetición sencilla ("cada lunes").
- Vista previa mientras se escribe, con lo entendido subrayado y avisos ("Se entiende por la tarde: 17:00"); nada cambia hasta pulsar "Aplicar" o Intro, y lo editado a mano no se pisa.
- Un analizador propio en español, sin IA ni red: funciona también sin conexión.

### 🔎 Búsqueda

- Lupa en la cabecera del calendario (o tecla `/`): busca por título, lugar, descripción y comentarios en todos tus calendarios, también los ocultos, sin importar tildes ni mayúsculas.
- Resultados por día, próximos primero, con las repeticiones de las series y el comentario que coincide resaltado.
- Sin conexión busca en los datos guardados en el dispositivo.

### 🔔 Recordatorios y notificaciones

- Hasta 3 recordatorios personales por evento ("10 minutos antes", "El día anterior a las 9:00"…), con un aviso por defecto en Ajustes que se pone al crear; cualquier miembro, Lectores incluidos, se los pone desde el detalle ("Avisarme").
- Avisos cuando alguien se une a un calendario tuyo, te da acceso, comenta o cambia un evento tuyo (cada tipo se activa en Ajustes; nunca por la sincronización).
- Web Push con VAPID y cifrado de extremo a extremo hechos con `node:crypto`, sin dependencias ni servicios de pago. En el iPhone, solo con CaFam añadida a la pantalla de inicio.

### 👥 Compartición

- **Por enlace:** rol Lector o Editor, 1 a 20 usos, caduca a los 7 días, se muestra una sola vez y se puede revocar. Ruta pública `/invite/[token]` con vista previa y unión al pulsar "Unirme".
- **Por ID y PIN:** ID de 8 caracteres y PIN de 6 a 10 dígitos que elige el propietario, con límite de 5 fallos por persona y 20 por ID cada 15 minutos.
- **Lista de miembros:** solo nombre y rol, nunca email. El propietario cambia roles y expulsa; los demás pueden salir. El propietario no puede salir ni ser expulsado.

### 📥 Importación de calendarios externos

- Importar un `.ics` **una sola vez**, desde un enlace (`https://` o `webcal://`) o un archivo, creando un **calendario nuevo** editable y compartible.
- Cada repetición de un evento repetido se crea como evento suelto; las series sin fin llegan hasta 1 año desde el día de la importación. Se respetan `EXDATE` y repeticiones modificadas.
- Límite de 2 MB y 2.000 eventos.

### 🔐 Gestión de cuenta

- Recuperar y cambiar contraseña, cambiar email, editar perfil y borrar cuenta.
- Borrar la cuenta deja los calendarios compartidos sin propietario 15 días, con avisos en "Mis calendarios" y por correo, y decisión de **Conservar** o **Salir** para cada miembro.
- Correo por Brevo (plan gratuito, 300 al día) vía SMTP y `pg_net` con la clave en Vault.

### ☁️ Sincronización con Google e iCloud

- **Google:** conexión por OAuth 2.0, hasta 5 cuentas, elegir hasta 20 calendarios, actualización en minutos gracias a los avisos de Google (cada 15 minutos como respaldo) y manual. Escritura completa: crear, cambiar, mover y borrar eventos, renombrar, crear y subir calendarios.
- **iCloud:** por CalDAV con contraseña específica de app, mismo alcance que Google (leer, escribir, renombrar, crear y subir), cada 15 minutos.
- Antes de leer se comprueba la versión del calendario: si no cambió, no se descarga nada.
- Lo que queda fuera de la ventana de lectura (6 meses atrás, 12 adelante) no se borra: se conserva como copia antigua, con sus imágenes y comentarios.
- Avisos de permiso revocado o fallos de sincronización en "Mis calendarios".

### 🖼️ Imágenes en eventos

- Añadir imágenes en el detalle para **cualquier miembro**, Lectores incluidos, también en calendarios traídos de Google (las imágenes nunca se envían a Google).
- Reducción a 2048 px y miniatura de 400 px en el dispositivo, recompresión a JPEG, quita EXIF y ubicación. Máx. 20 MB antes de reducir.
- Límites: 10 por evento, 300 por usuario y 800 MB en total. Galería y visor a pantalla completa.

### 🔄 Eventos recurrentes

- Repetir con opciones rápidas calculadas con la fecha y editor personalizado (RRULE).
- Una serie es una fila; las repeticiones se expanden al leer con `ical.js`.
- Alcance al guardar o borrar: "Solo este evento", "Este y los siguientes" y "Todos los eventos".
- Convertir suelto a serie y viceversa.

### 💬 Comentarios en eventos

- Cualquier miembro, Lectores incluidos, puede comentar. Carga después de abrir el detalle, 50 más recientes, "Ver anteriores".
- Edición y borrado con permisos, actualización cada 20 s con el detalle abierto.

### 🤖 Venito, el asistente de chat

- **Venito** es la mascota de CaFam (una morsa con gafas, en SVG propio con seis expresiones). Su botón flotante abre el chat como un panel en cualquier pantalla; `/dashboard/assistant` lo muestra a página completa.
- Conversación con burbujas, "escribiendo…" con el paso real (respuesta en streaming) y sugerencias según el contexto.
- Herramientas de lectura (`list_events`, `search_events`, `find_free_time`, `get_comments`) atadas a la sesión del usuario; los eventos citados abren su detalle.
- **Crear y cambiar eventos (spec 036):** "Crea Comida Uni en el calendario X justo cuando acabe PIAE hasta las 14:30". El servidor busca el evento de referencia y el calendario por su nombre y calcula las horas. Crear es directo, con "Deshacer". Un cambio se muestra en una tarjeta y no se guarda hasta "Confirmar" (o "sí"). Nunca borra: lleva al evento. Como mucho 3 por mensaje, con los permisos del usuario y, en Google o iCloud, escribiendo primero allí.
- **Eventos desde una imagen:** adjunta hasta 3 fotos de un horario y Venito propone los eventos en una tarjeta editable; nada se crea hasta pulsar "Crear". Las imágenes no se guardan.
- Proveedor Groq (`openai/gpt-oss-120b`, con `qwen/qwen3.8-27b` de reserva y para las imágenes). Disponibilidad común calculada en TypeScript, solo con el consentimiento de cada persona. 30 preguntas al día por usuario.

### 📝 Notas y listas

- Sección **Notas** con listas de tareas y notas de texto, personales o compartidas con un calendario (con los roles de ese calendario).
- Cambios al instante con "Deshacer", búsqueda, fijar, archivar, fecha límite y tiempo real.

### 👀 Disponibilidad

- Con el consentimiento de cada persona, sus bloques "Ocupado" (sin título) se ven en las vistas de semana y día de quien comparte calendario con ella.

### ⚡ Tiempo real y experiencia de escritorio

- Cambios en eventos, calendarios o miembros notificados por Supabase Realtime al tema `user:<id>` de cada miembro.
- Tarjeta de detalle junto al evento desde 769 px, barra lateral plegable, ocultar fines de semana, duración de evento nuevo, tecla C.
- Bloque provisional en el móvil al arrastrar, detalle en hoja inferior, pellizcar para ampliar.
- Mover y redimensionar eventos arrastrando, menú contextual, "Deshacer" (también con Ctrl/⌘+Z) y atajos de teclado (? muestra la ayuda).

### 📴 Sin conexión

- Con red, la app guarda en el dispositivo (IndexedDB) los eventos de 1 mes atrás a 3 meses adelante y todas las notas, y la copia se renueva cada 15 minutos como mucho.
- Sin red, el service worker lleva a la app guardada: calendario, detalle de eventos y notas con los datos de la copia, con el indicador "Sin conexión · datos de las HH:MM".
- Los cambios hechos sin red (eventos de calendarios normales, solo "Solo este evento" en las series, notas y listas) se ven al instante con "Pendiente de enviar" y se envían en orden al volver la red.
- Si otra persona cambió lo mismo, la hoja "Cambios" enseña las dos versiones y el usuario elige; lo que el servidor rechaza queda en "Cambios no enviados".
- Cerrar sesión, borrar la cuenta o entrar con otra cuenta borra los datos del dispositivo.

### 🎨 Identidad visual "Nexo"

- Fondo lavanda, acento violeta con degradado (u otro de seis a elegir), tipografía Inter, tema claro, oscuro o como el sistema.
- En el móvil, navegación en píldora flotante abajo con "+" y Venito; en el escritorio, pestañas arriba.
- Movimiento con intención y versión reducida con `prefers-reduced-motion`.

---

## 🛠️ Tecnología y stack

| Capa         | Tecnología                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------- |
| Lenguaje     | TypeScript 5 `strict`, sin `any` explícito (ESLint en error)                                |
| Framework    | Next.js 16.4.6 (App Router, Turbopack, Server Components, Server Actions), React 19.3       |
| Estilos      | Tailwind CSS 4 vía `@tailwindcss/postcss`                                                   |
| Datos y auth | Supabase Free: PostgreSQL 17 con RLS + Supabase Auth (email/contraseña) con `@supabase/ssr` |
| Validación   | zod 4                                                                                       |
| Hosting      | Vercel Hobby, repositorio en GitHub                                                         |
| PWA          | `src/app/manifest.ts` nativo + service worker propio en `public/sw.js`                      |
| Tests        | Vitest 5 (proyectos `unit` con jsdom y `db` con node), Testing Library                      |
| Calidad      | ESLint 9, Prettier 3                                                                        |
| BD           | Supabase CLI para migraciones y tipos                                                       |

**Dependencias de producción:** `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `ical.js` (2.2.1) y `tsdav` (2.5.0 exacta).

---

## 📁 Estructura del repositorio

```
.
├── AGENTS.md                  # guía para agentes (se importa en CLAUDE.md)
├── CLAUDE.md                  # contexto del proyecto para Claude
├── README.md                  # este archivo
├── docs/constitution.md       # principios, stack, convenciones, verificación
├── specs/NNN-nombre/          # spec.md, plan.md, tasks.md de cada spec
├── src/
│   ├── proxy.ts               # "middleware" de Next 16: refresca sesión y aplica getRouteAccess
│   ├── app/                   # rutas de la aplicación
│   │   ├── layout.tsx         # marco de la app, metadata, ServiceWorkerRegister
│   │   ├── globals.css        # tokens de diseño y seis [data-accent]
│   │   ├── page.tsx           # portada pública
│   │   ├── manifest.ts        # /manifest.webmanifest
│   │   ├── (auth)/            # auth sin segmento de URL
│   │   ├── dashboard/         # marco con acento + slot modal; protegido por getRouteAccess
│   │   │   ├── calendar/      # vistas agenda/año/mes/semana/4 días/día
│   │   │   ├── calendars/     # "Mis calendarios", crear, editar, categorías, juntar
│   │   │   ├── events/        # alta y detalle de eventos
│   │   │   ├── settings/      # Ajustes
│   │   │   ├── connections/   # cuentas de Google e iCloud
│   │   │   ├── assistant/     # asistente de chat a página completa
│   │   │   ├── notes/         # notas y listas
│   │   │   ├── join/          # "Unirme con código"
│   │   │   └── import/        # "Importar calendario" (.ics)
│   │   ├── invite/[token]/    # vista previa y unión por token
│   │   ├── offline/           # la app sin conexión con la copia del dispositivo (spec 034)
│   │   └── api/               # OAuth, sincronización, imágenes, asistente, keep-alive
│   ├── components/            # componentes React (ui, shell, brand con Venito, calendar, groups, notes, assistant…)
│   └── lib/                   # lógica pura, consultas, utilidades, auth, calendar, theme…
├── public/
│   ├── sw.js                  # service worker propio
│   └── icons/                 # iconos de la PWA
├── supabase/
│   ├── config.toml
│   └── migrations/            # migraciones SQL con fecha (hasta las de notas, spec 028)
├── tests/
│   ├── unit/                  # tests unitarios (jsdom)
│   ├── integration/           # tests de integración contra Supabase dev
│   └── fixtures/              # .ics, respuestas de Google y horarios sintéticos
├── scripts/                   # capturas, recorrido en móvil, iconos y medición de rendimiento (perf/)
├── vercel.json                # cron y configuración de Vercel
├── package.json
└── .env.example               # variables documentadas sin valores
```

---

## 🔄 Cómo funciona (flujo de usuario)

1. **Registro e inicio de sesión:** email y contraseña, sin verificación de email obligatoria. Al registrarse se crea el perfil y "Mi calendario".
2. **Panel de calendarios:** el usuario ve sus calendarios en el orden guardado, con acceso a crear, editar, categorías y juntar.
3. **Crear eventos:** desde la ventana de evento, la agenda, la tecla N o C, o arrastrando un hueco en la rejilla.
4. **Compartir:** por enlace (con rol, usos y caducidad) o por ID y PIN. Los miembros pueden unirse con código.
5. **Importar:** subir un `.ics` o indicar un enlace para crear un calendario nuevo.
6. **Sincronizar:** conectar cuentas de Google o iCloud para traer calendarios y mantenerlos actualizados.
7. **Venito:** preguntar en lenguaje natural sobre eventos y disponibilidad común, o pasarle la foto de un horario.
8. **Notas:** listas de la compra o de tareas, solas o compartidas con un calendario.
9. **Tiempo real:** los cambios de otros miembros se reflejan al instante en la pestaña visible.

---

## 🛣️ Rutas principales

| Ruta                                | Acceso                      | Contenido                                                               |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `/`                                 | pública                     | Portada; con sesión redirige a `/dashboard/calendar`                    |
| `/signup`, `/login`                 | solo sin sesión             | Formularios de registro y login                                         |
| `/dashboard`                        | con sesión                  | Redirige al calendario                                                  |
| `/dashboard/calendar`               | con sesión                  | Vistas agenda/año/mes/semana/4 días/día                                 |
| `/dashboard/calendars`              | con sesión                  | "Mis calendarios"                                                       |
| `/dashboard/settings`               | con sesión                  | Ajustes: acento, perfil, email, contraseña, borrar cuenta               |
| `/dashboard/events/new`             | con sesión                  | Alta de evento                                                          |
| `/dashboard/events/[id]`            | con sesión                  | Detalle con editar, duplicar y borrar                                   |
| `/dashboard/calendars/[id]/share`   | solo propietario            | Invitaciones por enlace e ID/PIN                                        |
| `/dashboard/calendars/[id]/members` | cualquier miembro           | Lista de miembros                                                       |
| `/dashboard/join`                   | con sesión                  | Unirme con ID y PIN                                                     |
| `/dashboard/import`                 | con sesión                  | Importar `.ics` a un calendario nuevo o existente, y mantenerlo al día  |
| `/dashboard/connections`            | con sesión                  | Cuentas de Google e iCloud conectadas                                   |
| `/dashboard/assistant`              | con sesión                  | Chat de Venito a página completa                                        |
| `/dashboard/notes`, `/new`, `/[id]` | con sesión                  | Notas y listas                                                          |
| `/invite/[token]`                   | pública/privada             | Vista previa y unión por token                                          |
| `/offline`                          | pública                     | La app sin conexión con la copia (`?from=`), o "Sin conexión" sin copia |
| `/privacy`                          | pública                     | Política de privacidad                                                  |
| `/api/ics/export`                   | con sesión                  | Descargar un calendario o los visibles como `.ics`                      |
| `/api/ics/[token].ics`              | pública (token secreto)     | Suscripción de solo lectura a un calendario                             |
| `/api/ics/refresh`                  | `Bearer CRON_SECRET` (POST) | Actualiza los calendarios importados desde su enlace                    |
| `/api/assistant`                    | con sesión (POST)           | Pregunta al asistente (respuesta en streaming NDJSON)                   |
| `/api/sync/google-push`             | pública (POST)              | Avisos de cambios de Google                                             |
| `/api/sync/run`                     | Bearer `CRON_SECRET` (POST) | Ejecutar sincronización                                                 |
| `/api/images/purge`                 | Bearer `CRON_SECRET` (POST) | Borrar imágenes de la cola de purga                                     |
| `/api/push/run`                     | Bearer `CRON_SECRET` (POST) | Enviar los recordatorios y avisos push pendientes                       |
| `/api/cron/keep-alive`              | Bearer `CRON_SECRET`        | Mantener Supabase activo                                                |

---

## 💻 Instalación y desarrollo

### Requisitos previos

- Node.js 24
- npm (gestor de paquetes único permitido en el proyecto)
- Cuenta de Supabase (proyecto dev y prod), o Docker para un Supabase local (`npx supabase start`)
- Cuenta de Vercel (para despliegue)

### Comandos disponibles

```bash
# Servidor de desarrollo en http://localhost:3000
npm run dev

# Build de producción y arranque
npm run build && npm start

# Verificación de tipos
npm run typecheck

# Linting
npm run lint

# Formato de código
npm run format          # prettier --write .
npm run format:check

# Tests unitarios
npm test                # vitest proyecto unit (jsdom)
npm test -- <filtro>    # filtrar tests

# Tests de integración contra Supabase dev
npm run test:db
npm run test:db -- <filtro>

# Aplicar migraciones al proyecto enlazado (dev)
npm run db:push

# Regenerar tipos de Supabase
npm run db:types

# Evaluación del asistente (39 preguntas a Groq, ~10 min, gasta cuota)
npm run eval:assistant

# Evaluación de eventos desde imagen (12 horarios sintéticos, ~12 min, gasta cuota)
npm run eval:schedule
```

> Los usuarios de prueba usan el dominio `@cafam.test`.

### Enlaces de OAuth de Google

- En dev: `http://localhost:3000/api/oauth/google/callback` (única URI registrada).
- En producción: URI de retorno de producción en la consola de Google Cloud.

---

## 🔐 Variables de entorno

| Variable                                   | Dónde                                   | Notas                                                     |
| ------------------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | `.env.local`, `.env.test.local`, Vercel | Pública                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`     | `.env.local`, `.env.test.local`, Vercel | Pública (`sb_publishable_…`)                              |
| `CRON_SECRET`                              | Vercel, `.env.local`, `.env.test.local` | Secreto del servidor. Debe igualar `cron_secret` en Vault |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `.env.local`, Vercel                    | Cliente OAuth de Google, solo servidor                    |
| `GROQ_API_KEY`                             | `.env.local`, `.env.test.local`, Vercel | Clave de Groq del asistente, solo servidor                |
| `SYNC_PUSH_URL`                            | Solo Vercel (Production)                | Dirección de los avisos de Google, solo servidor          |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`             | `.env.local`, Vercel                    | Clave pública VAPID de los avisos push                    |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`       | `.env.local`, Vercel                    | Clave privada VAPID y contacto (`mailto:`), solo servidor |
| `SUPABASE_SECRET_KEY`                      | **Solo `.env.test.local`**              | Nunca en Vercel ni en `src/`                              |

`.env.local` y `.env.test.local` apuntan a **dev** y están ignorados por git.

---

## 🗄️ Base de datos y migraciones

Todas las tablas de `public` tienen **RLS (Row Level Security)**. La base de datos es la frontera de seguridad; el código nunca decide permisos por sí solo.

Las migraciones viven en `supabase/migrations/` y son numeradas. Los cambios de esquema solo se hacen mediante una migración nueva (nunca editando migraciones ya aplicadas).

Luego de aplicar migraciones:

```bash
npm run db:push   # dev
npm run db:types  # regenera src/types/database.ts
npm run test:db   # obligatorio si toca esquema, RLS o acceso a datos
```

**Entornos de Supabase:**

| Entorno | Proyecto          | Ref                    | Región    |
| ------- | ----------------- | ---------------------- | --------- |
| dev     | `calendario-dev`  | `uthubyzhonrtrmbcqcjh` | eu-west-1 |
| prod    | `calendario-prod` | `yznbdoskvtxeasujtirk` | eu-west-1 |

**Migraciones a producción** (lo ejecuta el usuario):

```bash
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh   # volver a dev inmediatamente
```

---

## ✅ Pruebas y calidad de código

Ninguna tarea se da por hecha sin ejecutar y reportar la salida de:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
npm run test:db   # obligatorio si la tarea toca esquema, RLS o acceso a datos
```

Además, se requiere una prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz.

### Convenciones de commits

Conventional Commits en español con la tarea:

```
feat: registro de usuario (T7)
```

### Reglas de identidad visual (P9)

- Solo tokens (`bg-paper`, `text-muted`, `bg-accent`…); nada de `bg-white`, colores de Tailwind ni hex en clases.
- Nunca `text-white`, `text-black` ni la variante `dark:`.
- Identidad **Nexo** (enmienda 11 de la constitución): tipografía Inter, radios y elevaciones como tokens, sin `backdrop-filter`.
- Solo componentes de `components/ui` (`Button`, `IconButton`, `Card`, `Chip`, `Sheet`, `EmptyState`…).
- Colores de calendario como relleno de los bloques de evento y, fuera de ellos, solo como marca.
- Capturas a 390, 768 y 1440 px, en claro y oscuro, antes de cerrar una tarea de interfaz.

---

## 📱 PWA y despliegue

### PWA

- Manifest nativo en `src/app/manifest.ts` con nombre CaFam, color lavanda `#F3F2FA`, iconos 192, 512 y 512 maskable.
- iOS: `appleWebApp` + `apple-touch-icon`. Ayuda de instalación solo en Safari iOS.
- Service worker propio en `public/sw.js`:
  - Precachea `/offline`, iconos y estáticos de `/_next/static/`.
  - Navegaciones: red primero; sin red, `/dashboard/...` lleva a `/offline?from=...`, que abre la app con la copia del dispositivo (spec 034).
  - Caché primero para `/_next/static/` e `/icons/`.
  - **Nunca cachea HTML con sesión ni respuestas de Supabase.**
  - Si cambias `sw.js` o los iconos, sube `CACHE_NAME` (`cafam-vN`; ahora `cafam-v8`).

### Despliegue

- Vercel despliega a producción cada push a `main` y hace previews de las demás ramas.
- Se trabaja en una rama por spec y se integra con `git merge --ff-only`.
- `main` debe estar siempre desplegable.
- Las funciones de Vercel corren en **Dublín (`dub1`)**, junto a Supabase `eu-west-1`.

---

## 🔒 Seguridad y privacidad

- **Privado por defecto (P3):** toda tabla de `public` tiene RLS.
- **Secretos solo en el servidor (P4):** `SUPABASE_SECRET_KEY` y `CRON_SECRET` nunca llevan prefijo `NEXT_PUBLIC_`, nunca se importan en `src/` ni se suben a git.
- **Stack cerrado (P6):** solo las dependencias permitidas. Cualquier otra exige aprobación del usuario registrada en la spec.
- **Prohibido:** servicios de pago, SDK de analítica/tracking/telemetría, librerías PWA de terceros, ORMs, backends paralelos.
- El asistente usa Groq con retención cero activada y no entrena con los datos.
- Las imágenes de eventos nunca se envían a Google ni iCloud.
- Las imágenes adjuntas al asistente viajan en la petición y no se guardan.
- `npm audit` sin vulnerabilidades conocidas (spec 033).
- Cabeceras de seguridad (`frame-ancestors`, `nosniff`, `noindex`) en todas las rutas.
- Política de privacidad pública en `/privacy`, con qué guarda la app en el dispositivo y cuándo lo borra.
- La copia sin conexión nunca incluye imágenes, comentarios, conversaciones del asistente, "Ocupado" de otros, emails ni credenciales, y cada cambio enviado se comprueba de nuevo con RLS.

---

## 🗺️ Hoja de ruta: specs pendientes y futuro

El proyecto **aún no está terminado**. Existen specs pendientes y funcionalidades planificadas para versiones futuras:

- Verificación de email en el registro.
- Traspaso voluntario de calendarios.
- Exportar los datos de la cuenta.
- Login social.
- Microsoft (quedó fuera en la Enmienda 1).
- i18n (internacionalización).

> No se implementa nada de esto sin su spec aprobada.

---

## 🚫 Fuera de alcance

Hasta que exista su spec aprobada:

- Verificación de email en el registro, traspaso voluntario de calendarios, exportar datos de la cuenta, login social, Microsoft, i18n.
- Sin conexión: envío en segundo plano, fechas fuera del rango guardado, series enteras, calendarios traídos, imágenes y comentarios (el resto, en "Fuera de alcance" de la spec 034).
- Cambiar eventos desde el asistente (salvo crearlos desde una imagen), guardar conversaciones o responder por voz (necesitan otra spec).
- En notas: fecha límite por elemento, reordenar arrastrando, vencimientos en el calendario, notas de un evento y notas desde el asistente.

---

## 📄 Licencia

**CaFam** se distribuye bajo la **GNU General Public License v3.0 (GPL-3.0)**.

Este es un software de código abierto y copyleft: puedes usarlo, estudiarlo, modificarlo y distribuirlo libremente, siempre que cualquier obra derivada también se libere bajo los mismos términos y se ponga el código fuente a disposición de quienes lo reciban. Consulta el archivo [LICENSE](LICENSE) para conocer los términos completos.

Puntos clave de GPL-3.0:

- ✅ Uso gratuito, también comercial.
- ✅ Libertad de modificar y distribuir el código.
- ✅ Los trabajos derivados deben conservar la misma licencia (copyleft).
- ✅ Concesión explícita de derechos de patente.
- ❌ No permite incorporar el código en programas propietarios sin liberar el código fuente.
- ⚠️ No incluye garantía de ningún tipo (se proporciona "tal cual").

Este proyecto es de uso estrictamente personal entre familia y amigos, sin ánimo de lucro, sin publicidad ni analítica.

---

<div align="center">

**CaFam** — Tu calendario compartido, hecho con ❤️.

[Producción](https://calendario-familia-five.vercel.app) · [Repositorio](https://github.com/alexp11mon/CaFam) · [Política de privacidad](/privacy)

</div>
