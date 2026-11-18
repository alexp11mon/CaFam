# Spec 046 — Papelera y deshacer de varias acciones

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Desde la 017, borrar un evento guarda una copia en `event_trash` (solo la última por usuario, restaurable durante 1 minuto) y el aviso ofrece "Deshacer" 10 s para la última acción (mover, redimensionar, color, borrar, pegar). La constitución deja fuera "deshacer más de una acción" y la hoja de ruta pide papelera. Un borrado accidental que se nota al día siguiente hoy no tiene arreglo.

## Objetivo

1. Una **papelera de 30 días por calendario**, donde Propietario y Editores ven, restauran o vacían los eventos borrados.
2. Una **pila de deshacer y rehacer** de la sesión con Ctrl/⌘+Z y Ctrl/⌘+Mayús+Z (y Ctrl+Y), además del botón del aviso.

## Requisitos funcionales

### Papelera

- RF-1: Todo borrado de un evento desde CaFam (detalle, tarjeta, menú, Supr, Venito no borra) guarda la copia (con imágenes y comentarios, como hoy) durante **30 días**, no solo la última.
- RF-2: Un borrado de serie entera, "este y los siguientes" o una repetición también se guarda: la serie como una entrada ("Clase de inglés · serie, 24 repeticiones"); una repetición como entrada que al restaurarse quita su fecha de `exdates`.
- RF-3: Pantalla "Papelera" (`/dashboard/trash`), en "Más" y en las opciones de cada calendario: lista agrupada por calendario, con título, fechas, quién lo borró y cuándo ("Borrado por Ana hace 2 días"), y "Quedan 28 días".
- RF-4: La ven el Propietario y los Editores de cada calendario (no los Lectores); cada uno ve la papelera de los calendarios donde tiene ese rol.
- RF-5: "Restaurar" vuelve a crear el evento con su id, imágenes y comentarios. Si el calendario es traído, se crea primero en Google o iCloud (como el "Deshacer" de la 017). Si la serie de una repetición ya no existe, no se puede restaurar y se explica.
- RF-6: "Borrar para siempre" (un elemento) y "Vaciar la papelera" (de un calendario, solo el Propietario) piden confirmación y no se pueden deshacer. Las imágenes se purgan entonces.
- RF-7: Pasados 30 días, `pg_cron` borra la copia y sus imágenes.
- RF-8: Los eventos que borra la **sincronización** (el proveedor los borró) no van a la papelera (se borraron fuera de CaFam). Los que borra un **juntar** o borrar el **calendario** tampoco (desaparece el calendario y su papelera).
- RF-9: Las imágenes de un evento en la papelera no cuentan en las cuotas de la 012 hasta que se restaura, pero tampoco se purgan mientras esté en la papelera.
- RF-10: Al salir de un calendario o perder el rol de Editor, se deja de ver su papelera.

### Deshacer y rehacer

- RF-11: Cada acción que hoy ofrece "Deshacer" se apila (como mucho 20) en la sesión de la pestaña: mover, redimensionar, color, borrar, pegar, duplicar, crear desde la ventana rápida y las creaciones y cambios confirmados de Venito.
- RF-12: Ctrl/⌘+Z deshace la última acción de la pila aunque el aviso ya no esté; Ctrl/⌘+Mayús+Z o Ctrl+Y la rehace. Nunca escribiendo en un campo ni con una ventana modal abierta. Un aviso confirma "Deshecho: mover «Dentista»" con "Rehacer".
- RF-13: Una acción no se deshace si el evento cambió después por otra persona (como hoy): se avisa "No se puede deshacer: alguien lo cambió" y se saca de la pila.
- RF-14: Deshacer un borrado usa la papelera (sin el límite de 1 minuto de la 017).
- RF-15: Los cambios a varias repeticiones (alcance "Todos" o "Este y los siguientes") se apilan pero su deshacer se ofrece solo si la serie no cambió entretanto; si no, se explica.
- RF-16: La pila se pierde al recargar o cerrar la pestaña (no se guarda); sin conexión, deshacer actúa sobre la cola (034) si el cambio aún no se envió.
- RF-17: La ayuda de atajos (?) muestra los dos atajos.

## Requisitos no funcionales

- RNF-1: Sin dependencias. Coste: la papelera ocupa filas JSON pequeñas; las imágenes siguen en Storage hasta 30 días (dentro de la cuota de 800 MB, que las cuenta como del usuario que las subió).
- RNF-2: Identidad Nexo, capturas y accesibilidad (lista navegable con teclado).

## Fuera de alcance

- Papelera de calendarios enteros, de notas o de comentarios.
- Deshacer entre dispositivos o tras recargar.

## Riesgos

- Mantener imágenes 30 días aumenta el uso de Storage; se acota con las cuotas y el vaciado.
- `restore_event` ya fue un fallo de seguridad (023): la versión nueva conserva la comprobación de `CF404`.

## Criterios de finalización

- Tests de integración de la papelera (roles, 30 días, series, traídos simulados, purga) y unitarios de la pila (deshacer, rehacer, conflicto, límite).
- Capturas y prueba en el navegador; P8 en verde con `test:db`; AGENTS.md, README y constitución (enmienda: deshacer más de una acción y Ctrl/⌘+Mayús+Z) actualizados.

## Dudas abiertas

Ninguna.
