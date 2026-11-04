import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { Search } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { PageLoading } from "@/components/layout/page-header";
import { EmptyLine, NotionPage, Section } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/dates";
import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  highlightParts,
  normalizeQuery,
  resultCountLabel,
  snippetAround,
} from "@/features/search/rules";
import { DiscussionsFrame, discussionsViewer } from "@/features/discussions/components/frame";
import { directNames, searchDiscussions } from "@/features/discussions/queries";
import { channelTitle, permalink, plainExcerpt } from "@/features/discussions/rules";

export const metadata: Metadata = { title: "Recherche dans les discussions" };

type SearchParams = { q?: string | string[] };

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

async function Results({ term, userId }: { term: string; userId: string }) {
  const result = await searchDiscussions(term, userId);
  if (!result.ok)
    return (
      <FormAlert tone="danger" title="Recherche impossible">
        {result.error}
      </FormAlert>
    );
  const { messages, total, channels } = result.data;
  if (!messages.length && !channels.length)
    return <EmptyLine>Aucun résultat pour « {term} » dans tes salons.</EmptyLine>;
  const partners = await directNames(
    messages.map((m) => m.slug),
    userId,
  );
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="text-sm text-muted-foreground">
        {resultCountLabel(total)} pour « {term} »
      </p>
      {channels.length ? (
        <Section title="Salons" count={channels.length}>
          <ul className="flex flex-col">
            {channels.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/discussions/${c.slug}`}
                  className="flex min-h-tap items-center rounded-md px-1 font-bold hover:bg-muted/60"
                >
                  <Highlighted text={c.projectName ?? c.name} term={term} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {messages.length ? (
        <Section title="Messages" count={total}>
          <ul aria-label="Messages trouvés" className="flex flex-col">
            {messages.map((m) => (
              <li key={m.id} className="relative flex flex-col gap-0.5 rounded-md px-1 py-2 hover:bg-muted/60">
                <Link
                  href={permalink(m.slug, m)}
                  className="text-sm break-words after:absolute after:inset-0 hover:underline"
                >
                  <span className="font-bold">{m.authorName ?? "QG"}</span>
                  {" : "}
                  <Highlighted text={snippetAround(plainExcerpt(m.body, 4000), term, 80)} term={term} />
                </Link>
                {m.attachmentTitle ? (
                  <span className="text-xs">
                    Lien joint : <Highlighted text={m.attachmentTitle} term={term} />
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {channelTitle({ ...m, name: m.channelName, partnerName: partners.get(m.slug) })}
                  {m.parentId ? " · dans un fil" : ""} · {formatDateTime(m.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          {total > messages.length ? (
            <p className="text-xs text-muted-foreground">
              {messages.length} plus récents sur {total} : précise la recherche pour affiner.
            </p>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

async function SearchView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await discussionsViewer();
  const query = normalizeQuery((await searchParams).q);
  return (
    <>
      <Form action="/discussions/recherche" role="search" className="flex flex-col gap-2">
        <Label htmlFor="discussions-q">Rechercher dans les discussions</Label>
        <div className="flex gap-2">
          <Input
            key={query.term}
            id="discussions-q"
            type="search"
            name="q"
            defaultValue={query.term}
            autoFocus={query.status !== "ok"}
            maxLength={SEARCH_MAX_LENGTH}
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Mot, nom de lien, salon…"
          />
          <Button type="submit">
            <Search aria-hidden="true" />
            Rechercher
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Accents et majuscules ignorés · seulement les salons auxquels tu as accès.
        </p>
      </Form>
      {query.status === "ok" ? (
        <Suspense key={query.term} fallback={<PageLoading />}>
          <Results term={query.term} userId={user.id} />
        </Suspense>
      ) : query.status === "too-short" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saisis au moins {SEARCH_MIN_LENGTH} caractères.
        </p>
      ) : null}
    </>
  );
}

export default function DiscussionsSearchPage({ searchParams }: PageProps<"/discussions/recherche">) {
  return (
    <DiscussionsFrame>
      <NotionPage icon="🔎" crumbs={[{ label: "Discussions", href: "/discussions" }]} title="Recherche">
        <Suspense fallback={<PageLoading />}>
          <SearchView searchParams={searchParams as Promise<SearchParams>} />
        </Suspense>
      </NotionPage>
    </DiscussionsFrame>
  );
}
