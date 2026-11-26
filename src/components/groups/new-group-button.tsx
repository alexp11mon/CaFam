"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import type { FormAction, FormState } from "@/lib/forms/form-state";
import { GroupForm } from "./group-form";
import { useT } from "@/components/i18n/locale-provider";

/**
 * "Nuevo grupo" among the other ways of "Mis calendarios": the form waits in
 * a sheet instead of always taking the top of the screen (spec 032 RF-13).
 */
export function NewGroupButton({
  action,
}: {
  action: FormAction<FormState<"name">>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // A new form each time it opens: nothing from the last group is left.
  const [round, setRound] = useState(0);

  return (
    <>
      <Chip
        aria-haspopup="dialog"
        onClick={() => {
          setRound((value) => value + 1);
          setOpen(true);
        }}
      >
        {t("Nuevo grupo")}
      </Chip>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("Nuevo grupo")}
      >
        <div className="pt-1 pb-2">
          <GroupForm
            key={round}
            action={action}
            onCreated={() => setOpen(false)}
          />
        </div>
      </Sheet>
    </>
  );
}
