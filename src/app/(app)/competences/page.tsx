import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { Chip } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { LevelDots } from "@/features/skills/components/level-dots";
import { skillProfile } from "@/features/skills/service";
import { BRANCHES, MASTERY } from "@/features/skills/tree";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Compétences" };

async function Tree({ searchParams }: { searchParams: Promise<{ associe?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const associates = await listAssociates();
  const who = associates.find((a) => a.id === sp.associe) ?? associates.find((a) => a.id === user.id)!;
  const own = who.id === user.id;
  const profile = await skillProfile(who.id);
  const target = profile.find((p) => p.target);
  const q = (key: string) => `/competences/${key}${own ? "" : `?associe=${who.id}`}`;
  return (
    <>
      <nav aria-label="Profil affiché" className="flex flex-wrap gap-2">
        {associates.map((a) => (
          <Chip
            key={a.id}
            href={a.id === user.id ? "/competences" : `/competences?associe=${a.id}`}
            active={a.id === who.id}
          >
            {a.id === user.id ? "Moi" : a.name}
          </Chip>
        ))}
      </nav>
      {target ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-ink bg-highlight/40 px-4 py-3 text-sm">
          <Star aria-hidden="true" className="size-4 fill-ink" />
          <span>
            Compétence travaillée en ce moment :{" "}
            <Link href={q(target.key)} className="font-bold underline">
              {target.name}
            </Link>
          </span>
        </p>
      ) : own ? (
        <p className="font-annotation text-sm text-pen-strong">
          choisissez une compétence cible pour le mois depuis sa fiche.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BRANCHES.map((b) => (
          <Card key={b.key} className="gap-2">
            <div>
              <CardTitle>{b.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{b.tagline}</p>
            </div>
            <ul className="flex flex-col">
              {profile
                .filter((p) => p.branch.key === b.key)
                .map((p) => (
                  <li key={p.key} className="border-t first:border-t-0">
                    <Link
                      href={q(p.key)}
                      className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1 text-sm font-bold">
                        {p.target ? (
                          <Star aria-label="Cible" className="mr-1 inline size-3.5 fill-ink" />
                        ) : null}
                        {p.name}
                      </span>
                      <LevelDots level={p.level} />
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card className="gap-2">
        <CardTitle>Les cinq niveaux</CardTitle>
        <ol className="grid grid-cols-1 gap-2 text-sm md:grid-cols-5">
          {MASTERY.map((m) => (
            <li key={m.level} className="rounded-lg bg-muted p-3">
              <b>
                {m.level}. {m.name}
              </b>
              <p className="text-muted-foreground">{m.description}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Le niveau est une auto-évaluation, éclairée par les preuves et les reconnaissances. Il ne dépend ni
          du rang ni du nombre de tâches.
        </p>
      </Card>
    </>
  );
}

export default function SkillsPage({ searchParams }: PageProps<"/competences">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="six branches, ouvertes à tous"
        title="Compétences"
        description="Pas de classe métier : chacun peut progresser partout."
      />
      <Suspense fallback={<PageLoading />}>
        <Tree searchParams={searchParams as Promise<{ associe?: string }>} />
      </Suspense>
    </div>
  );
}
