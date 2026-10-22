import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Chip, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RECIPE_CATEGORIES, categoryName, listRecipes } from "@/features/recipes/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Le carnet de recettes" };

async function Book({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const category = RECIPE_CATEGORIES.some((c) => c.value === sp.categorie) ? sp.categorie : undefined;
  const recipes = await listRecipes({ category });
  return (
    <>
      <nav aria-label="Catégories" className="flex flex-wrap gap-2">
        <Chip href="/recettes" active={!category}>
          Toutes
        </Chip>
        {RECIPE_CATEGORIES.map((c) => (
          <Chip key={c.value} href={`/recettes?categorie=${c.value}`} active={category === c.value}>
            {c.label}
          </Chip>
        ))}
      </nav>
      {recipes.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link href={`/recettes/${r.id}`} className="block h-full">
                <Card className="h-full gap-1.5 p-4 hover:border-ink">
                  <span className="font-annotation text-xs text-pen-strong">{categoryName(r.category)}</span>
                  <b className="text-lg leading-tight">{r.title}</b>
                  <span className="text-sm text-muted-foreground">{r.summary}</span>
                  <span className="mt-auto text-xs text-muted-foreground">
                    {r.author.name} · {formatDay(r.updatedAt)} · réutilisée {r._count.uses} fois
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Le carnet est encore vierge.">
          Une méthode qui a marché sur un projet ? Écrivez-la : la brigade la retrouvera ici.
        </EmptyState>
      )}
    </>
  );
}

export default function RecipesPage({ searchParams }: PageProps<"/recettes">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          crumb="tout est fait maison"
          title="Le carnet de recettes"
          description="Méthodes, modèles et procédures qui ont fait leurs preuves."
        />
        <Button asChild>
          <Link href="/recettes/nouvelle">
            <Plus aria-hidden="true" /> Nouvelle recette
          </Link>
        </Button>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-4" /> Documenter une recette rapporte 10 XP ; la voir
        réutilisée par un associé vaut le badge « Transmission du savoir ».
      </p>
      <Suspense fallback={<PageLoading />}>
        <Book searchParams={searchParams as Promise<{ categorie?: string }>} />
      </Suspense>
    </div>
  );
}
