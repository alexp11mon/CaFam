# Spec 041 — Alta de eventos en lenguaje natural

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Crear un evento exige rellenar título, día, horas y calendario por separado. Venito (036) ya crea eventos hablando, pero gasta cuota de Groq y no funciona sin conexión. La hoja de ruta pide un alta en lenguaje natural **sin IA ni coste**.

## Objetivo

Un analizador propio, puro y muy probado en español que convierte una frase en un evento, con vista previa en vivo en el alta rápida y en "+", y que funcione también sin conexión.

## Requisitos funcionales

### Qué entiende

- RF-1: **Fechas relativas**: "hoy", "mañana", "pasado mañana", "ayer" (con aviso de que es pasado), "esta noche", "este fin de semana" (sábado), "dentro de 3 días", "en 2 semanas".
- RF-2: **Días de la semana**: "el jueves", "jueves", "el próximo lunes", "el lunes que viene" (siguiente aparición; si es hoy, la de la semana siguiente salvo con "hoy"), abreviados ("jue", "vie").
- RF-3: **Fechas**: "el 20", "20 de noviembre", "20/11", "20-11-2027", "el 3 de enero de 2027". Sin año: la próxima aparición.
- RF-4: **Horas**: "a las 21", "21:30", "21h", "9 de la noche", "9 y media", "a las 10 y cuarto", "menos cuarto", "a mediodía" (12:00), "por la mañana" (9:00), "por la tarde" (17:00), "por la noche" (21:00), "9pm"/"9 am".
- RF-5: **Fin y duración**: "de 10 a 12", "10-12", "hasta las 14", "1h", "1 h 30", "90 min", "media hora", "2 horas". Sin duración, la de Ajustes (spec 019).
- RF-6: **Todo el día**: "todo el día", "día completo"; una fecha sin hora es de día completo. "del 3 al 5 de diciembre" es de varios días.
- RF-7: **Lugar**: lo que sigue a " en " al final ("en Calle Mayor 3", "en casa de Ana") cuando no es una expresión de tiempo ("en 2 semanas").
- RF-8: **Calendario**: "@nombre" con la misma coincidencia que `matchCalendar` (sin tildes, parcial); si es ambiguo o de solo lectura, se avisa y se usa el elegido.
- RF-9: **Título**: lo que queda tras quitar lo reconocido, sin preposiciones sueltas al principio o final ("Cena con Ana", con mayúscula inicial). Vacío → "Sin título" deshabilitado para guardar.
- RF-10: **Repetición sencilla**: "cada lunes", "todos los días", "cada semana", "cada mes" se proponen como regla de "Repetir" (013) en el formulario; no en calendarios traídos.

### Dónde se usa

- RF-11: En `QuickCreate` (alta rápida) y en el formulario de alta completa, un campo "Escribe el evento" encima del título. Mientras se escribe (sin esperas), una **vista previa** debajo: "Jueves 20 de noviembre · 10:30–11:30 · Calle Mayor · @Familia", y las partes reconocidas se resaltan en el texto.
- RF-12: "Aplicar" (o Intro) rellena los campos del formulario (título, fechas, horas, todo el día, lugar, calendario, repetición) que siguen siendo editables. Los campos tocados a mano después no se pisan si se vuelve a escribir.
- RF-13: En el móvil, "+" abre el alta con el campo de frase enfocado; en escritorio, la tecla N también.
- RF-14: Funciona sin conexión (es puro): en la app sin red el alta usa la misma vista previa.
- RF-15: Ambigüedades: "el 1/2" se interpreta como 1 de febrero (formato español); una hora sin "de la tarde" entre 1 y 7 se interpreta como de la tarde (13–19 h) salvo con "de la mañana"; se muestra en la vista previa para que se vea.

## Requisitos no funcionales

- RNF-1: Puro, sin dependencias, menos de 1 ms por frase.
- RNF-2: Más de 150 frases de prueba con su resultado esperado, incluidas las de este documento y las de los alrededores del cambio de hora.
- RNF-3: Accesible: la vista previa en una región `aria-live="polite"` y el resaltado no depende solo del color (subrayado).

## Fuera de alcance

- Otros idiomas, invitados, recordatorios en la frase ("avísame"), reglas de repetición complejas.
- Usar la frase en Venito (ya tiene su propio flujo).

## Riesgos

- El español coloquial es amplio: se prioriza no equivocarse (si no se entiende algo, se queda en el título) sobre entender todo.

## Criterios de finalización

- Batería de frases en verde; prueba en el navegador a 390 y 1440 px; P8 en verde; AGENTS.md, README y constitución actualizados.

## Dudas abiertas

Ninguna.
