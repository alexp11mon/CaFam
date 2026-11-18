# Plan 052 — Asistente: borrar, crear series, conversaciones guardadas y voz

Spec: `specs/052-asistente-borrar-series-memoria-y-voz/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18). Depende de la 046 (papelera).

## Resumen de arquitectura

- **Herramientas**: `propose_deletes` (1–3 eventos por nombre y día, alcance opcional) y `propose_series` (título, calendario, hora, duración, `freq`, `interval`, `byDay`, `until`, `count`). Se ofrecen con `wantsWrite`, cuyo vocabulario gana los verbos de borrar y de repetir. Ninguna escribe: devuelven una acción `change` con `kind: "delete" | "series"` y su `PendingChange`.
- **Confirmar**: `confirmChange` (036) gana los dos tipos: borrar llama a `deleteSingle`/`planSeriesDelete` con `snapshot_event` (papelera 046) y devuelve la ficha de deshacer; crear serie llama al alta normal con `repeat=custom:<RRULE>` construida con `ruleToRrule` (`lib/recurrence/rule.ts`).
- **Historial**: tabla `assistant_conversations` y acciones `saveConversation`, `listConversations`, `loadConversation`, `deleteConversation(s)`; `AssistantChat` guarda tras cada `done` si el ajuste está activo (`profiles.save_chats`).
- **Voz**: `lib/speech/` detecta y envuelve las APIs del navegador; `MicButton` y `useSpeakAnswers` en el chat.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `src/lib/assistant/write-intent.ts`, `schemas.ts`, `tool-definitions.ts`, `prompt.ts`, `actions.ts` | Verbos, esquemas, definiciones, reglas del prompt ("borrar siempre se confirma") y `describeAction` (RF-1, RF-5) |
| `src/app/dashboard/assistant/assistant-writes.ts`, `change-writes.ts`, `write-actions.ts` | Proponer y confirmar borrados y series (RF-2, RF-3, RF-6, RF-7) |
| `src/lib/recurrence/rule.ts` | `ruleFromFields` validado (RF-5) |
| `src/components/assistant/action-card.tsx` | Tarjetas de borrar (alcance y pérdida) y de serie (resumen y 3 fechas) |
| `supabase/migrations/20261203100000_assistant_conversations.sql` | Tabla, RLS, `profiles.save_chats`, `pg_cron` de caducidad y tope de 50 (trigger) |
| `src/app/dashboard/assistant/conversation-actions.ts`, `src/components/assistant/conversation-list.tsx`, `chat-menu.tsx` | RF-9 a RF-12 |
| `src/lib/speech/recognition.ts`, `synthesis.ts`, `src/components/assistant/mic-button.tsx`, `src/lib/hooks/use-speak-answers.ts` | RF-13 a RF-15 |
| `tests/assistant-eval/write-questions.ts` | RF-16 |
| `src/app/privacy/page.tsx` | Secciones |

## Modelo de datos

- `assistant_conversations (id, user_id default auth.uid() → profiles cascade, title text (≤ 100), messages jsonb (≤ 200 KB, check), created_at, updated_at)`. RLS: el usuario lee, inserta, actualiza y borra las suyas. Trigger: al insertar la 51.ª, borra la más antigua. `pg_cron` borra las de más de 90 días.
- `profiles.save_chats boolean default false`.

## Decisiones

- D1: Borrar siempre se confirma (RF-1), aunque crear un suelto no: deshacer existe, pero un borrado de serie entera es demasiado caro si el modelo entiende mal.
- D2: Reglas por campos y no RRULE del modelo (RF-5): el servidor ya sabe escribir reglas válidas (013) y así no hay inyección de reglas arbitrarias.
- D3: Historial opcional y desactivado por defecto: la 015 prometió "la conversación no se guarda"; se mantiene para quien no lo active (privacidad, P3).
- D4: Voz en el navegador (Web Speech API): coste cero y sin enviar audio a nuestro servidor; se avisa de que el navegador puede usar un servicio de su fabricante (RF-15).
- D5: Lectura en voz alta recordada en el dispositivo (`localStorage` `cafam-speak`), porque depende del sitio y del momento.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

## Riesgos

- La cuota de Groq (trampa conocida): el eval se lanza una sola vez y con `EVAL_ONLY` para las peticiones nuevas.
