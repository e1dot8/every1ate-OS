import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { RecipeForm } from "@/features/recipes/forms";
import { RECIPE_CATEGORIES, getRecipe } from "@/features/recipes/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Modifier la recette" };

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const r = await getRecipe(id);
  if (!r || r.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/recettes/${id}`}>{r.title}</BackLink>
      <PageHeader
        title="Modifier la recette"
        description="Toute la brigade peut l'améliorer ; chaque modification est journalisée."
      />
      <Card className="max-w-2xl">
        <RecipeForm categories={RECIPE_CATEGORIES} recipe={r} />
      </Card>
    </>
  );
}

export default function EditRecipePage({ params }: PageProps<"/recettes/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}
