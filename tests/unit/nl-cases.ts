import type { ParsedEvent } from "@/lib/nl/parse";

// Spec 041 RNF-2: phrases with their expected parts. Today is Wednesday
// 18 November 2026. Only the fields given are checked.
export const TODAY = "2026-11-18";

export type NlCase = [string, Partial<Omit<ParsedEvent, "spans">>];

const HAND: NlCase[] = [
  // The examples of the spec.
  [
    "Cena con Ana el viernes a las 21 en casa @familia",
    {
      title: "Cena con Ana",
      date: "2026-11-20",
      start: "21:00",
      allDay: false,
      location: "casa",
      calendarHint: "familia",
    },
  ],
  [
    "Dentista jueves 10:30 en Calle Mayor 3",
    {
      title: "Dentista",
      date: "2026-11-19",
      start: "10:30",
      location: "Calle Mayor 3",
    },
  ],
  [
    "Revisión en 2 semanas",
    { title: "Revisión", date: "2026-12-02", location: null, allDay: true },
  ],
  [
    "Comida en casa de Ana el domingo a mediodía",
    {
      title: "Comida",
      date: "2026-11-22",
      start: "12:00",
      location: "casa de Ana",
    },
  ],
  [
    "Viaje a Roma del 3 al 5 de diciembre",
    {
      title: "Viaje a Roma",
      date: "2026-12-03",
      endDate: "2026-12-05",
      allDay: true,
    },
  ],
  [
    "Cumpleaños de Lucía 20/11",
    { title: "Cumpleaños de Lucía", date: "2026-11-20", allDay: true },
  ],
  [
    "Reunión de 10 a 12 mañana",
    { title: "Reunión", date: "2026-11-19", start: "10:00", end: "12:00" },
  ],
  [
    "Pádel el lunes que viene 19h 1h30",
    {
      title: "Pádel",
      date: "2026-11-23",
      start: "19:00",
      durationMinutes: 90,
    },
  ],
  [
    "Inglés cada lunes a las 18",
    { title: "Inglés", date: "2026-11-23", start: "18:00", repeat: "weekly" },
  ],
  [
    "Gimnasio todos los días a las 7 de la mañana",
    { title: "Gimnasio", date: null, start: "07:00", repeat: "daily" },
  ],
  [
    "Trabajo de lunes a viernes de 9 a 14",
    { title: "Trabajo", start: "09:00", end: "14:00", repeat: "weekdays" },
  ],
  [
    "Alquiler cada mes el 1",
    {
      title: "Alquiler",
      date: "2026-12-01",
      repeat: "monthly-day",
      allDay: true,
    },
  ],
  [
    "Aniversario cada año 3 de enero",
    { title: "Aniversario", date: "2027-01-03", repeat: "yearly" },
  ],
  [
    "Médico a las 5",
    { title: "Médico", start: "17:00", assumedAfternoon: true },
  ],
  ["Médico a las 5 de la tarde", { start: "17:00", assumedAfternoon: false }],
  ["Cena ayer", { title: "Cena", date: "2026-11-17", past: true }],
  [
    "Cena esta noche",
    { title: "Cena", date: "2026-11-18", start: "21:00", allDay: false },
  ],
  ["Paseo esta tarde", { title: "Paseo", start: "17:00" }],
  [
    "Boda todo el día el sábado",
    { title: "Boda", date: "2026-11-21", allDay: true, start: null },
  ],
  [
    "Mudanza día completo 5/12",
    { title: "Mudanza", date: "2026-12-05", allDay: true },
  ],
  [
    "Llamar a mamá",
    { title: "Llamar a mamá", date: null, start: null, allDay: false },
  ],
  ["", { title: "", date: null }],
  ["mañana a las 10", { title: "", date: "2026-11-19", start: "10:00" }],
  ["  cena   con   Ana  ", { title: "Cena con Ana" }],
  ["cena", { title: "Cena" }],
  [
    "Café con Luis @trabajo",
    { title: "Café con Luis", calendarHint: "trabajo" },
  ],
  ["Café @Mi-Trabajo mañana", { calendarHint: "Mi-Trabajo", title: "Café" }],
  [
    "Escribir a ana@correo.es",
    { calendarHint: null, title: "Escribir a ana@correo.es" },
  ],
  ["Cena en el bar en Madrid", { location: "el bar en Madrid", title: "Cena" }],
  ["En casa de Ana", { location: null, title: "Casa de Ana" }],
  [
    "Recoger el coche en el taller, a las 18",
    { title: "Recoger el coche", location: "el taller", start: "18:00" },
  ],
  [
    "Partido en el polideportivo mañana a las 20",
    {
      title: "Partido",
      location: "el polideportivo",
      date: "2026-11-19",
      start: "20:00",
    },
  ],
  [
    "Revisión dentro de 3 días en la ITV",
    { date: "2026-11-21", location: "la ITV", title: "Revisión" },
  ],
  [
    "Clase de piano el 25 a las 17:30 hasta las 18:15",
    {
      title: "Clase de piano",
      date: "2026-11-25",
      start: "17:30",
      end: "18:15",
    },
  ],
  [
    "Tutoría 26/11 de 4 a 5",
    {
      date: "2026-11-26",
      start: "16:00",
      end: "17:00",
      assumedAfternoon: true,
    },
  ],
  [
    "Taller el sábado por la mañana",
    { date: "2026-11-21", start: "09:00", title: "Taller" },
  ],
  ["Siesta por la tarde", { start: "17:00", date: null, title: "Siesta" }],
  [
    "Vuelo a Lisboa el 3 de enero de 2027 a las 6:45 de la mañana",
    { title: "Vuelo a Lisboa", date: "2027-01-03", start: "06:45" },
  ],
  [
    "Vacaciones del 28/12 al 2/1",
    {
      date: "2026-12-28",
      endDate: "2027-01-02",
      allDay: true,
      title: "Vacaciones",
    },
  ],
  [
    "Puente del viernes al domingo en la playa",
    {
      date: "2026-11-20",
      endDate: "2026-11-22",
      location: "la playa",
      title: "Puente",
    },
  ],
  [
    "Entrega del proyecto el viernes",
    { title: "Entrega del proyecto", date: "2026-11-20" },
  ],
  [
    "Fiesta a medianoche el 31 de diciembre",
    { date: "2026-12-31", start: "00:00", title: "Fiesta" },
  ],
  [
    "Llamada 15 min a las 11",
    { start: "11:00", durationMinutes: 15, title: "Llamada" },
  ],
  [
    "Llamada de media hora el jueves a las 9 y media",
    {
      start: "09:30",
      durationMinutes: 30,
      date: "2026-11-19",
      title: "Llamada",
    },
  ],
  [
    "Partido 2 horas el domingo a las 11",
    { start: "11:00", durationMinutes: 120, date: "2026-11-22" },
  ],
  [
    "Examen el 1/2 a las 9",
    { date: "2027-02-01", start: "09:00", title: "Examen" },
  ],
  ["Cine 9pm vie", { date: "2026-11-20", start: "21:00", title: "Cine" }],
  [
    "Desayuno 9 am mañana",
    { date: "2026-11-19", start: "09:00", title: "Desayuno" },
  ],
  [
    "Recoger a los niños a las 2",
    { start: "14:00", assumedAfternoon: true, title: "Recoger a los niños" },
  ],
  [
    "Recoger a los niños a las 2 de la tarde",
    { start: "14:00", assumedAfternoon: false },
  ],
  [
    "Reunión 10-12 el lunes",
    { start: "10:00", end: "12:00", date: "2026-11-23", title: "Reunión" },
  ],
  [
    "Reunión semanal cada semana el martes a las 9",
    {
      repeat: "weekly",
      date: "2026-11-24",
      start: "09:00",
      title: "Reunión semanal",
    },
  ],
  [
    "Basura todos los martes",
    { repeat: "weekly", date: "2026-11-24", title: "Basura", allDay: true },
  ],
  [
    "Pastillas a diario a las 8",
    { repeat: "daily", start: "08:00", title: "Pastillas" },
  ],
  [
    "Médico pasado mañana a las 10 menos cuarto",
    { date: "2026-11-20", start: "09:45", title: "Médico" },
  ],
  [
    "Médico el miércoles a las 10 y cuarto",
    { date: "2026-11-25", start: "10:15" },
  ],
  ["Médico hoy a las 21h", { date: "2026-11-18", start: "21:00" }],
  ["Cena el finde", { date: "2026-11-21", title: "Cena" }],
  ["Ir al banco", { title: "Ir al banco", date: null }],
  ["Ir al banco el lunes", { title: "Ir al banco", date: "2026-11-23" }],
  [
    "Hablar con Pablo en 3 meses",
    { date: "2027-02-18", title: "Hablar con Pablo", location: null },
  ],
  [
    "Hablar con Pablo en dos semanas en la oficina",
    { date: "2026-12-02", location: "la oficina" },
  ],
];

// Every date with every time: the title stays and each part is read (RNF-2).
const DATES: [string, string][] = [
  ["mañana", "2026-11-19"],
  ["el viernes", "2026-11-20"],
  ["el 25", "2026-11-25"],
  ["3 de diciembre", "2026-12-03"],
  ["10/12", "2026-12-10"],
  ["el próximo lunes", "2026-11-23"],
  ["dentro de 2 días", "2026-11-20"],
  ["pasado mañana", "2026-11-20"],
  ["hoy", "2026-11-18"],
  ["el 2 de enero de 2027", "2027-01-02"],
];
const TIMES: [string, string, string | null][] = [
  ["a las 9", "09:00", null],
  ["a las 21:30", "21:30", null],
  ["a las 9 de la noche", "21:00", null],
  ["de 10 a 12", "10:00", "12:00"],
  ["a mediodía", "12:00", null],
  ["a las 10 y media", "10:30", null],
  ["18:00-19:30", "18:00", "19:30"],
  ["por la mañana", "09:00", null],
  ["hasta las 14", "", "14:00"],
  ["a las 8 de la mañana", "08:00", null],
];

const COMBOS: NlCase[] = DATES.flatMap(([dateText, date], i) =>
  TIMES.map(([timeText, start, end], j): NlCase => {
    // Half with the time first, to read them in any order.
    const text =
      (i + j) % 2
        ? `Cena con Ana ${dateText} ${timeText}`
        : `Cena con Ana ${timeText} ${dateText}`;
    return [
      text,
      {
        title: "Cena con Ana",
        date,
        start: start || null,
        end,
        allDay: false,
      },
    ];
  }),
);

export const NL_CASES: NlCase[] = [...HAND, ...COMBOS];
