// Venito, the mascot of CaFam (constitution, amendment 11; spec 027 RF-1,
// spec 030 RF-10): a seal seen from the front, the secretary of the house,
// with round glasses, a collar and a tie. Serious rather than cute. One drawing with a mood: the head is
// shared, and the eyes, the mouth and the flippers change (plan D7). Its
// colors are the `seal` tokens, never the accent (plan D5); its gestures are
// in globals.css and stop with prefers-reduced-motion.

export type VenitoMood =
  "idle" | "wave" | "thinking" | "happy" | "confused" | "sleeping";

const LINE = {
  fill: "none",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Eyes({ mood }: { mood: VenitoMood }) {
  if (mood === "happy") {
    return (
      <g className="stroke-seal-dark" {...LINE}>
        <path d="M36 59q6-5 12 0M72 59q6-5 12 0" />
      </g>
    );
  }
  if (mood === "sleeping") {
    return (
      <g className="stroke-seal-dark" {...LINE}>
        <path d="M36 58q6 4 12 0M72 58q6 4 12 0" />
      </g>
    );
  }
  // Thinking looks up and to the side; confused narrows one eye.
  const look = mood === "thinking" ? { x: 2, y: -2.5 } : { x: 0, y: 0 };
  return (
    <g data-part="eyes">
      <circle cx="42" cy="58" r="4.6" className="fill-seal-dark" />
      {mood === "confused" ? (
        <path d="M72 58h12" className="stroke-seal-dark" {...LINE} />
      ) : (
        <circle cx="78" cy="58" r="4.6" className="fill-seal-dark" />
      )}
      <circle
        cx={43.4 + look.x}
        cy={56.6 + look.y}
        r="1.3"
        className="fill-seal-light"
      />
      {mood === "confused" ? null : (
        <circle
          cx={79.4 + look.x}
          cy={56.6 + look.y}
          r="1.3"
          className="fill-seal-light"
        />
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: VenitoMood }) {
  const path =
    mood === "happy"
      ? "M60 77v3M52 82q8 5 16 0"
      : mood === "confused"
        ? "M60 77v3M51 84q4-4 9 0t9 0"
        : mood === "sleeping"
          ? "M60 77v3M55 83q5 3 10 0"
          : "M60 77v3M53 82h14";
  return <path d={path} className="stroke-seal-dark" {...LINE} />;
}

/**
 * `title` names it when it is the only content of something (a button);
 * without it, it is decoration and hidden from screen readers.
 */
export function Venito({
  mood = "idle",
  className = "size-12",
  title,
}: {
  mood?: VenitoMood;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      data-venito={mood}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {/* The flippers, behind the head; one goes up to wave. */}
      <ellipse
        cx="17"
        cy="88"
        rx="9"
        ry="15"
        transform="rotate(28 17 88)"
        className="fill-seal"
      />
      <g data-part="flipper">
        <ellipse
          cx="103"
          cy={mood === "wave" ? 62 : 88}
          rx="9"
          ry="15"
          transform={
            mood === "wave" ? "rotate(24 103 62)" : "rotate(-28 103 88)"
          }
          className="fill-seal"
        />
      </g>
      <g data-part="head">
        <ellipse cx="60" cy="64" rx="45" ry="43" className="fill-seal" />
        {/* The pale muzzle and the spots over the eyes. */}
        <ellipse cx="60" cy="80" rx="26" ry="18" className="fill-seal-light" />
        <ellipse
          cx="40"
          cy="43"
          rx="4.5"
          ry="2.6"
          className="fill-seal-light"
        />
        <ellipse
          cx="80"
          cy="43"
          rx="4.5"
          ry="2.6"
          className="fill-seal-light"
        />
        <Eyes mood={mood} />
        {/* Round glasses: what makes it the secretary (spec 030 RF-10). */}
        <g data-part="glasses" className="stroke-seal-dark" {...LINE}>
          <circle cx="42" cy="58" r="12" className="fill-seal-light/35" />
          <circle cx="78" cy="58" r="12" className="fill-seal-light/35" />
          <path d="M54 56q6-4 12 0M30 55l-9-4M90 55l9-4" />
        </g>
        <ellipse cx="60" cy="72" rx="6.5" ry="4.6" className="fill-seal-dark" />
        <Mouth mood={mood} />
        {/* Whiskers, as dots: they survive at 40 px. */}
        <g className="fill-seal-dark">
          <circle cx="45" cy="80" r="1.4" />
          <circle cx="49" cy="85" r="1.4" />
          <circle cx="75" cy="80" r="1.4" />
          <circle cx="71" cy="85" r="1.4" />
        </g>
      </g>
      {/* A collar and a tie, at the foot of the drawing. */}
      <g data-part="collar">
        <path
          d="M40 101l20 10-9 9Z M80 101l-20 10 9 9Z"
          className="fill-seal-light"
        />
        <path d="M60 109l-4.5 5 4.5 6 4.5-6Z" className="fill-seal-dark" />
      </g>
      {mood === "confused" ? (
        <path
          d="M97 22q0-8 8-8t8 7q0 5-8 8v4M105 42v.5"
          className="stroke-seal-dark"
          {...LINE}
        />
      ) : null}
      {mood === "sleeping" ? (
        <path
          d="M92 22h10l-10 11h10M106 8h7l-7 8h7"
          className="stroke-seal-dark"
          {...LINE}
          strokeWidth={2.5}
        />
      ) : null}
      {mood === "thinking" ? (
        <g className="fill-seal-dark">
          <circle cx="98" cy="26" r="2.6" />
          <circle cx="106" cy="17" r="3.4" />
        </g>
      ) : null}
    </svg>
  );
}
