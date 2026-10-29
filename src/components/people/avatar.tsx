import { initials } from "@/lib/people/avatar";

/** A person as initials on their own pale tint; decorative next to the name (spec 005 RF-27). */
export function Avatar({ name, tint }: { name: string; tint: string }) {
  return (
    <span
      data-avatar=""
      aria-hidden="true"
      style={{ backgroundColor: tint }}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-pastel-ink"
    >
      {initials(name)}
    </span>
  );
}
