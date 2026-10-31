import type { Metadata } from "next";
import { House } from "lucide-react";
import { getDb } from "@/lib/db/client";
import Link from "next/link";
import { Suspense } from "react";
import { AlertOctagon, CalendarDays, ListChecks, Plus, Search } from "lucide-react";
import { Avatar, Chip, EmptyState, Meta, Progress, ProjectStatusBadge } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PHASES, phaseLabel } from "@/features/projects/labels";
import { listProjects } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import type { ProjectPhase } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Projets" };

type Search = { vue?: string; moi?: string; phase?: string; q?: string };

async function ProjectList({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = sp.vue === "termines" || sp.vue === "archives" ? sp.vue : "en-cours";
  const phase = PHASES.some((p) => p.value === sp.phase) ? (sp.phase as ProjectPhase) : undefined;
  const projects = await listProjects({
    scope,
    mine: sp.moi ? user.id : undefined,
    phase,
    q: sp.q?.trim() || undefined,
  });
  const house = await getDb().project.findFirst({
    where: { internal: true },
    select: {
      id: true,
      _count: {
        select: { tasks: { where: { archivedAt: null, status: { notIn: ["TERMINE", "ANNULE"] } } } },
      },
    },
  });
  const internal = house ? { id: house.id, open: house._count.tasks } : null;
  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams(
      Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][],
    );
    const s = p.toString();
    return s ? `/projets?${s}` : "/projets";
  };

  return (
    <>
      <form
        role="search"
        action="/projets"
        className="flex min-h-tap items-center gap-2 rounded-lg border border-input px-3"
      >
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={sp.q}
          aria-label="Rechercher un projet ou un client"
          placeholder="Rechercher un projet ou un client"
          className="border-0 px-0 focus-visible:outline-none"
        />
        {sp.vue ? <input type="hidden" name="vue" value={sp.vue} /> : null}
      </form>
      <div className="flex flex-wrap gap-2">
        <Chip href={href({ vue: undefined })} active={scope === "en-cours"}>
          En cours
        </Chip>
        <Chip href={href({ moi: sp.moi ? undefined : "1" })} active={!!sp.moi}>
          Mes projets
        </Chip>
        {PHASES.map((p) => (
          <Chip
            key={p.value}
            href={href({ phase: sp.phase === p.value ? undefined : p.value })}
            active={sp.phase === p.value}
          >
            {p.label}
          </Chip>
        ))}
        <Chip href={href({ vue: "termines" })} active={scope === "termines"}>
          Terminés
        </Chip>
        <Chip href={href({ vue: "archives" })} active={scope === "archives"}>
          Archives
        </Chip>
      </div>
      {internal && scope === "en-cours" ? (
        <Link
          href={`/projets/${internal.id}`}
          className="flex min-h-tap w-fit items-center gap-2 rounded-full border-2 border-ink bg-cream px-3 text-sm font-bold hover:bg-highlight/40"
        >
          <House aria-hidden="true" className="size-4" /> La maison · {internal.open} tâche
          {internal.open > 1 ? "s" : ""} interne{internal.open > 1 ? "s" : ""}
        </Link>
      ) : null}
      {projects.length === 0 ? (
        <EmptyState title="Aucun projet ici.">
          <Link href="/projets/nouveau" className="font-bold underline">
            Créer un projet
          </Link>{" "}
          depuis un modèle ou à partir de zéro.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Projets">
          {projects.map((p) => (
            <li key={p.id}>
              <Card className="h-full gap-2.5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/projets/${p.id}`}
                      className="text-lg leading-tight font-bold hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{p.client?.name ?? "Sans client"}</span>
                  </div>
                  <Avatar name={p.owner.name} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ProjectStatusBadge status={p.status} />
                  <span className="text-xs font-bold text-muted-foreground">
                    Phase : {phaseLabel(p.phase)}
                  </span>
                </div>
                <Progress
                  value={p.taskTotal ? (p.taskDone / p.taskTotal) * 100 : 0}
                  label={`Avancement de ${p.name}`}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Meta icon={ListChecks}>
                    {p.taskDone}/{p.taskTotal} tâches
                  </Meta>
                  {p.plannedEndDate ? (
                    <Meta icon={CalendarDays}>Fin prévue {formatDay(p.plannedEndDate)}</Meta>
                  ) : null}
                  {p.taskBlocked ? (
                    <Meta icon={AlertOctagon} tone="danger">
                      {p.taskBlocked} tâche{p.taskBlocked > 1 ? "s" : ""} bloquée
                      {p.taskBlocked > 1 ? "s" : ""}
                    </Meta>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ProjectsPage({ searchParams }: PageProps<"/projets">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Projets</h1>
        <Button asChild>
          <Link href="/projets/nouveau">
            <Plus aria-hidden="true" /> Nouveau
          </Link>
        </Button>
      </div>
      <Suspense fallback={<PageLoading />}>
        <ProjectList searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </div>
  );
}
