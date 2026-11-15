// The CaFam mark (constitution, amendment 10; spec 025 RF-7): a coral tile
// with an open white "C" and the dot of "today" in its mouth. The same
// drawing as public/icons/icon.svg. It never takes the user's accent.

export function LogoMark({ className = "size-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 rounded-control ${className}`}
    >
      <rect width="512" height="512" className="fill-mark" />
      <path
        d="M330.4 180.2A118 118 0 1 0 330.4 331.8"
        fill="none"
        strokeWidth="64"
        strokeLinecap="round"
        className="stroke-on-mark"
      />
      <circle cx="376" cy="256" r="34" className="fill-on-mark" />
    </svg>
  );
}

/** Mark and name together, for the cover and the sign-in pages. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark className="size-10" />
      <span className="text-2xl font-extrabold tracking-tight text-ink">
        CaFam
      </span>
    </span>
  );
}
