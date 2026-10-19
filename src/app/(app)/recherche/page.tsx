import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  highlightParts,
  normalizeQuery,
  resultCountLabel,
} from "@/features/search/rules";
import { globalSearch, type SearchGroup } from "@/features/search/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Recherche" };

type SearchParams = { q?: string | string[] };

/** Titre avec le terme surligné (comparaison sans accents ni casse, orthographe d'origine conservée). */
function Highlighted({ text, term }: { text: string; term: string }) {
  return highlightParts(text, term).map((part, i) =>
    part.match ? (
      <mark key={i} className="highlight bg-transparent text-inherit">
        {part.text}
      </mark>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}

function SearchForm({ term, autoFocus }: { term: string; autoFocus: boolean }) {
  return (
    <Form action="/recherche" role="search" className="flex flex-col gap-2">
      <Label htmlFor="recherche-q">Rechercher partout</Label>
      <div className="flex gap-2">
        <Input
          // Remonté à chaque nouvelle recherche : la saisie suit l'URL (retour arrière, icône de la barre).
          key={term}
          id="recherche-q"
          type="search"
          name="q"
          defaultValue={term}
          // Clavier ouvert d'emblée quand on arrive pour chercher ; pas par-dessus des résultats.
          autoFocus={autoFocus}
          maxLength={SEARCH_MAX_LENGTH}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Projet, client, contact, tâche…"
          aria-describedby="recherche-aide"
        />
        <Button type="submit">
          <Search aria-hidden="true" />
          Rechercher
        </Button>
      </div>
      <p id="recherche-aide" className="text-xs text-muted-foreground">
        Accents et majuscules ignorés · {SEARCH_MIN_LENGTH} caractères minimum · éléments archivés exclus.
      </p>
    </Form>
  );
}

function ResultGroup({ group, term }: { group: SearchGroup; term: string }) {
  const id = `groupe-${group.key}`;
  return (
    <section aria-labelledby={id} className="flex scroll-mt-4 flex-col gap-2">
      <h2 id={id} className="flex items-baseline gap-2 text-lg leading-tight font-bold">
        {group.label}{" "}
        <span className="text-sm font-normal text-muted-foreground tabular-nums">
          {resultCountLabel(group.count)}
        </span>
      </h2>
      <Card className="gap-0 py-1">
        <ul aria-label={group.label}>
          {group.hits.map((hit) => (
            <li
              key={hit.id}
              className="relative flex min-h-tap min-w-0 flex-col justify-center gap-0.5 border-b py-2.5 wrap-anywhere last:border-b-0"
            >
              {/* Lien étiré : toute la ligne est cliquable, le nom accessible reste le titre. */}
              <Link href={hit.href} className="font-bold after:absolute after:inset-0 hover:underline">
                <Highlighted text={hit.title} term={term} />
              </Link>
              {hit.meta ? <span className="text-[13px] text-muted-foreground">{hit.meta}</span> : null}
              {hit.snippet ? (
                <span className="text-sm text-muted-foreground">
                  <Highlighted text={hit.snippet} term={term} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {group.count > group.hits.length ? (
          <p className="border-t py-2 text-xs text-muted-foreground">
            {group.hits.length} premiers sur {group.count} : précisez la recherche pour affiner.
          </p>
        ) : null}
      </Card>
    </section>
  );
}

async function Results({ term, viewerId }: { term: string; viewerId: string }) {
  const result = await globalSearch(term, { id: viewerId });
  if (!result.ok)
    return (
      <FormAlert tone="danger" title="Recherche impossible">
        {result.error}
      </FormAlert>
    );
  const { total, groups } = result.data;
  if (!total)
    return (
      <EmptyState title={`Aucun résultat pour « ${term} »`}>
        Vérifiez l&apos;orthographe ou essayez un mot plus court. Les éléments archivés et les rendez-vous
        privés des autres associés ne sont pas inclus.
      </EmptyState>
    );
  const shown = groups.filter((g) => g.count > 0);
  return (
    <div className="flex flex-col gap-5">
      <p role="status" className="text-sm text-muted-foreground">
        {resultCountLabel(total)} pour « {term} »
      </p>
      {shown.length > 1 ? (
        <nav aria-label="Groupes de résultats" className="flex flex-wrap gap-2">
          {shown.map((g) => (
            <a
              key={g.key}
              href={`#groupe-${g.key}`}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-full border border-input bg-background px-3 text-[13px] font-bold hover:bg-muted"
            >
              {g.label} <span className="font-normal text-muted-foreground tabular-nums">{g.count}</span>
            </a>
          ))}
        </nav>
      ) : null}
      {shown.map((g) => (
        <ResultGroup key={g.key} group={g} term={term} />
      ))}
    </div>
  );
}

async function SearchView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const query = normalizeQuery((await searchParams).q);
  return (
    <>
      <SearchForm term={query.term} autoFocus={query.status !== "ok"} />
      {query.status === "ok" ? (
        <Suspense
          key={query.term}
          fallback={
            <p role="status" className="text-sm text-muted-foreground">
              Recherche en cours…
            </p>
          }
        >
          <Results term={query.term} viewerId={user.id} />
        </Suspense>
      ) : query.status === "too-short" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saisissez au moins {SEARCH_MIN_LENGTH} caractères.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Un nom de projet, d&apos;entreprise ou de contact, un titre de tâche, de document, d&apos;événement
          ou de compte rendu.
        </p>
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/recherche">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Recherche"
        description="Projets, CRM, tâches, documents, événements et comptes rendus."
      />
      <Suspense fallback={<PageLoading />}>
        <SearchView searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}
