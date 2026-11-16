// Venito, the mascot of CaFam (constitution, amendment 12; spec 027 RF-1,
// spec 031): a walrus seen from the front, drawn in line, with round glasses,
// a two-lobed muzzle, long tusks and whiskers, after the user's reference.
// One drawing with a mood: the body is shared, and the eyes, the brows and a
// flipper change. Its colors are the `walrus` tokens, never the accent (plan
// D2); its gestures are in globals.css and stop with prefers-reduced-motion.

export type VenitoMood =
  "idle" | "wave" | "thinking" | "happy" | "confused" | "sleeping";

function Eyes({ mood, width }: { mood: VenitoMood; width: number }) {
  const line = {
    fill: "none",
    strokeWidth: width * 0.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  if (mood === "happy") {
    return (
      <g data-part="eyes" className="stroke-walrus-line" {...line}>
        <path d="M40.5 46q4.5-5.5 9 0M66.5 46q4.5-5.5 9 0" />
      </g>
    );
  }
  if (mood === "sleeping") {
    return (
      <g data-part="eyes" className="stroke-walrus-line" {...line}>
        <path d="M40.5 43.5q4.5 4 9 0M66.5 43.5q4.5 4 9 0" />
      </g>
    );
  }
  if (mood === "idle") {
    // Heavy lids, half way down: the bored look of the reference.
    return (
      <g data-part="eyes">
        <path
          d="M41 44.5h9M66 44.5h9"
          className="stroke-walrus-line"
          {...line}
        />
        <path
          d="M42 45a3.5 3.5 0 0 0 7 0ZM67 45a3.5 3.5 0 0 0 7 0Z"
          className="fill-walrus-line"
        />
      </g>
    );
  }
  // Open eyes; thinking looks up and to the side, confused narrows one.
  const look = mood === "thinking" ? { x: 1.2, y: -1.5 } : { x: 0, y: 0 };
  return (
    <g data-part="eyes">
      <circle
        cx={45.5 + look.x}
        cy={44.5 + look.y}
        r="3.4"
        className="fill-walrus-line"
      />
      {mood === "confused" ? (
        <path d="M66.5 44.5h9" className="stroke-walrus-line" {...line} />
      ) : (
        <circle
          cx={71.5 + look.x}
          cy={44.5 + look.y}
          r="3.4"
          className="fill-walrus-line"
        />
      )}
    </g>
  );
}

/**
 * `title` names it when it is the only content of something (a button);
 * without it, it is decoration and hidden from screen readers. `compact` is
 * for 48 px or less: no long whiskers and a thicker line (spec 031 RF-4).
 */
export function Venito({
  mood = "idle",
  className = "size-12",
  title,
  compact = false,
}: {
  mood?: VenitoMood;
  className?: string;
  title?: string;
  compact?: boolean;
}) {
  const width = compact ? 4.4 : 3.4;
  const line = {
    strokeWidth: width,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const thin = { ...line, strokeWidth: width * 0.7 };
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
      {/* The flippers, behind the body; the right one goes up to wave. */}
      <path
        d="M31 90C17 89 8 99 13 105c5 6 19 5 32 1Z"
        className="fill-walrus-body stroke-walrus-line"
        {...line}
      />
      <g data-part="flipper">
        <path
          d={
            mood === "wave"
              ? "M91 50c4-12 10-20 15-17s0 14-10 24"
              : "M93 56c9-3 14 2 12 9s-6 11-12 14"
          }
          className="fill-walrus-body stroke-walrus-line"
          {...line}
        />
      </g>
      <g data-part="head">
        <path
          data-part="body"
          d="M58 9C82 9 96 32 96 63c0 30-16 45-38 45S20 93 20 63C20 32 34 9 58 9Z"
          className="fill-walrus-body stroke-walrus-line"
          {...line}
        />
        {mood === "thinking" ? (
          <path
            d="M38 30q7-6 14-1M67 32h9"
            className="stroke-walrus-line"
            fill="none"
            {...thin}
          />
        ) : null}
        <Eyes mood={mood} width={width} />
        {/* Round glasses with a bridge: the secretary. */}
        <g
          data-part="glasses"
          className="stroke-walrus-line"
          fill="none"
          {...line}
          strokeWidth={width * 1.15}
        >
          <circle cx="45.5" cy="44.5" r="10.5" />
          <circle cx="71.5" cy="44.5" r="10.5" />
          <path d="M56 43q2.5-2 5 0" />
        </g>
        {/* Tusks first: the muzzle covers where they start. */}
        <g
          data-part="tusks"
          className="fill-walrus-body stroke-walrus-line"
          {...line}
        >
          <path d="M50.5 68l2.5 40q1.5 4 3 0l1.5-40Z" />
          <path d="M59.5 68l1.5 40q1.5 4 3 0l2.5-40Z" />
        </g>
        {compact ? null : (
          <g
            data-part="whiskers"
            className="stroke-walrus-line"
            fill="none"
            {...thin}
          >
            <path d="M41 60l-17-4M40 64.5H21M41 69l-15 5M75 60l17-4M76 64.5h19M75 69l15 5" />
          </g>
        )}
        <g className="fill-walrus-body stroke-walrus-line" {...line}>
          <circle cx="49" cy="64" r="9.5" />
          <circle cx="67" cy="64" r="9.5" />
        </g>
        <g className="fill-walrus-line/55">
          <circle cx="44" cy="62" r="1.3" />
          <circle cx="43.5" cy="67" r="1.3" />
          <circle cx="48.5" cy="69" r="1.3" />
          <circle cx="72" cy="62" r="1.3" />
          <circle cx="72.5" cy="67" r="1.3" />
          <circle cx="67.5" cy="69" r="1.3" />
        </g>
        <path
          d="M53.5 56.5h9q0 5-4.5 7q-4.5-2-4.5-7Z"
          className="fill-walrus-line stroke-walrus-line"
          {...thin}
        />
      </g>
      {mood === "confused" ? (
        <path
          d="M97 18q0-8 8-8t8 7q0 5-8 8v4M105 38v.5"
          className="stroke-walrus-line"
          fill="none"
          {...line}
        />
      ) : null}
      {mood === "sleeping" ? (
        <path
          d="M92 22h9l-9 10h9M104 8h7l-7 8h7"
          className="stroke-walrus-line"
          fill="none"
          {...thin}
        />
      ) : null}
      {mood === "thinking" ? (
        <g className="fill-walrus-line">
          <circle cx="97" cy="24" r="2.4" />
          <circle cx="105" cy="14" r="3.4" />
        </g>
      ) : null}
    </svg>
  );
}
