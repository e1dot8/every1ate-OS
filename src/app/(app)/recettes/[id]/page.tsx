import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { UsedForm } from "@/features/recipes/forms";
import { categoryName, getRecipe } from "@/features/recipes/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { archiveRecipeAction } from "../actions";

export const metadata: Metadata = { title: "Recette" };

async function RecipeView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const r = await getRecipe(id);
  if (!r || r.archivedAt) notFound();
  const mine = r.author.id === user.id;
  const used = r.uses.some((u) => u.user.id === user.id);
  return (
    <>
      <BackLink href="/recettes">Méthodes & modèles</BackLink>
      <PageHeader crumb={categoryName(r.category)} title={r.title} description={r.summary} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_18rem]">
        <Card className="gap-3">
          <CardTitle>Les étapes</CardTitle>
          <div className="text-[15px] leading-relaxed whitespace-pre-line">{r.body}</div>
          {r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-pen-strong hover:underline"
            >
              <ExternalLink aria-hidden="true" className="size-4" /> Le modèle ou la ressource
            </a>
          ) : null}
        </Card>
        <aside className="flex flex-col gap-4">
          <Card className="gap-2 text-sm">
            <p>
              Par <b>{r.author.name}</b> · mise à jour le {formatDay(r.updatedAt)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/recettes/${id}/modifier`}>
                  <Pencil aria-hidden="true" /> Améliorer
                </Link>
              </Button>
              {mine ? (
                <form action={archiveRecipeAction}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="ghost">Ranger</SubmitButton>
                </form>
              ) : null}
            </div>
          </Card>
          <Card className="gap-2">
            <CardTitle>Réutilisée par la brigade</CardTitle>
            {r.uses.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {r.uses.map((u) => (
                  <li key={u.id}>
                    <b>{u.user.name}</b>
                    {u.note ? ` — ${u.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Pas encore.</p>
            )}
            {!mine && !used ? <UsedForm id={id} /> : null}
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function RecipePage({ params }: PageProps<"/recettes/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <RecipeView params={params} />
      </Suspense>
    </div>
  );
}
