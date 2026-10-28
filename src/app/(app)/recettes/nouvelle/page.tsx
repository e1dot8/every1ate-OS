import type { Metadata } from "next";
import { BackLink } from "@/components/app/bits";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { RecipeForm } from "@/features/recipes/forms";
import { RECIPE_CATEGORIES } from "@/features/recipes/service";

export const metadata: Metadata = { title: "Nouvelle recette" };

export default function NewRecipePage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/recettes">Méthodes & modèles</BackLink>
      <PageHeader
        title="Nouvelle recette"
        description="Assez précise pour qu'un associé la refasse sans vous."
      />
      <Card className="max-w-2xl">
        <RecipeForm categories={RECIPE_CATEGORIES} />
      </Card>
    </div>
  );
}
