import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2, UserRound } from "lucide-react";
import type { DeliverableStage } from "@/generated/prisma/enums";
import { Toggle } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDay, todayDate, toDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { WORK_STAGES, stageLabels, stageProgress } from "@/features/deliverables/rules";
import type { DeliverableDetail } from "@/features/deliverables/service";
import { CheckButton } from "@/features/deliverables/components/check-button";
import {
  addCheckItemAction,
  assignCheckItemAction,
  deleteCheckItemAction,
  moveCheckItemAction,
  renameCheckItemAction,
  toggleCheckItemAction,
} from "@/app/(app)/livrables/actions";

type Item = DeliverableDetail["checkItems"][number];
type Opt = { value: string; label: string };

function ItemMenu({
  item,
  first,
  last,
  associates,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  associates: Opt[];
}) {
  return (
    <details className="group/menu shrink-0">
      <summary className="flex size-tap cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <MoreHorizontal aria-hidden="true" className="size-4" />
        <span className="sr-only">Options de « {item.label} »</span>
      </summary>
      {/* Panneau en largeur de la ligne : jamais de débordement horizontal sur mobile. */}
      <div className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-lg">
        <form action={renameCheckItemAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="itemId" value={item.id} />
          <label htmlFor={`libelle-${item.id}`} className="text-xs font-bold text-muted-foreground">
            Renommer
          </label>
          <div className="flex gap-2">
            <Input
              id={`libelle-${item.id}`}
              name="label"
              defaultValue={item.label}
              required
              maxLength={200}
              className="min-h-tap"
            />
            <Button type="submit" variant="outline" size="sm">
              Renommer
            </Button>
          </div>
        </form>
        <form action={assignCheckItemAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="itemId" value={item.id} />
          <span className="text-xs font-bold text-muted-foreground">Confier à</span>
          <div className="flex flex-wrap gap-2">
            <Select
              name="assigneeId"
              defaultValue={item.assigneeId ?? ""}
              aria-label={`Associé chargé de « ${item.label} »`}
              className="min-w-0 flex-1 basis-36"
            >
              <option value="">Personne</option>
              {associates.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              name="dueDate"
              defaultValue={toDateInput(item.dueDate)}
              aria-label={`Échéance de « ${item.label} »`}
              className="w-auto min-w-0 flex-1 basis-36"
            />
            <Button type="submit" variant="outline" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
        <div className="flex flex-wrap gap-2">
          {!first ? (
            <form action={moveCheckItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="direction" value="up" />
              <Button type="submit" variant="ghost" size="sm">
                <ArrowUp aria-hidden="true" /> Monter
              </Button>
            </form>
          ) : null}
          {!last ? (
            <form action={moveCheckItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="direction" value="down" />
              <Button type="submit" variant="ghost" size="sm">
                <ArrowDown aria-hidden="true" /> Descendre
              </Button>
            </form>
          ) : null}
          <form action={deleteCheckItemAction} className="ml-auto">
            <input type="hidden" name="itemId" value={item.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-danger">
              <Trash2 aria-hidden="true" /> Supprimer
            </Button>
          </form>
        </div>
      </div>
    </details>
  );
}

function ItemRow({
  item,
  first,
  last,
  associates,
  readOnly,
  today,
}: {
  item: Item;
  first: boolean;
  last: boolean;
  associates: Opt[];
  readOnly: boolean;
  today: Date;
}) {
  const done = !!item.doneAt;
  const late = !done && !!item.dueDate && item.dueDate.getTime() < today.getTime();
  const meta = [
    item.assignee ? (
      <span key="a" className="inline-flex items-center gap-1">
        <UserRound aria-hidden="true" className="size-3.5" />
        {item.assignee.name}
      </span>
    ) : null,
    item.dueDate ? (
      <span key="d" className={cn(late && "font-bold text-danger")}>
        {late ? "En retard · " : "Pour le "}
        {formatDay(item.dueDate)}
      </span>
    ) : null,
    done ? (
      <span key="f">
        Fait{item.doneBy ? ` par ${item.doneBy.name}` : ""} · {formatDay(todayDate(item.doneAt!))}
      </span>
    ) : null,
  ].filter(Boolean);
  return (
    <li className="relative flex items-start gap-1 rounded-md hover:bg-muted/60">
      {readOnly ? (
        <span
          role="checkbox"
          aria-checked={done}
          aria-disabled="true"
          aria-label={item.label}
          className="flex size-tap shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={cn("size-5 rounded border-2", done ? "border-ink bg-ink" : "border-input")}
          />
        </span>
      ) : (
        <form action={toggleCheckItemAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="checked" value={String(!done)} />
          <CheckButton checked={done} label={item.label} />
        </form>
      )}
      <div className="flex min-w-0 flex-1 flex-col py-2.5">
        <span className={cn("break-words", done && "text-muted-foreground line-through")}>{item.label}</span>
        {meta.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {readOnly ? null : <ItemMenu item={item} first={first} last={last} associates={associates} />}
    </li>
  );
}

/** Une étape repliable : sa checklist, l'ajout d'un point. L'étape courante est ouverte. */
export function StageChecklists({
  deliverable,
  associates,
  readOnly,
}: {
  deliverable: DeliverableDetail;
  associates: Opt[];
  readOnly: boolean;
}) {
  const today = todayDate();
  return (
    <div className="flex flex-col gap-1">
      {WORK_STAGES.map((stage: DeliverableStage) => {
        const items = deliverable.checkItems.filter((i) => i.stage === stage);
        const progress = stageProgress(deliverable.checkItems, stage);
        const current = deliverable.stage === stage;
        return (
          <Toggle
            key={stage}
            defaultOpen={current}
            title={
              <span className="inline-flex flex-wrap items-center gap-2">
                {stageLabels[stage]}
                {current ? (
                  <span className="rounded bg-highlight px-1.5 text-xs font-bold text-ink">
                    Étape en cours
                  </span>
                ) : null}
              </span>
            }
            meta={progress.total ? `${progress.done}/${progress.total}` : "—"}
          >
            {items.length ? (
              <ul aria-label={`Checklist ${stageLabels[stage]}`} className="flex flex-col">
                {items.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    first={index === 0}
                    last={index === items.length - 1}
                    associates={associates}
                    readOnly={readOnly}
                    today={today}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-1 py-2 text-sm text-muted-foreground">Aucun point pour cette étape.</p>
            )}
            {readOnly ? null : (
              <form action={addCheckItemAction} className="mt-1 flex gap-2">
                <input type="hidden" name="deliverableId" value={deliverable.id} />
                <input type="hidden" name="stage" value={stage} />
                <Input
                  name="label"
                  required
                  maxLength={200}
                  placeholder="Ajouter un point…"
                  aria-label={`Nouveau point (${stageLabels[stage]})`}
                  className="min-w-0"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label={`Ajouter à ${stageLabels[stage]}`}
                >
                  <Plus aria-hidden="true" />
                  <span className="hidden sm:inline">Ajouter</span>
                </Button>
              </form>
            )}
          </Toggle>
        );
      })}
    </div>
  );
}
