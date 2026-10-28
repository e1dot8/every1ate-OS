import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Award, Lock, Paintbrush, Star, Target } from "lucide-react";
import { Chip, EmptyState } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { badgeByKey } from "@/features/badges/catalog";
import { ApartmentRoom } from "@/features/maison/components/apartment-room";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { SLOTS, unlockLabel } from "@/features/maison/cosmetics";
import { apartment, availabilityLabels, type Availability } from "@/features/maison/service";
import { LevelDots } from "@/features/skills/components/level-dots";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setAvailabilityAction } from "./actions";

export const metadata: Metadata = { title: "Appartement" };

const AVAILABILITY: Availability[] = ["DISPONIBLE", "CONCENTRE", "ABSENT"];

async function Apartment({ searchParams }: { searchParams: Promise<{ associe?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const associates = await listAssociates();
  const target = sp.associe && associates.some((a) => a.id === sp.associe) ? sp.associe : user.id;
  const a = await apartment(target, user.id);
  if (!a) notFound();
  return (
    <>
      <nav aria-label="Appartements" className="flex flex-wrap gap-2">
        {associates.map((p) => (
          <Chip
            key={p.id}
            href={p.id === user.id ? "/appartement" : `/appartement?associe=${p.id}`}
            active={p.id === target}
          >
            {p.id === user.id ? "Chez moi" : `Chez ${p.name}`}
          </Chip>
        ))}
      </nav>

      <header className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-paper sm:flex-row sm:items-center">
        <BrigadeAvatar look={a.look} size={112} label={`Avatar de ${a.user.name}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-annotation text-sm text-highlight">
            {a.own ? "mon appartement" : `l'appartement de ${a.user.name}`}
          </p>
          <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{a.user.name}</h1>
          <p className="text-sm text-paper/80">
            {a.progress.rank.title} · niveau {a.progress.level} · {a.badgeCount} badge
            {a.badgeCount > 1 ? "s" : ""}
            {a.availability ? ` · ${availabilityLabels[a.availability]} aujourd'hui` : ""}
          </p>
          <p className="text-xs text-paper/60">
            Un rang est un titre de parcours : aucun droit, aucune hiérarchie.
          </p>
        </div>
        {a.own ? (
          <Link
            href="/appartement/amenager"
            className="inline-flex min-h-tap items-center gap-2 self-start rounded-lg bg-highlight px-4 text-sm font-bold text-ink sm:self-center"
          >
            <Paintbrush aria-hidden="true" className="size-4" /> Aménager
          </Link>
        ) : null}
      </header>

      {a.own ? (
        <form
          action={setAvailabilityAction}
          className="flex flex-wrap items-center gap-2"
          aria-label="Ma disponibilité du jour"
        >
          <span className="text-sm font-bold">Aujourd&apos;hui :</span>
          {AVAILABILITY.map((s) => (
            <button
              key={s}
              type="submit"
              name="availability"
              value={s}
              aria-pressed={a.availability === s}
              className={cn(
                "inline-flex min-h-tap items-center rounded-full border px-3 text-sm font-bold",
                a.availability === s ? "border-ink bg-ink text-paper" : "hover:bg-muted",
              )}
            >
              {availabilityLabels[s]}
            </button>
          ))}
          {a.availability ? (
            <button type="submit" name="availability" value="" className="text-sm font-bold underline">
              Ne rien afficher
            </button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Facultatif, effacé chaque soir, jamais historisé.
          </span>
        </form>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="gap-2 p-3">
          <ApartmentRoom layout={a.layout} name={a.user.name} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="gap-2">
            <CardTitle>En ce moment</CardTitle>
            <ul className="flex flex-col gap-1.5 text-sm">
              {a.personalGoal ? (
                <li className="flex gap-2">
                  <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pen-strong" /> Pour moi
                  aujourd&apos;hui : {a.personalGoal}
                </li>
              ) : null}
              {a.goals.map((g) => (
                <li key={g.id} className="flex gap-2">
                  <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {g.title}
                    {g.dueDate ? (
                      <span className="text-muted-foreground"> · {formatDay(g.dueDate)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
              {!a.personalGoal && !a.goals.length ? (
                <li className="text-muted-foreground">Aucun objectif ouvert.</li>
              ) : null}
            </ul>
          </Card>
          <Card className="gap-2">
            <div className="flex items-baseline justify-between">
              <CardTitle>Compétences</CardTitle>
              <Link
                href={a.own ? "/competences" : `/competences?associe=${target}`}
                className="text-sm font-bold text-pen-strong hover:underline"
              >
                L&apos;arbre
              </Link>
            </div>
            {a.skills.length ? (
              <ul className="flex flex-col gap-2">
                {a.skills.map((s) => (
                  <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-bold">
                      {s.target ? (
                        <Star aria-label="Cible" className="mr-1 inline size-3.5 fill-ink" />
                      ) : null}
                      {s.name}
                    </span>
                    <LevelDots level={s.level} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pas encore de compétence au-delà de la découverte.
              </p>
            )}
          </Card>
          <Card className="gap-2">
            <CardTitle>Badges favoris</CardTitle>
            {a.favorites.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {a.favorites.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <Award aria-hidden="true" className="size-4 shrink-0 text-pen-strong" />
                    <b>{badgeByKey(b.badgeKey)?.name}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {a.own ? (
                  <>
                    Choisissez jusqu&apos;à trois favoris dans{" "}
                    <Link href="/progression" className="font-bold underline">
                      Ma progression
                    </Link>
                    .
                  </>
                ) : (
                  "Aucun badge favori affiché."
                )}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card className="gap-3">
        <CardTitle>{a.own ? "Ma collection d'objets" : "Sa collection d'objets"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Débloqués par les niveaux, les rangs et les badges. Purement décoratifs : aucun avantage dans le
          travail.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SLOTS.map((slot) => (
            <div key={slot.key} className="rounded-xl bg-muted p-3">
              <p className="mb-1 text-sm font-bold">{slot.name}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {a.items
                  .filter((i) => i.slot === slot.key)
                  .map((i) => (
                    <li
                      key={i.key}
                      className={cn("flex items-center gap-1.5", !i.unlocked && "text-muted-foreground")}
                    >
                      {i.unlocked ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 rounded-full",
                            a.layout[slot.key] === i.key ? "bg-pen" : "bg-ink",
                          )}
                        />
                      ) : (
                        <Lock aria-hidden="true" className="size-3" />
                      )}
                      <span>
                        {i.name}
                        {!i.unlocked ? <span className="text-xs"> · {unlockLabel(i.unlock)}</span> : null}
                        {a.layout[slot.key] === i.key ? (
                          <span className="text-xs font-bold text-pen-strong"> · installé</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {!a.badges.length && a.own ? (
          <EmptyState title="Votre premier objet arrive vite.">
            Terminez une tâche : la médaille de la première commande ira dans la vitrine.
          </EmptyState>
        ) : null}
      </Card>
    </>
  );
}

export default function ApartmentPage({ searchParams }: PageProps<"/appartement">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Apartment searchParams={searchParams as Promise<{ associe?: string }>} />
      </Suspense>
    </div>
  );
}
