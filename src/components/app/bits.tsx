import Link from "next/link";
import { ArrowLeft, CalendarDays, Flag, Link2 } from "lucide-react";
import type { Priority, ProjectPhase, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PHASES,
  priorityLabels,
  projectStatusLabels,
  projectStatusTone,
  taskStatusLabels,
  taskStatusTone,
} from "@/features/projects/labels";
import { formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function initials(name: string | null | undefined) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      title={name ?? "Non assigné"}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-cream text-[11px] font-bold",
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
      <span className="sr-only">{name ?? "Non assigné"}</span>
    </span>
  );
}

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <StatusBadge tone={projectStatusTone[status]} label={projectStatusLabels[status]} />
);
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <StatusBadge tone={taskStatusTone[status]} label={taskStatusLabels[status]} />
);

/** Les 5 phases métier : terminées en encre, en cours en rouge stylo, à venir en gris. */
export function PhaseSteps({ phase }: { phase: ProjectPhase }) {
  const current = PHASES.findIndex((p) => p.value === phase);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={`Phase : ${PHASES[current].label}`}>
      {PHASES.map((p, i) => (
        <li key={p.value} aria-current={i === current ? "step" : undefined} className="flex flex-col gap-1.5">
          <span
            className={cn(
              "h-1.5 rounded-full",
              i < current ? "bg-ink" : i === current ? "bg-pen" : "bg-border",
            )}
          />
          <span
            className={cn(
              "text-[10px] leading-tight font-bold md:text-xs",
              i <= current ? "text-foreground" : "text-muted-foreground",
              i === current && "md:text-[13px]",
            )}
          >
            {i + 1}. {p.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Meta({
  icon: Icon,
  children,
  tone,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
  tone?: "danger" | "warning" | "pen";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] text-muted-foreground",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        tone === "pen" && "text-pen-strong",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-tap w-fit items-center gap-1.5 text-sm font-bold hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

type TaskRowData = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  owner: { name: string } | null;
  project?: { name: string } | null;
  dependsOn?: { dependsOn: { title: string; status: TaskStatus } }[];
};

export function isLate(task: { dueDate: Date | null; status: TaskStatus }) {
  return !!task.dueDate && task.dueDate < todayDate() && !["TERMINE", "ANNULE"].includes(task.status);
}

export function TaskRow({ task, showProject }: { task: TaskRowData; showProject?: boolean }) {
  const waiting = (task.dependsOn ?? []).filter((d) => !["TERMINE", "ANNULE"].includes(d.dependsOn.status));
  const late = isLate(task);
  return (
    <li className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/taches/${task.id}`} className="font-bold hover:underline">
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TaskStatusBadge status={task.status} />
          {showProject && task.project ? (
            <span className="text-[13px] text-muted-foreground">{task.project.name}</span>
          ) : null}
          {task.dueDate ? (
            <Meta icon={CalendarDays} tone={late ? "danger" : undefined}>
              {late ? "En retard · " : ""}
              {formatDay(task.dueDate)}
            </Meta>
          ) : null}
          {waiting.length ? (
            <Meta icon={Link2} tone="warning">
              Attend : {waiting.map((w) => w.dependsOn.title).join(", ")}
            </Meta>
          ) : null}
          {task.priority === "HAUTE" || task.priority === "URGENTE" ? (
            <Meta icon={Flag} tone="pen">
              {priorityLabels[task.priority]}
            </Meta>
          ) : null}
        </div>
      </div>
      <Avatar name={task.owner?.name} />
    </li>
  );
}

export function Tabs({
  items,
  active,
}: {
  items: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <nav aria-label="Sections" className="-mx-1 overflow-x-auto px-1">
      {/* Onglets en pastilles, identiques dans tous les espaces (lot G8). */}
      <div className="inline-flex gap-1 rounded-full bg-muted p-1">
        {items.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-full px-4 text-[13px] whitespace-nowrap",
              t.key === active
                ? "border border-ink/10 bg-paper font-bold shadow-sm"
                : "text-ink/70 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-6">
      <p className="font-bold">{title}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-tap items-center rounded-full border px-3 text-[13px] font-bold",
        active ? "border-ink bg-ink text-paper" : "border-input bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
