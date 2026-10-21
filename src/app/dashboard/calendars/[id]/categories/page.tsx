import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryManager } from "@/components/calendar/category-manager";
import { PageShell } from "@/components/calendar/page-shell";
import {
  getCalendar,
  getCategories,
  requireUser,
} from "@/lib/calendar/queries";
import { createCategory, deleteCategory, renameCategory } from "./actions";

export const metadata: Metadata = { title: "Categorías" };

// Reads the session and the route param, so it streams behind <Suspense> (cacheComponents).
async function Categories({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const calendar = await getCalendar(supabase, userId, id);
  // Viewers cannot manage categories (RF-14): they get a 404 like any stranger.
  if (!calendar || calendar.role === "viewer") notFound();
  const categories = await getCategories(supabase, id);

  return (
    <>
      <p className="flex items-center gap-2 text-ink">
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border border-ink/20"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="min-w-0 break-words font-semibold">
          {calendar.name}
        </span>
      </p>
      <CategoryManager
        categories={categories}
        canEdit
        createAction={createCategory.bind(null, id)}
        renameAction={renameCategory}
        deleteAction={deleteCategory}
      />
    </>
  );
}

export default function CategoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell title="Categorías">
      <Suspense fallback={<p className="text-ink/70">Cargando…</p>}>
        <Categories params={params} />
      </Suspense>
    </PageShell>
  );
}
