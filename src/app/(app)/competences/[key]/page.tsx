import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, Star } from "lucide-react";
import { BackLink, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { EndorseForm, EvidenceForm } from "@/features/skills/components/forms";
import { LevelDots } from "@/features/skills/components/level-dots";
import { skillDetail } from "@/features/skills/service";
import { MASTERY, skillByKey } from "@/features/skills/tree";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setSkillLevelAction, setSkillTargetAction } from "../actions";

export const metadata: Metadata = { title: "Compétence" };

async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ associe?: string }>;
}) {
  const user = await requireUser();
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const skill = skillByKey(key);
  if (!skill) notFound();
  const associates = await listAssociates();
  const who = associates.find((a) => a.id === sp.associe) ?? associates.find((a) => a.id === user.id)!;
  const own = who.id === user.id;
  const d = await skillDetail(who.id, key);
  const endorsedByMe = d.endorsements.some((e) => e.by.id === user.id);
  return (
    <>
      <BackLink href={own ? "/competences" : `/competences?associe=${who.id}`}>
        {skill.branch.name}
        {own ? "" : ` · ${who.name}`}
      </BackLink>
      <PageHeader
        crumb={own ? "ma compétence" : `compétence de ${who.name}`}
        title={skill.name}
        description={skill.description}
      />
      <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Card className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Niveau</CardTitle>
              <LevelDots level={d.level} />
            </div>
            {own ? (
              <>
                <div className="grid gap-2 sm:grid-cols-5" role="group" aria-label="Choisir mon niveau">
                  {MASTERY.map((m) => (
                    <form key={m.level} action={setSkillLevelAction}>
                      <input type="hidden" name="skillKey" value={key} />
                      <input type="hidden" name="level" value={m.level} />
                      <button
                        type="submit"
                        aria-pressed={m.level === d.level}
                        className={cn(
                          "flex min-h-tap w-full flex-col items-start rounded-lg border p-2 text-left text-xs hover:border-ink",
                          m.level === d.level && "border-ink bg-ink text-paper",
                        )}
                      >
                        <b className="text-sm">
                          {m.level}. {m.name}
                        </b>
                        <span className={m.level === d.level ? "text-paper/75" : "text-muted-foreground"}>
                          {m.description}
                        </span>
                      </button>
                    </form>
                  ))}
                </div>
                {d.suggested > d.level ? (
                  <p className="font-annotation text-sm text-pen-strong">
                    vos preuves suggèrent le niveau {d.suggested} ({MASTERY[d.suggested - 1].name}) : à vous
                    de voir.
                  </p>
                ) : null}
                <form action={setSkillTargetAction}>
                  <input type="hidden" name="skillKey" value={key} />
                  <input type="hidden" name="on" value={d.target ? "false" : "true"} />
                  <button
                    type="submit"
                    className="inline-flex min-h-tap items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-bold hover:bg-highlight"
                  >
                    <Star aria-hidden="true" className={cn("size-4", d.target && "fill-ink")} />
                    {d.target ? "Ne plus en faire ma cible" : "En faire ma compétence cible du mois"}
                  </button>
                </form>
              </>
            ) : null}
          </Card>

          <Card className="gap-3">
            <CardTitle>Les preuves</CardTitle>
            {d.evidence.length ? (
              <ul className="flex flex-col">
                {d.evidence.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 border-t py-2 text-sm first:border-t-0">
                    <span className="w-16 shrink-0 text-muted-foreground">{formatDay(e.createdAt)}</span>
                    <span className="min-w-0 flex-1">{e.text}</span>
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Ouvrir le lien"
                        className="text-pen-strong"
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucune preuve pour l'instant." />
            )}
            {own ? <EvidenceForm skillKey={key} /> : null}
          </Card>

          <Card className="gap-3">
            <CardTitle>Reconnaissances de la brigade</CardTitle>
            {d.endorsements.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {d.endorsements.map((e) => (
                  <li key={e.id}>
                    <b>{e.by.name}</b>
                    {e.note ? ` : ${e.note}` : " reconnaît cette compétence."}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Facultatives, jamais nécessaires pour progresser.
              </p>
            )}
            {!own && !endorsedByMe ? <EndorseForm userId={who.id} skillKey={key} name={who.name} /> : null}
          </Card>
        </div>
        <aside className="flex flex-col gap-4">
          <Card className="gap-2">
            <CardTitle>Exemples de preuves</CardTitle>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {skill.proofs.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Card>
          <Card className="gap-2">
            <CardTitle>Pour progresser</CardTitle>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {skill.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function SkillPage({ params, searchParams }: PageProps<"/competences/[key]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Detail params={params} searchParams={searchParams as Promise<{ associe?: string }>} />
      </Suspense>
    </div>
  );
}
