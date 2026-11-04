import { CalendarDays, OctagonAlert } from "lucide-react";
import type { DeliverableFormat, DeliverableStage } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatEmojis, formatLabels, isLate, stageLabels } from "@/features/deliverables/rules";

/** Emoji du format, décoratif (le format est toujours écrit à côté ou dans le titre accessible). */
export function FormatEmoji({ format, className }: { format: DeliverableFormat; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("shrink-0 leading-none", className)}>
      {formatEmojis[format]}
    </span>
  );
}

export const formatText = (format: DeliverableFormat) => `${formatEmojis[format]} ${formatLabels[format]}`;

/** Échéance : rouge et « En retard » quand elle est passée sans livraison. */
export function DueDate({
  dueDate,
  stage,
  today,
  prefix,
}: {
  dueDate: Date | null;
  stage: DeliverableStage;
  today: Date;
  prefix?: string;
}) {
  if (!dueDate) return null;
  const late = isLate({ dueDate, stage }, today);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground",
        late && "font-bold text-danger",
      )}
    >
      <CalendarDays aria-hidden="true" className="size-3.5" />
      {late ? "En retard · " : prefix ? `${prefix} ` : ""}
      {formatDay(dueDate)}
    </span>
  );
}

export function BlockedBadge({ reason }: { reason?: string | null }) {
  return (
    <Badge variant="danger" title={reason ?? undefined}>
      <OctagonAlert aria-hidden="true" />
      Bloqué
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: DeliverableStage }) {
  return (
    <Badge variant={stage === "LIVRE" ? "success" : stage === "LIVRAISON" ? "highlight" : "outline"}>
      {stageLabels[stage]}
    </Badge>
  );
}

/** Petite barre « 3/5 » des points cochés. */
export function MiniProgress({
  done,
  total,
  label,
  className,
}: {
  done: number;
  total: number;
  label: string;
  className?: string;
}) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} sur ${total}`}
        className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full", done === total && total ? "bg-success" : "bg-ink")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-bold text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}
