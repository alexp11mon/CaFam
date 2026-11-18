# Spec 047 — Compartir e integrar con el sistema

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

CaFam es una PWA instalable, pero no se integra con el sistema: no se puede compartir un evento a WhatsApp, ni enviar a CaFam un `.ics` o una foto desde otra app, ni hay accesos directos en el icono. Está en la hoja de ruta de la constitución.

## Objetivo

Compartir un evento con la Web Share API, recibir `.ics` e imágenes compartidas (Web Share Target), accesos directos del icono (`shortcuts`) y el número de eventos de hoy en el icono (Badging API), todo con APIs nativas y sin coste.

## Requisitos funcionales

### Compartir un evento

- RF-1: En el detalle (ventana, hoja y tarjeta), "Compartir" abre la hoja del sistema (`navigator.share`) con el texto "Cena con Ana · jueves 20 de noviembre, 21:00–23:00 · Casa de Ana" y, si el navegador admite archivos (`navigator.canShare({files})`), el `.ics` del evento adjunto (`cena-con-ana.ics`, escrito con `write-ics` de la 043).
- RF-2: Sin Web Share (escritorio sin soporte), "Compartir" abre un menú con "Copiar texto", "Copiar enlace" y "Descargar .ics".
- RF-3: El enlace es la URL del detalle en CaFam (`/dashboard/events/<id>`): solo lo abre quien es miembro (RLS); los demás ven "No encontramos esta página". Se avisa en el menú: "El enlace solo funciona para quien ya comparte el calendario".
- RF-4: Cualquier miembro puede compartir (Lectores incluidos). No se comparten imágenes ni comentarios.

### Recibir lo compartido (share target)

- RF-5: El manifest declara `share_target` (`POST`, `multipart/form-data`) para archivos `text/calendar` (`.ics`) e imágenes (`image/*`), y texto y URLs.
- RF-6: Un `.ics` compartido abre `/dashboard/import` con el archivo ya cargado y el destino por elegir (044); nada se importa sin pulsar "Importar".
- RF-7: Una o varias imágenes (hasta 3) abren una hoja "¿Qué hago con esta imagen?": "Preguntar a Venito" (abre el chat con las imágenes adjuntas, flujo de la 022) o "Añadir a un evento" (buscador de eventos de la 039 → se suben al evento elegido, 012).
- RF-8: Un texto o URL compartidos abren el alta en lenguaje natural (041) con el texto en el campo de frase.
- RF-9: Sin sesión, se pide iniciar sesión y después se continúa con lo compartido (guardado temporalmente en el dispositivo, nunca en el servidor).
- RF-10: El service worker recibe el `POST`, guarda los archivos en IndexedDB (`cafam-share`, borrados al usarse o tras 10 minutos) y redirige con `303` a `/dashboard/share?id=<uuid>`, que los lee y decide.

### Icono

- RF-11: `shortcuts` del manifest: "Nuevo evento" (`/dashboard/events/new`), "Hoy" (`/dashboard/calendar?view=day`), "Notas" (`/dashboard/notes`) y "Preguntar a Venito" (`/dashboard/assistant`), con iconos propios de 96 px.
- RF-12: Con la app abierta y la Badging API disponible, el icono muestra cuántos eventos con hora quedan hoy (de los calendarios visibles) y se limpia a medianoche o si son 0. Se puede desactivar en Ajustes ("Número de eventos de hoy en el icono", activado por defecto).
- RF-13: Con avisos push activos (040), al recibir un aviso el service worker actualiza el número (`setAppBadge`) si el aviso lo trae.

## Requisitos no funcionales

- RNF-1: Sin dependencias; detección de cada API y degradación limpia (iOS no admite `share_target`; se documenta).
- RNF-2: `CACHE_NAME` sube (cambian `sw.js` y los iconos).
- RNF-3: Identidad Nexo y capturas de la hoja de compartir recibido y del menú de compartir.

## Fuera de alcance

- Enlaces públicos de un evento para personas que no son miembros.
- Widgets del sistema, integración con contactos.

## Riesgos

- iOS Safari no admite Web Share Target ni Badging fuera de PWA instalada con avisos: solo funcionan compartir (RF-1) y los accesos directos no existen en iOS. Se explica en AGENTS.md.

## Criterios de finalización

- Tests unitarios (texto compartido, `.ics` de un evento, detección de APIs, recepción en el service worker con `vm`) y prueba en Chrome/Edge de escritorio (`share_target` probado con la página de prueba del navegador o Android si hay dispositivo; si no, queda para el usuario).
- P8 en verde; AGENTS.md, README y constitución actualizados.

## Dudas abiertas

Ninguna.
