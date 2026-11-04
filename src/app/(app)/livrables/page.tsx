import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Plus, SquareKanban, Table2 } from "lucide-react";
import { Chip } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { NotionPage, ViewTabs } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth/session";
import { todayDate } from "@/lib/dates";
import { FORMATS, formatEmojis, formatLabels, isFormat } from "@/features/deliverables/rules";
import {
  deliverableFormOptions,
  deliverableSummary,
  listDeliverables,
  type DeliverableFilter,
} from "@/features/deliverables/service";
import { BoardView, CalendarView, SummaryBand, TableView } from "@/features/deliverables/components/views";

export const metadata: Metadata = { title: "Livrables" };

type Search = Record<string, string | string[] | undefined>;
const PARAMS = ["vue", "projet", "responsable", "format", "retard", "semaine", "bloque", "livres"] as const;
type Params = Partial<Record<(typeof PARAMS)[number], string>>;
const VIEWS = ["tableau", "table", "calendrier"] as const;

function readParams(sp: Search): Params {
  const out: Params = {};
  for (const key of PARAMS) {
    const v = sp[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 100);
  }
  return out;
}

async function DeliverablesBase({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = readParams(await searchParams);
  const view = (VIEWS as readonly string[]).includes(params.vue ?? "") ? params.vue! : "tableau";
  const ownerId = params.responsable === "moi" ? user.id : params.responsable;
  const scope: DeliverableFilter = {
    projectId: params.projet,
    ownerId,
    format: isFormat(params.format) ? params.format : undefined,
  };
  const filter: DeliverableFilter = {
    ...scope,
    late: params.retard === "1",
    week: params.semaine === "1",
    blocked: params.bloque === "1",
    deliveredMonth: params.livres === "mois",
  };
  const today = todayDate();
  const now = new Date();
  const [items, summary, options] = await Promise.all([
    listDeliverables(filter, today, now),
    deliverableSummary(scope, today),
    deliverableFormOptions(),
  ]);

  const href = (patch: Partial<Record<string, string | undefined>>) => {
    const merged = { ...params, ...patch };
    if (merged.vue === "tableau") delete merged.vue;
    const query = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => !!e[1]),
    ).toString();
    return query ? `/livrables?${query}` : "/livrables";
  };
  const quick = [
    { key: "responsable", value: "moi", label: "Mes livrables" },
    { key: "retard", value: "1", label: "En retard" },
    { key: "semaine", value: "1", label: "Cette semaine" },
    { key: "bloque", value: "1", label: "Bloqués" },
    { key: "livres", value: "mois", label: "Livrés ce mois" },
  ] as const;
  const filtered = PARAMS.some((k) => k !== "vue" && params[k]);

  return (
    <>
      <SummaryBand summary={summary} href={href} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Filtres rapides" role="group">
          {quick.map((q) => {
            const active = params[q.key] === q.value;
            return (
              <Chip key={q.key} href={href({ [q.key]: active ? undefined : q.value })} active={active}>
                {q.label}
              </Chip>
            );
          })}
        </div>
        <Form
          action="/livrables"
          className="flex flex-wrap items-center gap-2"
          aria-label="Filtrer les livrables"
        >
          {(["vue", "retard", "semaine", "bloque", "livres"] as const).map((k) =>
            params[k] ? <input key={k} type="hidden" name={k} value={params[k]} /> : null,
          )}
          <Select
            name="projet"
            defaultValue={params.projet ?? ""}
            aria-label="Projet"
            className="w-auto max-w-full min-w-0 flex-1 basis-44 text-sm"
          >
            <option value="">Tous les projets</option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            name="responsable"
            defaultValue={params.responsable ?? ""}
            aria-label="Responsable"
            className="w-auto max-w-full min-w-0 flex-1 basis-36 text-sm"
          >
            <option value="">Tous les responsables</option>
            <option value="moi">Moi</option>
            {options.associates
              .filter((a) => a.id !== user.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
          <Select
            name="format"
            defaultValue={params.format ?? ""}
            aria-label="Format"
            className="w-auto max-w-full min-w-0 flex-1 basis-36 text-sm"
          >
            <option value="">Tous les formats</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {formatEmojis[f]} {formatLabels[f]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">
            Filtrer
          </Button>
          {filtered ? (
            <Link
              href={params.vue ? `/livrables?vue=${params.vue}` : "/livrables"}
              className="inline-flex min-h-tap items-center px-2 text-sm font-bold text-pen-strong hover:underline"
            >
              Effacer les filtres
            </Link>
          ) : null}
        </Form>
      </div>
      <ViewTabs
        current={view}
        label="Vues des livrables"
        views={[
          { key: "tableau", label: "Tableau", icon: SquareKanban, href: href({ vue: undefined }) },
          { key: "table", label: "Table", icon: Table2, href: href({ vue: "table" }) },
          { key: "calendrier", label: "Calendrier", icon: CalendarDays, href: href({ vue: "calendrier" }) },
        ]}
      />
      <p role="status" className="sr-only">
        {items.length} livrable{items.length > 1 ? "s" : ""} affiché{items.length > 1 ? "s" : ""}
      </p>
      {view === "table" ? (
        <TableView items={items} today={today} />
      ) : view === "calendrier" ? (
        <CalendarView items={items} today={today} />
      ) : (
        <BoardView items={items} today={today} now={now} />
      )}
    </>
  );
}

export default function DeliverablesPage({ searchParams }: PageProps<"/livrables">) {
  return (
    <NotionPage
      icon="🎬"
      title="Livrables"
      description="Chaque contenu, de la préparation à la livraison : checklists, échéances, blocages."
      actions={
        <Button asChild>
          <Link href="/livrables/nouveau">
            <Plus aria-hidden="true" /> Nouveau livrable
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<PageLoading />}>
        <DeliverablesBase searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </NotionPage>
  );
}
