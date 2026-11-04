import Link from "next/link";
import { CalendarDays, Clock, Handshake, MessageCircleHeart } from "lucide-react";
import { Avatar, Meta, TaskStatusBadge } from "@/components/app/bits";
import { Callout, EmptyLine, Section, Toggle } from "@/components/notion/blocks";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDay, formatDateTime, toDateInput, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/features/planning/rules";
import { presenceDot, presenceText, type PresenceInfo } from "@/features/presence/rules";
import type { PendingHandoff } from "@/features/qg/handoffs";
import { badgeLabels, type QuestKey, type QuestView } from "@/features/qg/quests";
import type { myDesk, tasksToTake, teamToday } from "@/features/qg/service";
import {
  CancelHandoffForm,
  HandoffAnswerForm,
  QuickReprendreButton,
  TakeTaskButton,
} from "@/features/qg/components/handoff-forms";

const rowClass = "flex flex-col gap-2 rounded-md border-b px-1 py-3 last:border-b-0 hover:bg-muted/60";

/** Places du bureau : une case par place, pleine si occupée (dépassement en rouge stylo). */
function Slots({ used, limit }: { used: number; limit: number }) {
  const total = Math.max(used, limit);
  return (
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-3 w-5 rounded-sm border",
            i < used
              ? i >= limit
                ? "border-pen bg-pen"
                : "border-ink bg-ink"
              : "border-border bg-background",
          )}
        />
      ))}
    </span>
  );
}

// ─── Mon bureau ─────────────────────────────────────────────────────────────

export function DeskSection({ desk }: { desk: Awaited<ReturnType<typeof myDesk>> }) {
  const used = desk.tasks.length;
  return (
    <Section
      id="bureau"
      title="Mon bureau"
      action={
        <span className="flex items-center gap-2 text-sm font-bold">
          <Slots used={used} limit={desk.limit} />
          <span>
            {used}/{desk.limit} places
          </span>
        </span>
      }
    >
      {desk.full ? (
        <Callout icon="🗂️" tone="warning">
          <p role="status" className="font-bold">
            Bureau plein : terminez ou passez une tâche avant d&apos;en commencer une autre
          </p>
          <p className="text-muted-foreground">
            Une tâche bloquée occupe une place. Au-delà, un motif visible de tous est demandé.
          </p>
        </Callout>
      ) : null}
      {used ? (
        <ul className="flex flex-col">
          {desk.tasks.map((t) => (
            <li key={t.id} className={rowClass}>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/taches/${t.id}`} className="min-w-0 font-bold break-words hover:underline">
                  {t.title}
                </Link>
                <TaskStatusBadge status={t.status} />
                <span className="text-[13px] text-muted-foreground">{t.project.name}</span>
                {t.dueDate ? <Meta icon={CalendarDays}>{formatDay(t.dueDate)}</Meta> : null}
              </div>
              {t.status === "BLOQUE" ? (
                <p className="text-sm text-danger">
                  Bloquée : {t.blockedReason ?? "raison non précisée"}
                  {t.blockedNextAction ? (
                    <span className="text-muted-foreground"> · Prochaine action : {t.blockedNextAction}</span>
                  ) : null}
                </p>
              ) : null}
              {t.wipOverrideReason ? (
                <p className="font-annotation text-sm text-pen-strong">
                  Motif de dépassement : {t.wipOverrideReason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>
          Bureau libre : passez une tâche « En cours » ou prenez-en une dans « À prendre ».
        </EmptyLine>
      )}
    </Section>
  );
}

// ─── Passations ─────────────────────────────────────────────────────────────

function HandoffObject({ h }: { h: PendingHandoff }) {
  if (h.task)
    return (
      <span className="min-w-0">
        <Link href={`/taches/${h.task.id}`} className="font-bold break-words hover:underline">
          {h.task.title}
        </Link>
        <span className="text-[13px] text-muted-foreground"> · tâche · {h.task.project.name}</span>
      </span>
    );
  if (h.opportunity)
    return (
      <span className="min-w-0">
        <Link
          href={`/crm/opportunites/${h.opportunity.id}`}
          className="font-bold break-words hover:underline"
        >
          {h.opportunity.title}
        </Link>
        <span className="text-[13px] text-muted-foreground"> · client · {h.opportunity.client.name}</span>
      </span>
    );
  return null;
}

/** Date de prochaine action à préremplir : une date passée (relance en retard) est à refixer. */
const upcomingDateInput = (date: Date | null | undefined) =>
  date && date >= todayDate() ? toDateInput(date) : "";

export function HandoffsSection({ received, sent }: { received: PendingHandoff[]; sent: PendingHandoff[] }) {
  return (
    <Section id="passations" title="Passations" count={received.length + sent.length}>
      {!received.length && !sent.length ? <EmptyLine>Aucune passation en attente.</EmptyLine> : null}
      {received.length ? (
        <div className="flex flex-col gap-1">
          <h3 className="px-1 text-sm font-bold text-muted-foreground">Reçues</h3>
          <ul className="flex flex-col">
            {received.map((h) => (
              <li key={h.id} className={rowClass}>
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={h.from.name} className="size-6" />
                    <b>{h.from.name}</b>
                  </span>
                  <span>{h.mode === "DONNER" ? "vous propose" : "propose de reprendre"}</span>
                  <HandoffObject h={h} />
                </p>
                {h.note ? <p className="text-sm whitespace-pre-line">« {h.note} »</p> : null}
                <p className="text-xs text-muted-foreground">
                  Proposée le {formatDateTime(h.createdAt)}
                  {h.mode === "REPRENDRE"
                    ? " · en acceptant, vous la cédez"
                    : " · en acceptant, elle devient la vôtre"}
                </p>
                <HandoffAnswerForm
                  handoffId={h.id}
                  title={h.task?.title ?? h.opportunity?.title ?? ""}
                  isOpportunity={!!h.opportunity}
                  nextAction={h.opportunity?.nextAction ?? ""}
                  nextActionDate={upcomingDateInput(h.opportunity?.nextActionDate)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {sent.length ? (
        <div className="flex flex-col gap-1">
          <h3 className="px-1 text-sm font-bold text-muted-foreground">Envoyées</h3>
          <ul className="flex flex-col">
            {sent.map((h) => (
              <li key={h.id} className={cn(rowClass, "sm:flex-row sm:items-center sm:justify-between")}>
                <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                  <HandoffObject h={h} />
                  <span className="text-sm text-muted-foreground">
                    {h.mode === "DONNER" ? `proposée à ${h.to.name}` : `reprise demandée à ${h.to.name}`}
                  </span>
                </p>
                <CancelHandoffForm handoffId={h.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

// ─── L'équipe aujourd'hui ───────────────────────────────────────────────────

function PresenceChip({ presence }: { presence: PresenceInfo }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span aria-hidden="true" className={cn("size-2 rounded-full", presenceDot[presence.state])} />
      {presenceText(presence)}
      {presence.note ? <span className="text-muted-foreground">· {presence.note}</span> : null}
    </span>
  );
}

export function TeamSection({ team }: { team: Awaited<ReturnType<typeof teamToday>> }) {
  return (
    <Section id="equipe" title="L'équipe aujourd'hui">
      <ul className="flex flex-col">
        {team.map((a) => {
          const overloaded = a.loadPct > 100;
          return (
            <li key={a.id} className={rowClass}>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-2 font-bold">
                  <Avatar name={a.name} />
                  {a.name}
                  {a.self ? <span className="text-xs font-normal text-muted-foreground">(moi)</span> : null}
                </span>
                <PresenceChip presence={a.presence} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <Slots used={a.desk} limit={a.limit} />
                  {a.desk}/{a.limit} places
                </span>
                <span className={cn(overloaded ? "font-bold text-danger" : "text-muted-foreground")}>
                  Charge {a.loadPct} %{overloaded ? " · pile qui déborde" : ""}
                </span>
              </div>
              {a.standup ? (
                <div className="flex flex-col gap-1 text-sm">
                  {a.standup.today ? (
                    <p className="whitespace-pre-line">
                      <span className="font-bold">Aujourd&apos;hui : </span>
                      {a.standup.today}
                    </p>
                  ) : null}
                  {a.standup.blocked ? (
                    <p className="whitespace-pre-line text-danger">
                      <span className="font-bold">Bloqué : </span>
                      {a.standup.blocked}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore de stand-up aujourd&apos;hui.</p>
              )}
              {!a.self && a.standup?.blocked ? (
                <div>
                  <Link
                    href={`/discussions/direct/${a.id}`}
                    className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border-2 border-ink px-3 text-sm font-bold hover:bg-highlight/60"
                  >
                    <MessageCircleHeart aria-hidden="true" className="size-4" /> Proposer mon aide
                  </Link>
                </div>
              ) : null}
              {!a.self && overloaded && a.notStarted.length ? (
                <Toggle
                  title="Proposer de reprendre"
                  meta={`${a.notStarted.length} non commencée${a.notStarted.length > 1 ? "s" : ""}`}
                >
                  <ul className="flex flex-col">
                    {a.notStarted.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 border-b py-2 last:border-b-0">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Link href={`/taches/${t.id}`} className="font-bold break-words hover:underline">
                            {t.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {t.project.name}
                            {t.dueDate ? ` · ${formatDay(t.dueDate)}` : ""}
                          </span>
                        </span>
                        <QuickReprendreButton taskId={t.id} title={t.title} />
                      </li>
                    ))}
                  </ul>
                </Toggle>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ─── À prendre ──────────────────────────────────────────────────────────────

export function ToTakeSection({ toTake }: { toTake: Awaited<ReturnType<typeof tasksToTake>> }) {
  const today = todayDate();
  return (
    <Section
      id="a-prendre"
      title="À prendre"
      count={toTake.total}
      action={
        toTake.total > toTake.tasks.length ? (
          <Link href="/taches?vue=equipe" className="text-sm font-bold text-pen-strong hover:underline">
            Tout voir
          </Link>
        ) : undefined
      }
    >
      {toTake.tasks.length ? (
        <ul className="flex flex-col">
          {toTake.tasks.map((t) => {
            const late = t.dueDate && t.dueDate < today;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-md border-b px-1 py-2.5 last:border-b-0 hover:bg-muted/60"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/taches/${t.id}`} className="font-bold break-words hover:underline">
                    {t.title}
                  </Link>
                  <span className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
                    <span>{t.project.name}</span>
                    {t.dueDate ? (
                      <Meta icon={CalendarDays} tone={late ? "danger" : undefined}>
                        {late ? "En retard · " : ""}
                        {formatDay(t.dueDate)}
                      </Meta>
                    ) : null}
                    <Meta icon={Clock}>
                      {t.estimatedMinutes ? formatMinutes(t.estimatedMinutes) : "Sans estimation"}
                    </Meta>
                  </span>
                </span>
                <TakeTaskButton taskId={t.id} title={t.title} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>Aucune tâche sans responsable : le tas est vide.</EmptyLine>
      )}
    </Section>
  );
}

// ─── Quêtes de la semaine ───────────────────────────────────────────────────

const questLinks: Partial<Record<QuestKey, { href: string; label: string }>> = {
  "zero-relance": { href: "/crm", label: "Voir le CRM" },
  "rien-bloque": { href: "/taches?vue=equipe", label: "Voir les tâches" },
  "passations-traitees": { href: "#passations", label: "Mes passations" },
};

export function QuestsSection({
  period,
  quests,
  badges,
  history,
}: {
  period: string;
  quests: QuestView[];
  badges: { key: string; period: string }[];
  history: { key: string; period: string }[];
}) {
  const earned = new Set(badges.map((b) => b.key));
  return (
    <Section
      id="quetes"
      title="Quêtes de la semaine"
      action={<span className="text-sm text-muted-foreground">Semaine {period.split("-W")[1]}</span>}
    >
      <p className="px-1 text-sm text-muted-foreground">
        Objectifs d&apos;équipe, jamais individuels : seul ce qui est fini compte.
      </p>
      <ul className="flex flex-col">
        {quests.map((q) => {
          const won = earned.has(q.key);
          const link = questLinks[q.key];
          return (
            <li key={q.key} className="flex flex-col gap-1.5 border-b px-1 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{q.label}</span>
                {won ? (
                  <StatusBadge tone="success" label="Badge gagné" />
                ) : q.achieved && q.state ? (
                  <span className="text-xs text-muted-foreground">En bonne voie · badge vendredi 17 h</span>
                ) : null}
              </div>
              <div
                role="progressbar"
                aria-label={q.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={q.percent}
                aria-valuetext={q.detail}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn("h-full", q.achieved ? "bg-success" : "bg-ink")}
                  style={{ width: `${q.percent}%` }}
                />
              </div>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                {q.detail}
                {!q.achieved && link ? (
                  <Link href={link.href} className="font-bold text-pen-strong hover:underline">
                    {link.label}
                  </Link>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-sm font-bold text-muted-foreground">Badges d&apos;équipe</h3>
        {badges.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Badges de la semaine">
            {badges.map((b) => (
              <li
                key={b.key}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 border-ink bg-highlight/60 px-3 text-sm font-bold"
              >
                <Handshake aria-hidden="true" className="size-4" />
                {badgeLabels[b.key as QuestKey] ?? b.key}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun badge encore cette semaine.</p>
        )}
        {history.length ? (
          <Toggle
            title="Semaines précédentes"
            meta={`${history.length} badge${history.length > 1 ? "s" : ""}`}
          >
            <ul className="flex flex-col gap-1 text-sm">
              {history.map((b) => (
                <li key={`${b.key}-${b.period}`}>
                  <span className="text-muted-foreground">Semaine {b.period.split("-W")[1]} · </span>
                  {badgeLabels[b.key as QuestKey] ?? b.key}
                </li>
              ))}
            </ul>
          </Toggle>
        ) : null}
      </div>
    </Section>
  );
}
