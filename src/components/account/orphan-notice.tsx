import { T } from "@/components/i18n/locale-provider";
/** Members page of a calendar without owner: who decides and until when (RF-22, RF-24). */
export function OrphanNotice({
  deadline,
  timeZone,
}: {
  deadline: string;
  timeZone: string;
}) {
  const day = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(deadline));

  return (
    <p role="status" className="rounded-control bg-paper p-4 text-ink">
      <T vars={{ day }}>
        {
          "Este calendario no tiene propietario. Sus miembros pueden decidir hasta el {day} si lo conservan."
        }
      </T>
    </p>
  );
}
