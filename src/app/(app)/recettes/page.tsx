import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { Panel, SpaceTabs, SpaceTitle } from "@/components/app/space-panel";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { textureFor } from "@/features/maison/assets";
import { cn } from "@/lib/utils";
import { RECIPE_CATEGORIES, categoryName, listRecipes } from "@/features/recipes/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Méthodes & modèles" };

const SHORT: Record<string, string> = {
  creation: "Création",
  production: "Production",
  commercial: "Commercial",
  agence: "Gestion",
  visibilite: "Visibilité",
  brigade: "Brigade",
};
const TINT: Record<string, string> = {
  creation: "bg-info-soft text-info",
  production: "bg-success-soft text-success",
  commercial: "bg-info-soft text-info",
  agence: "bg-muted text-ink/70",
  visibilite: "bg-warning-soft text-warning",
  brigade: "bg-danger-soft text-danger",
};

async function Book({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const category = RECIPE_CATEGORIES.some((c) => c.value === sp.categorie) ? sp.categorie : undefined;
  const recipes = await listRecipes({ category });
  return (
    <>
      <SpaceTabs
        label="Catégories"
        current={category ? `/recettes?categorie=${category}` : "/recettes"}
        tabs={[
          { href: "/recettes", label: "Tout" },
          ...RECIPE_CATEGORIES.map((c) => ({
            href: `/recettes?categorie=${c.value}`,
            label: SHORT[c.value] ?? c.label,
          })),
        ]}
      />
      {recipes.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => {
            const texture = textureFor(r.id);
            return (
              <li key={r.id}>
                <Link
                  href={`/recettes/${r.id}`}
                  className="group flex h-full flex-col gap-2 rounded-xl border bg-paper p-2 pb-3 hover:border-ink"
                >
                  <span className="relative block aspect-[3/2] overflow-hidden rounded-lg bg-ink">
                    {texture ? (
                      // eslint-disable-next-line @next/next/no-img-element -- texture d'ambiance locale
                      <img
                        src={texture}
                        alt=""
                        aria-hidden="true"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-1 px-1.5">
                    <b className="text-[15px] leading-tight">{r.title}</b>
                    <span className="line-clamp-2 text-[13px] text-muted-foreground">{r.summary}</span>
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-2 px-1.5 pt-1">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        TINT[r.category] ?? "bg-muted",
                      )}
                      title={categoryName(r.category)}
                    >
                      {SHORT[r.category] ?? categoryName(r.category)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {r.author.name} · {formatDay(r.updatedAt)} · réutilisée {r._count.uses} fois
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
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
    <Panel className="gap-5">
      <SpaceTitle title="Méthodes & modèles" universe="Le carnet de recettes">
        <div className="flex items-center gap-2">
          <Link
            href="/recherche"
            aria-label="Rechercher une méthode"
            className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
          >
            <Search aria-hidden="true" className="size-5" />
          </Link>
          <Button asChild variant="highlight">
            <Link href="/recettes/nouvelle">
              <Plus aria-hidden="true" /> Nouvelle recette
            </Link>
          </Button>
        </div>
      </SpaceTitle>
      <p className="text-[15px] text-ink/65">Méthodes, modèles et procédures qui ont fait leurs preuves.</p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-4" /> Documenter une recette rapporte 10 XP ; la voir
        réutilisée par un associé vaut le badge « Transmission du savoir ».
      </p>
      <Suspense fallback={<PageLoading />}>
        <Book searchParams={searchParams as Promise<{ categorie?: string }>} />
      </Suspense>
    </Panel>
  );
}
