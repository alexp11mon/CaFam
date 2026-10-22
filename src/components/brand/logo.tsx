// The CalenderFam mark: "CF" in stone on ink, the same drawing as
// public/icons/icon.svg (spec 005 RF-51, plan D14). It never takes the accent.

export function LogoMark({ className = "size-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 rounded-2xl ${className}`}
    >
      <rect width="512" height="512" className="fill-ink" />
      <path
        d="M274.9 198.1A90 90 0 1 0 274.9 313.9"
        fill="none"
        strokeWidth="60"
        className="stroke-stone"
      />
      <path
        d="M316 136h110v58h-52v36h34v54h-34v92h-58z"
        className="fill-stone"
      />
    </svg>
  );
}

/** Mark and name together, for the cover and the sign-in pages. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark className="size-10" />
      <span className="text-xl font-extrabold tracking-tight text-ink">
        CalenderFam
      </span>
    </span>
  );
}
