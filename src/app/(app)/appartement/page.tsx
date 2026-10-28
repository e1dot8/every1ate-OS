import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  Award,
  Frame,
  Lamp,
  Library,
  Lock,
  Monitor,
  Plus,
  Sprout,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Chip, EmptyState } from "@/components/app/bits";
import { Panel, SpaceTabs, SpaceTitle } from "@/components/app/space-panel";
import { PageLoading } from "@/components/layout/page-header";
import { badgeByKey } from "@/features/badges/catalog";
import { ApartmentRoom } from "@/features/maison/components/apartment-room";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { PanelTitle } from "@/features/maison/components/house-panels";
import { SLOTS, unlockLabel, type Slot } from "@/features/maison/cosmetics";
import { apartment, availabilityLabels, type Availability } from "@/features/maison/service";
import { listAssociates } from "@/features/projects/service";
import { MASTERY } from "@/features/skills/tree";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setAvailabilityAction } from "./actions";

export const metadata: Metadata = { title: "Appartement" };

const AVAILABILITY: Availability[] = ["DISPONIBLE", "CONCENTRE", "ABSENT"];
const SLOT_ICONS: Record<Slot, LucideIcon> = {
  mur: Frame,
  etagere: Library,
  bureau: Monitor,
  sol: Sprout,
  lampe: Lamp,
  vitrine: Trophy,
};
const TABS = [
  { href: "/appartement", label: "Vue d'ensemble" },
  { href: "/progression", label: "Profil" },
  { href: "/competences", label: "Compétences" },
  { href: "/appartement/amenager", label: "Objets" },
];

async function Apartment({ searchParams }: { searchParams: Promise<{ associe?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const associates = await listAssociates();
  const target = sp.associe && associates.some((a) => a.id === sp.associe) ? sp.associe : user.id;
  const a = await apartment(target, user.id);
  if (!a) notFound();
  const p = a.progress;
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <Panel className="gap-5">
        <SpaceTitle title={a.own ? "Mon appartement" : `L'appartement de ${a.user.name}`}>
          <nav aria-label="Appartements" className="flex flex-wrap gap-2">
            {associates.map((x) => (
              <Chip
                key={x.id}
                href={x.id === user.id ? "/appartement" : `/appartement?associe=${x.id}`}
                active={x.id === target}
              >
                {x.id === user.id ? "Chez moi" : `Chez ${x.name}`}
              </Chip>
            ))}
          </nav>
        </SpaceTitle>
        {a.own ? <SpaceTabs label="Sections de l'appartement" tabs={TABS} current="/appartement" /> : null}

        <div className="relative overflow-hidden rounded-xl border bg-cream">
          <ApartmentRoom layout={a.layout} name={a.user.name} />
          {a.own ? (
            <Link
              href="/appartement/amenager"
              className="absolute top-3 right-3 inline-flex min-h-9 items-center rounded-full bg-paper px-4 text-[13px] font-bold shadow-sm hover:bg-highlight"
            >
              Aménager
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex items-center gap-4">
            <BrigadeAvatar look={a.look} size={72} label={`Avatar de ${a.user.name}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-2xl leading-tight font-bold tracking-[-0.02em]">{a.user.name}</h2>
              <p className="text-sm text-muted-foreground">
                {p.rank.title} · Niv. {p.level}
                {a.availability ? ` · ${availabilityLabels[a.availability]}` : ""}
              </p>
              <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${p.percent}%` }} />
              </span>
              <p className="text-right text-xs font-bold tabular-nums">
                {p.intoLevel} / {p.levelSpan} XP
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">{a.own ? "Mes expertises" : "Ses expertises"}</h2>
              <Link
                href={a.own ? "/competences" : `/competences?associe=${target}`}
                className="text-xs font-bold hover:underline"
              >
                L&apos;arbre
              </Link>
            </div>
            {a.skills.length ? (
              <ul className="flex flex-col gap-2">
                {a.skills.map((s) => (
                  <li key={s.key} className="grid grid-cols-[1fr_6rem] items-center gap-3 text-[13px]">
                    <span className="truncate">
                      {s.target ? <Star aria-label="Cible" className="mr-1 inline size-3 fill-ink" /> : null}
                      {s.name}
                    </span>
                    <span
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      title={`${MASTERY[s.level - 1]?.name ?? ""} (${s.level}/5)`}
                    >
                      <span
                        className="block h-full rounded-full bg-ink"
                        style={{ width: `${s.level * 20}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pas encore de compétence au-delà de la découverte.
              </p>
            )}
          </div>
        </div>

        <section className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-bold">{a.own ? "Ma collection" : "Sa collection"}</h2>
            <p className="text-xs text-muted-foreground">
              Débloquée par les niveaux, les rangs et les badges. Purement décorative.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {a.items.map((i) => {
              const Icon = i.unlocked ? SLOT_ICONS[i.slot] : Lock;
              const installed = a.layout[i.slot] === i.key;
              return (
                <li
                  key={i.key}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3",
                    i.unlocked ? "bg-paper" : "bg-muted/60 text-muted-foreground",
                    installed && "border-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-lg",
                      installed ? "bg-highlight" : "bg-muted",
                    )}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.5} className="size-5" />
                  </span>
                  <span className="text-[12.5px] leading-tight font-bold">{i.name}</span>
                  <span className="text-[11px] leading-tight">
                    {SLOTS.find((s) => s.key === i.slot)?.name}
                    {installed ? " · installé" : ""}
                    {!i.unlocked ? ` · ${unlockLabel(i.unlock)}` : ""}
                  </span>
                </li>
              );
            })}
            {a.own ? (
              <li>
                <Link
                  href="/appartement/amenager"
                  aria-label="Installer un objet"
                  className="flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed hover:bg-muted"
                >
                  <Plus aria-hidden="true" className="size-6" />
                </Link>
              </li>
            ) : null}
          </ul>
          {!a.badges.length && a.own ? (
            <EmptyState title="Votre premier objet arrive vite.">
              Terminez une tâche : la médaille de la première commande ira dans la vitrine.
            </EmptyState>
          ) : null}
        </section>
      </Panel>

      <aside className="flex flex-col gap-3">
        {a.own ? (
          <Panel className="gap-3">
            <PanelTitle title="Ma disponibilité" />
            <form
              action={setAvailabilityAction}
              className="flex flex-wrap items-center gap-2"
              aria-label="Ma disponibilité du jour"
            >
              {AVAILABILITY.map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="availability"
                  value={s}
                  aria-pressed={a.availability === s}
                  className={cn(
                    "inline-flex min-h-tap items-center rounded-full border px-4 text-sm",
                    a.availability === s ? "border-ink bg-highlight font-bold" : "hover:bg-muted",
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
            </form>
            <p className="text-xs text-muted-foreground">Facultatif, effacé chaque soir, jamais historisé.</p>
          </Panel>
        ) : null}
        <Panel className="gap-3">
          <PanelTitle title="En ce moment" />
          <ul className="flex flex-col gap-2 text-sm">
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
        </Panel>
        <Panel className="gap-3">
          <PanelTitle title="Badges favoris" href={a.own ? "/progression" : undefined} />
          {a.favorites.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {a.favorites.map((b) => (
                <li key={b.id} className="flex items-center gap-2">
                  <Award aria-hidden="true" className="size-4 shrink-0" />
                  <b>{badgeByKey(b.badgeKey)?.name}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {a.own ? "Choisissez jusqu'à trois favoris dans votre profil." : "Aucun badge favori affiché."}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {a.badgeCount} badge{a.badgeCount > 1 ? "s" : ""}. Un rang est un titre de parcours : aucun droit,
            aucune hiérarchie.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

export default function ApartmentPage({ searchParams }: PageProps<"/appartement">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Apartment searchParams={searchParams as Promise<{ associe?: string }>} />
    </Suspense>
  );
}
