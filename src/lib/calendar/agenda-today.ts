// "Hoy" while the agenda is open: the agenda scrolls to today if it has it
// loaded, or opens the agenda of today (spec 016 RF-10, RF-58). The header,
// the toolbar and the T key send it; AgendaView listens.
export const AGENDA_TODAY_EVENT = "cafam:agenda-today";

export function requestAgendaToday() {
  window.dispatchEvent(new Event(AGENDA_TODAY_EVENT));
}
