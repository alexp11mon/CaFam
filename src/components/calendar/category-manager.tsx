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
  const [state, formAction, pending] = useActionState(action, {
    values: { name: "" },
  });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <FormAlert message={state.formError} />
      <TextField
        label="Nueva categoría"
        name="name"
        maxLength={40}
        defaultValue={state.values.name}
        error={state.fieldErrors?.name}
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Añadiendo…" : "Añadir categoría"}
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
          label={`Nuevo nombre de «${category.name}»`}
          name="name"
          maxLength={40}
          defaultValue={state.values.name}
          error={state.fieldErrors?.name}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar nombre"}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
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
            aria-label={`Renombrar ${category.name}`}
            onClick={() => setEditing(true)}
          >
            Renombrar
          </Button>
          <ConfirmDialog
            triggerLabel="Borrar"
            triggerAriaLabel={`Borrar ${category.name}`}
            title={`¿Borrar la categoría «${category.name}»?`}
            description="Sus eventos no se borran: quedarán «Sin categoría»."
            confirmLabel="Sí, borrar"
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
  return (
    <div className="flex flex-col gap-6">
      {canEdit ? <CreateForm action={createAction} /> : null}
      {categories.length === 0 ? (
        <p className="rounded-lg bg-brand-soft/40 px-4 py-6 text-center text-ink">
          Este calendario aún no tiene categorías.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {categories.map((category) => (
            <li
              key={`${category.id}:${category.name}`}
              className="rounded-xl border border-ink/15 bg-white p-4"
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
