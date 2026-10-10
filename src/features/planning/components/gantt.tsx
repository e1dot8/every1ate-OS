"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Diamond, Layers } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { addDays, daysBetween, formatDay, parseDateInput, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  moveMilestoneAction,
  moveTaskAction,
  previewMoveAction,
  type MovePreviewDTO,
} from "@/app/(app)/projets/[id]/roadmap/actions";

export type GanttTask = {
  id: string;
  title: string;
  status: string;
  start: string | null;
  due: string | null;
  lotId: string | null;
  owner: string | null;
};
export type GanttLot = { id: string; name: string };
export type GanttMilestone = { id: string; name: string; date: string; reached: boolean };
type Edge = { taskId: string; dependsOnId: string };

const ROW = 40;
const ZOOMS = { semaine: 32, mois: 14 } as const;
const DONE = ["TERMINE", "ANNULE"];

type Drag = {
  kind: "task" | "milestone";
  id: string;
  mode: "move" | "resize";
  delta: number;
  originX: number | null;
};
type Pending = {
  kind: "task" | "milestone";
  id: string;
  title: string;
  from: [string, string];
  to: [string, string];
  preview: MovePreviewDTO | null;
};

const d = (s: string) => parseDateInput(s)!;
const fmt = (s: string | null) => (s ? formatDay(d(s)) : "—");

export function Gantt(props: {
  tasks: GanttTask[];
  lots: GanttLot[];
  milestones: GanttMilestone[];
  edges: Edge[];
  today: string;
}) {
  const router = useRouter();
  const [zoom, setZoom] = useState<keyof typeof ZOOMS>("semaine");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [busy, startTransition] = useTransition();
  const dayW = ZOOMS[zoom];
  const scroller = useRef<HTMLDivElement>(null);
  const today = d(props.today);

  const { rangeStart, days, rows, positions } = useMemo(() => {
    const dates = [
      today,
      ...props.tasks.flatMap((t) => [t.start, t.due].filter(Boolean).map((s) => d(s!))),
      ...props.milestones.map((m) => d(m.date)),
    ];
    const min = new Date(Math.min(...dates.map((x) => x.getTime())));
    const max = new Date(Math.max(...dates.map((x) => x.getTime())));
    const rangeStart = addDays(min, -3);
    const days = daysBetween(rangeStart, max) + 10;
    type Row =
      | { type: "milestones" }
      | { type: "lot"; lot: GanttLot; span: [Date, Date] | null }
      | { type: "task"; task: GanttTask };
    const rows: Row[] = [];
    if (props.milestones.length) rows.push({ type: "milestones" });
    const groups = [...props.lots.map((l) => ({ lot: l as GanttLot | null })), { lot: null }];
    for (const { lot } of groups) {
      const tasks = props.tasks.filter((t) => t.lotId === (lot?.id ?? null));
      if (!lot && !tasks.length) continue;
      const dated = tasks.flatMap((t) => [t.start, t.due].filter(Boolean).map((s) => d(s!).getTime()));
      const span: [Date, Date] | null = dated.length
        ? [new Date(Math.min(...dated)), new Date(Math.max(...dated))]
        : null;
      rows.push({ type: "lot", lot: lot ?? { id: "", name: "Sans lot" }, span });
      for (const task of tasks) rows.push({ type: "task", task });
    }
    const positions = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.type === "task") positions.set(r.task.id, i);
    });
    return { rangeStart, days, rows, positions };
  }, [props.tasks, props.lots, props.milestones, today]);

  const x = (date: Date) => daysBetween(rangeStart, date) * dayW;

  // À l'ouverture : centrer sur aujourd'hui, ou sur le début du projet s'il est plus tard.
  const firstStart = useMemo(() => {
    const starts = props.tasks.map((t) => t.start ?? t.due).filter(Boolean) as string[];
    return starts.length ? starts.sort()[0] : null;
  }, [props.tasks]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const anchor = firstStart && d(firstStart) > today ? d(firstStart) : today;
    el.scrollLeft = Math.max(0, daysBetween(rangeStart, anchor) * dayW - 7 * dayW); // une semaine de contexte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayW, firstStart]);

  function datesOf(t: GanttTask, delta = 0, mode: Drag["mode"] = "move"): [Date, Date] | null {
    const due = t.due ? d(t.due) : t.start ? d(t.start) : null;
    const start = t.start ? d(t.start) : due;
    if (!start || !due) return null;
    if (mode === "resize") {
      const newDue = addDays(due, delta);
      return [start, newDue < start ? start : newDue];
    }
    return [addDays(start, delta), addDays(due, delta)];
  }

  async function propose(kind: Drag["kind"], id: string, delta: number, mode: Drag["mode"]) {
    setDrag(null);
    if (!delta) return;
    setError(null);
    if (kind === "milestone") {
      const m = props.milestones.find((m) => m.id === id)!;
      const to = toDateInput(addDays(d(m.date), delta));
      setPending({ kind, id, title: m.name, from: [m.date, m.date], to: [to, to], preview: null });
      return;
    }
    const t = props.tasks.find((t) => t.id === id)!;
    const next = datesOf(t, delta, mode);
    if (!next) return;
    const to: [string, string] = [toDateInput(next[0]), toDateInput(next[1])];
    const preview = await previewMoveAction(id, to[0], to[1]);
    setPending({ kind, id, title: t.title, from: [t.start ?? t.due!, t.due ?? t.start!], to, preview });
    setAnnounce(`Proposition : ${t.title} du ${fmt(to[0])} au ${fmt(to[1])}. Confirmez ou annulez.`);
  }

  function confirm(cascade: boolean) {
    if (!pending) return;
    startTransition(async () => {
      const result =
        pending.kind === "milestone"
          ? await moveMilestoneAction(pending.id, pending.to[0])
          : await moveTaskAction(pending.id, pending.to[0], pending.to[1], cascade);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnnounce("Déplacement enregistré.");
      setPending(null);
      router.refresh();
    });
  }

  function onPointerDown(e: React.PointerEvent, kind: Drag["kind"], id: string, mode: Drag["mode"]) {
    if (pending) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind, id, mode, delta: 0, originX: e.clientX });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (drag?.originX == null) return;
    const delta = Math.round((e.clientX - drag.originX) / dayW);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  }
  function onPointerUp() {
    if (drag?.originX == null) return;
    void propose(drag.kind, drag.id, drag.delta, drag.mode);
  }

  /** Alternative clavier : ← → déplacent d'un jour, Maj + ← → changent la durée, Entrée propose. */
  function onKeyDown(e: React.KeyboardEvent, kind: Drag["kind"], id: string) {
    if (pending) return;
    const mode: Drag["mode"] = e.shiftKey && kind === "task" ? "resize" : "move";
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const current = drag && drag.id === id && drag.mode === mode ? drag.delta : 0;
      setDrag({ kind, id, mode, delta: current + step, originX: null });
      setAnnounce(
        `${mode === "resize" ? "Durée" : "Décalage"} : ${current + step > 0 ? "+" : ""}${current + step} jour(s). Entrée pour proposer.`,
      );
    } else if (e.key === "Enter" && drag?.id === id) {
      e.preventDefault();
      void propose(kind, id, drag.delta, drag.mode);
    } else if (e.key === "Escape") setDrag(null);
  }

  const width = days * dayW;
  const conflictEdge = (e: Edge) => {
    const a = props.tasks.find((t) => t.id === e.dependsOnId);
    const b = props.tasks.find((t) => t.id === e.taskId);
    return !!(a?.due && b?.start && !DONE.includes(a.status) && d(b.start) <= d(a.due));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Échelle" className="inline-flex rounded-lg border p-0.5">
          {(Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]).map((z) => (
            <Button
              key={z}
              type="button"
              size="sm"
              variant={zoom === z ? "default" : "ghost"}
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
            >
              {z === "semaine" ? "Semaines" : "Mois"}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Glissez une barre pour la déplacer, son bord droit pour changer la durée. Au clavier : ← → (Maj pour
          la durée), puis Entrée.
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error ? <FormAlert tone="danger" title={error} /> : null}

      {pending ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="move-title"
          className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-card p-4"
        >
          <h2 id="move-title" className="text-lg font-bold">
            Déplacer « {pending.title} »
          </h2>
          <p className="text-sm">
            {pending.kind === "milestone" ? (
              <>
                {fmt(pending.from[0])} → <b>{fmt(pending.to[0])}</b>
              </>
            ) : (
              <>
                {fmt(pending.from[0])} – {fmt(pending.from[1])} →{" "}
                <b>
                  {fmt(pending.to[0])} – {fmt(pending.to[1])}
                </b>
              </>
            )}
          </p>
          {pending.preview && !pending.preview.ok ? (
            <FormAlert tone="danger" title={pending.preview.error} />
          ) : null}
          {pending.preview?.ok && pending.preview.conflicts.length ? (
            <FormAlert tone="warning" title="Conflit de dépendances">
              <ul className="list-disc pl-5">
                {pending.preview.conflicts.map((c) => (
                  <li key={c.id + c.message}>{c.message}</li>
                ))}
              </ul>
            </FormAlert>
          ) : null}
          {pending.preview?.ok && pending.preview.cascade.length ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-bold">Cascade proposée (durées conservées) :</p>
              <ul className="flex flex-col gap-0.5">
                {pending.preview.cascade.map((c) => (
                  <li key={c.id}>
                    {c.title} : {fmt(c.from[0])} →{" "}
                    <b>
                      {fmt(c.to[0])} – {fmt(c.to[1])}
                    </b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {pending.preview?.ok && pending.preview.cascade.length ? (
              <>
                <Button type="button" disabled={busy} onClick={() => confirm(true)}>
                  Déplacer et décaler {pending.preview.cascade.length} tâche
                  {pending.preview.cascade.length > 1 ? "s" : ""}
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => confirm(false)}>
                  Déplacer seulement cette tâche
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={busy || (pending.preview != null && !pending.preview.ok)}
                onClick={() => confirm(false)}
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex overflow-hidden rounded-xl border bg-card">
        <div className="w-36 shrink-0 border-r md:w-56">
          <div className="h-10 border-b" />
          {rows.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex h-10 items-center gap-1.5 truncate border-b px-2 text-sm last:border-b-0",
                r.type === "lot" && "bg-muted/60 font-bold",
              )}
            >
              {r.type === "milestones" ? (
                <>
                  <Diamond aria-hidden="true" className="size-4 shrink-0" /> Jalons
                </>
              ) : r.type === "lot" ? (
                <>
                  <Layers aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{r.lot.name}</span>
                </>
              ) : (
                <Link href={`/taches/${r.task.id}`} className="truncate pl-3 hover:underline">
                  {r.task.title}
                </Link>
              )}
            </div>
          ))}
        </div>
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto" data-testid="gantt-scroll">
          <div className="relative" style={{ width }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            {/* En-tête des jours */}
            <div className="flex h-10 border-b text-[10px] text-muted-foreground">
              {Array.from({ length: days }, (_, i) => {
                const day = addDays(rangeStart, i);
                const monday = day.getUTCDay() === 1;
                const first = day.getUTCDate() === 1;
                return (
                  <div
                    key={i}
                    className={cn(
                      "shrink-0 border-l border-border/40 pt-1 pl-0.5",
                      (monday || first) && "border-border",
                    )}
                    style={{ width: dayW }}
                  >
                    {zoom === "semaine" ? day.getUTCDate() : monday ? day.getUTCDate() : ""}
                    {first ? (
                      <span className="block font-bold">
                        {new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(day)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {/* Aujourd'hui */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-pen"
              style={{ left: x(today) + dayW / 2 }}
            />
            {/* Dépendances */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-10 left-0"
              width={width}
              height={rows.length * ROW}
            >
              {props.edges.map((e) => {
                const a = props.tasks.find((t) => t.id === e.dependsOnId);
                const b = props.tasks.find((t) => t.id === e.taskId);
                const ra = positions.get(e.dependsOnId);
                const rb = positions.get(e.taskId);
                const da = a && datesOf(a);
                const db = b && datesOf(b);
                if (ra == null || rb == null || !da || !db) return null;
                const x1 = x(da[1]) + dayW;
                const y1 = ra * ROW + ROW / 2;
                const x2 = x(db[0]);
                const y2 = rb * ROW + ROW / 2;
                const bad = conflictEdge(e);
                return (
                  <path
                    key={e.taskId + e.dependsOnId}
                    d={`M${x1},${y1} h6 V${y2} H${x2 - 2}`}
                    fill="none"
                    className={bad ? "stroke-danger" : "stroke-muted-foreground/60"}
                    strokeWidth={bad ? 2 : 1.25}
                    strokeDasharray={bad ? "4 3" : undefined}
                    markerEnd="url(#fleche)"
                  />
                );
              })}
              <defs>
                <marker
                  id="fleche"
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 z" className="fill-muted-foreground" />
                </marker>
              </defs>
            </svg>
            {rows.map((r, i) => (
              <div
                key={i}
                className={cn("relative h-10 border-b last:border-b-0", r.type === "lot" && "bg-muted/60")}
              >
                {r.type === "milestones"
                  ? props.milestones.map((m) => {
                      const delta = drag?.kind === "milestone" && drag.id === m.id ? drag.delta : 0;
                      const left = x(addDays(d(m.date), delta));
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-label={`Jalon ${m.name}, ${fmt(m.date)}${m.reached ? ", atteint" : ""}. Flèches pour déplacer.`}
                          title={`${m.name} · ${fmt(m.date)}`}
                          className="absolute top-1/2 z-20 flex -translate-y-1/2 cursor-grab touch-none items-center gap-1 text-xs font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring"
                          style={{ left: left + dayW / 2 - 8 }}
                          onPointerDown={(e) => onPointerDown(e, "milestone", m.id, "move")}
                          onKeyDown={(e) => onKeyDown(e, "milestone", m.id)}
                        >
                          <Diamond
                            aria-hidden="true"
                            className={cn(
                              "size-4",
                              m.reached ? "fill-success text-success" : "fill-highlight text-ink",
                            )}
                          />
                          {m.name}
                        </button>
                      );
                    })
                  : null}
                {r.type === "lot" && r.span ? (
                  <div
                    aria-hidden="true"
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/70"
                    style={{ left: x(r.span[0]), width: (daysBetween(r.span[0], r.span[1]) + 1) * dayW }}
                  />
                ) : null}
                {r.type === "task"
                  ? (() => {
                      const t = r.task;
                      const active = drag?.kind === "task" && drag.id === t.id;
                      const dates = datesOf(t, active ? drag.delta : 0, active ? drag.mode : "move");
                      if (!dates)
                        return (
                          <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground italic">
                            Non planifiée ·{" "}
                            <Link href={`/taches/${t.id}/modifier`} className="underline">
                              ajouter des dates
                            </Link>
                          </span>
                        );
                      const late = !DONE.includes(t.status) && t.due && d(t.due) < today;
                      const finished = t.status === "TERMINE";
                      const blocked = t.status === "BLOQUE";
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${t.title} : du ${formatDay(dates[0])} au ${formatDay(dates[1])}${late ? ", en retard" : ""}${blocked ? ", bloquée" : ""}. Flèches pour déplacer, Maj + flèches pour la durée.`}
                          data-testid={`bar-${t.id}`}
                          className={cn(
                            "absolute top-1.5 bottom-1.5 z-20 flex cursor-grab touch-none items-center overflow-hidden rounded-md border-2 px-1.5 text-xs font-bold whitespace-nowrap select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            finished
                              ? "border-success bg-success-soft"
                              : blocked
                                ? "border-danger bg-danger-soft"
                                : "border-ink bg-highlight/70",
                            late && "border-danger",
                            active && "opacity-80 shadow-lg",
                          )}
                          style={{
                            left: x(dates[0]),
                            width: Math.max(dayW, (daysBetween(dates[0], dates[1]) + 1) * dayW),
                          }}
                          onPointerDown={(e) => onPointerDown(e, "task", t.id, "move")}
                          onKeyDown={(e) => onKeyDown(e, "task", t.id)}
                        >
                          {late ? (
                            <AlertTriangle aria-hidden="true" className="mr-1 size-3 shrink-0 text-danger" />
                          ) : null}
                          <span className="truncate">{zoom === "semaine" ? (t.owner ?? "") : ""}</span>
                          <span
                            aria-hidden="true"
                            className="absolute top-0 right-0 bottom-0 w-2.5 cursor-ew-resize bg-ink/20"
                            onPointerDown={(e) => onPointerDown(e, "task", t.id, "resize")}
                          />
                        </div>
                      );
                    })()
                  : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-ink bg-highlight/70" /> À faire / en
          cours
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-success bg-success-soft" /> Terminée
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border-2 border-danger bg-danger-soft" /> Bloquée
        </li>
        <li className="flex items-center gap-1.5">
          <AlertTriangle aria-hidden="true" className="size-3 text-danger" /> En retard
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-2 border-dashed border-danger" /> Dépendance en
          conflit
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-pen" /> Aujourd&apos;hui
        </li>
      </ul>
    </div>
  );
}
