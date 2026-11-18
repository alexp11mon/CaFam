# Spec 052 — Asistente: borrar, crear series, conversaciones guardadas y voz

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Venito (015, 027, 036) consulta, crea eventos sueltos y propone cambios que se confirman. AGENTS.md §11 deja para otra spec: borrar eventos, crear series, guardar conversaciones y responder por voz. La cuota de Groq es limitada y compartida (200K tokens al día por modelo).

## Objetivo

Que Venito pueda borrar y crear series con la misma seguridad de la 036, que el usuario pueda guardar (si quiere) sus conversaciones y que pueda hablarle y oírle con la Web Speech API, sin coste.

## Requisitos funcionales

### Borrar

- RF-1: Con un verbo de borrar ("borra", "elimina", "cancela", "quita") en el mensaje del usuario, Venito puede **proponer** borrar de 1 a 3 eventos; nunca borra sin confirmar.
- RF-2: La tarjeta muestra el evento (título, fecha, calendario) con "Borrar" y "Cancelar", y en una repetición el alcance ("Solo este", "Este y los siguientes", "Toda la serie") con la pérdida ("Se perderán 3 imágenes y 2 comentarios", 013). "sí"/"no" confirman o cancelan como en la 036.
- RF-3: El borrado confirmado pasa por la papelera (046) y ofrece "Deshacer"; en un calendario traído escribe primero en el proveedor.
- RF-4: Sin permiso (Lector) o en solo lectura, Venito lo explica sin tarjeta.

### Crear series

- RF-5: "Cada martes a las 18 inglés hasta junio", "todos los días laborables gimnasio a las 7" crean una **serie** (013) con la regla que el servidor construye a partir de campos estructurados (`freq`, `interval`, `byDay`, `until`, `count`) con `rule.ts`, nunca con una RRULE escrita por el modelo.
- RF-6: Crear una serie también se **confirma** con una tarjeta que dice la regla en español (resumen de `summary.ts`) y las 3 primeras fechas; no se crea al momento como un suelto.
- RF-7: No se crean series en calendarios traídos (como en la interfaz, 013); Venito lo explica.
- RF-8: Cambiar la regla de una serie existente queda fuera (se hace desde el formulario).

### Conversaciones guardadas

- RF-9: En el panel del chat, un interruptor "Guardar conversaciones" (desactivado por defecto) en el menú "⋯". Activado, cada conversación se guarda al recibir cada respuesta.
- RF-10: "Conversaciones" lista las guardadas (título = primera pregunta, fecha), abre una para seguirla y borra una o todas. Se guardan 50 como mucho (la más antigua sale) y caducan a los 90 días.
- RF-11: Solo su autor las ve (RLS). No se guardan las imágenes (solo "1 imagen adjunta"), ni las acciones pendientes (al abrirla, las tarjetas pendientes aparecen como "Caducada").
- RF-12: Desactivar el interruptor pregunta si borrar las guardadas. Borrar la cuenta las borra. `/privacy` lo explica.

### Voz

- RF-13: Botón de micrófono en la barra de entrada si el navegador tiene reconocimiento de voz (`SpeechRecognition`/`webkitSpeechRecognition`, `lang` `es-ES`): mantener o pulsar para dictar, con el texto en el campo mientras se habla y "Escuchando…"; no envía solo.
- RF-14: "Leer respuestas en voz alta" (interruptor en "⋯", desactivado por defecto, recordado en el dispositivo) lee cada respuesta con `speechSynthesis` (voz española si la hay), con un botón "Parar". Sin lectura de las tarjetas, solo el texto.
- RF-15: Sin soporte, los botones no aparecen. Se avisa de que en algunos navegadores el reconocimiento lo hace un servicio del fabricante (Google en Chrome, Apple en Safari): texto en `/privacy` y nota junto al micrófono la primera vez.

### Calidad

- RF-16: `eval:assistant` añade 8 peticiones de borrar y series a `write-questions.ts` y sigue exigiendo el 90 %; se lanza una vez por la cuota.

## Requisitos no funcionales

- RNF-1: Sin dependencias y coste cero (Web Speech API del navegador; Groq como hoy).
- RNF-2: Identidad Nexo, capturas y accesibilidad (micrófono con nombre y estado `aria-pressed`).

## Fuera de alcance

- Venito borrando sin confirmación, más de 3 a la vez, cambiar reglas de series, voz en el servidor.

## Riesgos

- Borrar es destructivo: siempre confirmación, papelera y "Deshacer".
- El modelo puede proponer una regla rara: el servidor la valida (`rule.ts`) y la tarjeta la enseña en español antes de crear.

## Criterios de finalización

- Tests unitarios de intención, esquemas, construcción de reglas, tarjetas, historial y voz (APIs simuladas); integración de borrar y series; eval con las peticiones nuevas.
- P8 en verde con `test:db`; AGENTS.md (§11), README, constitución y `/privacy` actualizados.

## Dudas abiertas

Ninguna.
