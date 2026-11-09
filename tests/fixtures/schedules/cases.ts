// Spec 022, T11: synthetic schedules for `npm run eval:schedule` (plan D10).
// No real data: invented shops and people. `scripts/make-schedules.mjs`
// renders each `html` to `<id>.jpg`; the images are committed so the eval
// does not need a browser.

export interface ExpectedRow {
  date: string; // start date
  start: string | null; // null = all day
  end: string | null;
  endDate?: string; // only when it is not `date`
}

export interface ScheduleCase {
  id: string;
  /** What the case checks, in Spanish for the report. */
  about: string;
  message: string;
  html: string;
  /** Rows, or "message" when no proposal must be shown. */
  expected: ExpectedRow[] | "message";
}

/** Thursday 12 November 2026, 10:00 in Madrid: "la que viene" is 16-22. */
export const EVAL_NOW = new Date("2026-11-12T09:00:00Z");

const page = (title: string, body: string) =>
  `<html><body style="font-family:Arial;padding:24px;background:#fff;color:#111">
<h2>${title}</h2>${body}</body></html>`;

const table = (head: string[], rows: string[][]) =>
  `<table border="1" cellpadding="8" style="border-collapse:collapse;font-size:18px">
<tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>
${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n")}
</table>`;

const WEEK = [
  "Lun 16",
  "Mar 17",
  "Mié 18",
  "Jue 19",
  "Vie 20",
  "Sáb 21",
  "Dom 22",
];
const day = (d: number) => `2026-11-${String(d).padStart(2, "0")}`;
const shift = (d: number, start: string, end: string): ExpectedRow => ({
  date: day(d),
  start,
  end,
});

const TEAM = page(
  "Cuadrante Supermercado Sol · Semana 16–22 noviembre 2026",
  table(
    ["Empleado", ...WEEK],
    [
      [
        "Ana",
        "8:00-15:00",
        "8:00-15:00",
        "LIBRE",
        "14:00-21:00",
        "14:00-21:00",
        "LIBRE",
        "LIBRE",
      ],
      [
        "Luis",
        "14:00-21:00",
        "LIBRE",
        "8:00-15:00",
        "8:00-15:00",
        "LIBRE",
        "9:00-14:00",
        "9:00-14:00",
      ],
      [
        "Rosa",
        "LIBRE",
        "14:00-21:00",
        "14:00-21:00",
        "LIBRE",
        "8:00-15:00",
        "8:00-15:00",
        "LIBRE",
      ],
    ],
  ),
);

export const CASES: ScheduleCase[] = [
  {
    id: "single-week",
    about: "Una persona, semana con fechas",
    message: "Ponlos en Trabajo",
    html: page(
      "Horario de Marta · Librería Faro · 16–22 nov 2026",
      table(WEEK, [
        [
          "9:00-14:00",
          "9:00-14:00",
          "9:00-14:00",
          "16:00-20:00",
          "16:00-20:00",
          "10:00-14:00",
          "-",
        ],
      ]),
    ),
    expected: [
      shift(16, "09:00", "14:00"),
      shift(17, "09:00", "14:00"),
      shift(18, "09:00", "14:00"),
      shift(19, "16:00", "20:00"),
      shift(20, "16:00", "20:00"),
      shift(21, "10:00", "14:00"),
    ],
  },
  {
    id: "days-off",
    about: "Días libres",
    message: "Mi horario, en Trabajo",
    html: page(
      "Turnos Cafetería Brisa · semana del 23 al 29 de noviembre de 2026",
      table(
        ["Lun 23", "Mar 24", "Mié 25", "Jue 26", "Vie 27", "Sáb 28", "Dom 29"],
        [
          [
            "DESCANSO",
            "7:00-13:00",
            "7:00-13:00",
            "DESCANSO",
            "7:00-13:00",
            "7:00-13:00",
            "DESCANSO",
          ],
        ],
      ),
    ),
    expected: [
      shift(24, "07:00", "13:00"),
      shift(25, "07:00", "13:00"),
      shift(27, "07:00", "13:00"),
      shift(28, "07:00", "13:00"),
    ],
  },
  {
    id: "night",
    about: "Turno de noche",
    message: "En Trabajo, por favor",
    html: page(
      "Vigilancia Nave 3 · 16–22 noviembre 2026",
      table(WEEK, [
        [
          "22:00-6:00",
          "22:00-6:00",
          "LIBRE",
          "LIBRE",
          "22:00-6:00",
          "LIBRE",
          "LIBRE",
        ],
      ]),
    ),
    expected: [
      { ...shift(16, "22:00", "06:00"), endDate: day(17) },
      { ...shift(17, "22:00", "06:00"), endDate: day(18) },
      { ...shift(20, "22:00", "06:00"), endDate: day(21) },
    ],
  },
  {
    id: "split",
    about: "Turno partido",
    message: "Crea mi horario en Trabajo",
    html: page(
      "Restaurante Olmo · Semana 16–22 nov 2026",
      table(WEEK, [
        [
          "9:00-13:00 / 17:00-20:00",
          "9:00-13:00 / 17:00-20:00",
          "LIBRE",
          "9:00-13:00",
          "17:00-23:00",
          "LIBRE",
          "LIBRE",
        ],
      ]),
    ),
    expected: [
      shift(16, "09:00", "13:00"),
      shift(16, "17:00", "20:00"),
      shift(17, "09:00", "13:00"),
      shift(17, "17:00", "20:00"),
      shift(19, "09:00", "13:00"),
      shift(20, "17:00", "23:00"),
    ],
  },
  {
    id: "twelve-hour",
    about: "Horas de 12 h",
    message: "Añádelo a Trabajo",
    html: page(
      "Shift plan · Nov 16 – Nov 22, 2026",
      table(
        [
          "Mon 11/16",
          "Tue 11/17",
          "Wed 11/18",
          "Thu 11/19",
          "Fri 11/20",
          "Sat 11/21",
          "Sun 11/22",
        ],
        [
          [
            "9 AM - 5 PM",
            "9 AM - 5 PM",
            "OFF",
            "1 PM - 9 PM",
            "1 PM - 9 PM",
            "OFF",
            "OFF",
          ],
        ],
      ),
    ),
    expected: [
      shift(16, "09:00", "17:00"),
      shift(17, "09:00", "17:00"),
      shift(19, "13:00", "21:00"),
      shift(20, "13:00", "21:00"),
    ],
  },
  {
    id: "team-person",
    about: "Varias personas, con la persona",
    message: "Soy Luis. Ponlo en Trabajo",
    html: TEAM,
    expected: [
      shift(16, "14:00", "21:00"),
      shift(18, "08:00", "15:00"),
      shift(19, "08:00", "15:00"),
      shift(21, "09:00", "14:00"),
      shift(22, "09:00", "14:00"),
    ],
  },
  {
    id: "team-no-person",
    about: "Varias personas, sin la persona (pregunta)",
    message: "Ponlo en Trabajo",
    html: TEAM,
    expected: "message",
  },
  {
    id: "team-missing-person",
    about: "La persona no aparece",
    message: "Soy Marta. Ponlo en Trabajo",
    html: TEAM,
    expected: "message",
  },
  {
    id: "no-dates",
    about: "Sin fechas (pregunta)",
    message: "Ponlo en Trabajo",
    html: page(
      "Horario de tarde",
      table(
        ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
        [
          [
            "15:00-21:00",
            "15:00-21:00",
            "15:00-21:00",
            "15:00-21:00",
            "15:00-21:00",
          ],
        ],
      ),
    ),
    expected: "message",
  },
  {
    id: "no-dates-relative",
    about: "Sin fechas, semana dicha en el mensaje",
    message: "Es de la semana que viene. Ponlo en Trabajo",
    html: page(
      "Horario de tarde",
      table(
        ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
        [["15:00-21:00", "LIBRE", "15:00-21:00", "LIBRE", "15:00-21:00"]],
      ),
    ),
    expected: [
      shift(16, "15:00", "21:00"),
      shift(18, "15:00", "21:00"),
      shift(20, "15:00", "21:00"),
    ],
  },
  {
    id: "no-schedule",
    about: "Imagen sin horario",
    message: "Ponlo en Trabajo",
    html: page(
      "Bizcocho de limón",
      `<ul style="font-size:20px"><li>3 huevos</li><li>200 g de azúcar</li><li>250 g de harina</li><li>1 limón</li></ul>
<p style="font-size:20px">Batir los huevos con el azúcar, añadir la harina y hornear 40 minutos a 180 grados.</p>`,
    ),
    expected: "message",
  },
  {
    id: "phone-list",
    about: "Lista vertical tipo captura del móvil",
    message: "Mis turnos, en Trabajo",
    html: page(
      "Mis turnos",
      `<div style="font-size:22px;line-height:2;width:380px">
<div>Lunes 23 nov · 7:00 a 15:00</div>
<div>Martes 24 nov · 7:00 a 15:00</div>
<div>Miércoles 25 nov · Libre</div>
<div>Jueves 26 nov · 15:00 a 23:00</div>
<div>Viernes 27 nov · 15:00 a 23:00</div></div>`,
    ),
    expected: [
      shift(23, "07:00", "15:00"),
      shift(24, "07:00", "15:00"),
      shift(26, "15:00", "23:00"),
      shift(27, "15:00", "23:00"),
    ],
  },
];
