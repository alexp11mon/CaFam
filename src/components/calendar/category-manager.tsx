"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import type {
  ConfirmState,
  FormAction,
  FormState,
} from "@/lib/forms/form-state";
import { ConfirmDialog } from "./confirm-dialog";
import { SwapLabel } from "@/components/ui/swap-label";
import { useT } from "@/components/i18n/locale-provider";

type CategoryState = FormState<"name">;

export interface CategoryItem {
  id: string;
  name: string;
}

interface CategoryManagerProps {
  categories: CategoryItem[];
  /** Owner or editor; viewers only see the list (RF-14). */
  canEdit: boolean;
  createAction: FormAction<CategoryState>;
  renameAction: (
    id: string,
    prev: CategoryState,
    formData: FormData,
  ) => Promise<CategoryState>;
  deleteAction: (id: string) => Promise<ConfirmState>;
}

function CreateForm({ action }: { action: FormAction<CategoryState> }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {
    values: { name: "" },
  });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <FormAlert message={state.formError} />
      <TextField
        label={t("Nueva categoría")}
        name="name"
        maxLength={40}
        defaultValue={state.values.name}
        error={state.fieldErrors?.name}
      />
      <div>
        <Button type="submit" disabled={pending}>
          <SwapLabel
            busy={pending}
            idle={t("Añadir categoría")}
            busyText={t("Añadiendo…")}
          />
        </Button>
      </div>
    </form>
  );
}

function CategoryRow({
  category,
  canEdit,
  renameAction,
  deleteAction,
}: {
  category: CategoryItem;
  canEdit: boolean;
  renameAction: CategoryManagerProps["renameAction"];
  deleteAction: CategoryManagerProps["deleteAction"];
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    renameAction.bind(null, category.id),
    { values: { name: category.name } },
  );

  if (editing && canEdit) {
    return (
      <form action={formAction} noValidate className="flex flex-col gap-3">
        <FormAlert message={state.formError} />
        <TextField
          label={t("Nuevo nombre de «{name}»", { name: category.name })}
          name="name"
          maxLength={40}
          defaultValue={state.values.name}
          error={state.fieldErrors?.name}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            <SwapLabel
              busy={pending}
              idle="Guardar nombre"
              busyText={t("Guardando…")}
            />
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            {t("Cancelar")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="min-w-0 break-words font-semibold text-ink">
        {category.name}
      </span>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-label={t("Renombrar {name}", { name: category.name })}
            onClick={() => setEditing(true)}
          >
            {t("Renombrar")}
          </Button>
          <ConfirmDialog
            triggerLabel={t("Borrar")}
            triggerAriaLabel={`Borrar ${category.name}`}
            title={t("¿Borrar la categoría «{name}»?", { name: category.name })}
            description={t(
              "Sus eventos no se borran: quedarán «Sin categoría».",
            )}
            confirmLabel={t("Sí, borrar")}
            action={deleteAction.bind(null, category.id)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Categories of one calendar: list, create, rename and delete (RF-9..RF-14). */
export function CategoryManager({
  categories,
  canEdit,
  createAction,
  renameAction,
  deleteAction,
}: CategoryManagerProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      {canEdit ? <CreateForm action={createAction} /> : null}
      {categories.length === 0 ? (
        <p className="rounded-card bg-paper px-4 py-6 text-center text-ink">
          {t("Este calendario aún no tiene categorías.")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {categories.map((category) => (
            <li
              key={`${category.id}:${category.name}`}
              className="rounded-card bg-paper p-4"
            >
              {/* The key includes the name so a saved rename leaves edit mode. */}
              <CategoryRow
                category={category}
                canEdit={canEdit}
                renameAction={renameAction}
                deleteAction={deleteAction}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
