import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  FileSpreadsheet,
  Handshake,
  MessageSquare,
  OctagonAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Archive, Award, AtSign, HeartHandshake, PartyPopper, UtensilsCrossed } from "lucide-react";
import { Chip } from "@/components/app/bits";
import { listNotifications, unreadByTier, type CourrierView } from "@/features/notifications/service";
import { tierLabels, tierOf } from "@/features/notifications/tiers";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { archiveAction, markReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, LucideIcon> = {
  assignation: UserPlus,
  echeance: CalendarClock,
  retard: AlertTriangle,
  escalade: OctagonAlert,
  blocage: OctagonAlert,
  planning: CalendarClock,
  action: MessageSquare,
  relance: Handshake,
  import: FileSpreadsheet,
  mention: AtSign,
  commentaire: MessageSquare,
  aide: HeartHandshake,
  menu: UtensilsCrossed,
  badge: Award,
  felicitations: PartyPopper,
};

const VIEWS: { key: CourrierView; label: string; param?: string }[] = [
  { key: "TOUT", label: "Tout" },
  { key: "PRIORITAIRE", label: tierLabels.PRIORITAIRE, param: "prioritaire" },
  { key: "A_SUIVRE", label: tierLabels.A_SUIVRE, param: "a-suivre" },
  { key: "INFO", label: tierLabels.INFO, param: "info" },
  { key: "ARCHIVE", label: "Archivé", param: "archive" },
];

async function List({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.param && v.param === sp.vue) ?? VIEWS[0];
  const [items, counts] = await Promise.all([listNotifications(user.id, view.key), unreadByTier(user.id)]);
  const unread = items.filter((n) => !n.readAt).length;
  const read = items.some((n) => n.readAt);
  return (
    <>
      <nav aria-label="Filtrer les notifications" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const n = v.key in counts ? counts[v.key as keyof typeof counts] : 0;
          return (
            <Chip
              key={v.key}
              href={v.param ? `/notifications?vue=${v.param}` : "/notifications"}
              active={v.key === view.key}
            >
              {v.label}
              {n ? ` · ${n}` : ""}
            </Chip>
          );
        })}
      </nav>
      <div className="flex flex-wrap gap-2">
        {unread && view.key !== "ARCHIVE" ? (
          <form action={markReadAction}>
            <input type="hidden" name="id" value="all" />
            <SubmitButton variant="outline">Tout marquer comme lu ({unread})</SubmitButton>
          </form>
        ) : null}
        {read && view.key !== "ARCHIVE" ? (
          <form action={archiveAction}>
            <input type="hidden" name="id" value="lues" />
            <SubmitButton variant="ghost">Classer les lues</SubmitButton>
          </form>
        ) : null}
      </div>
      <Card className="gap-0 py-1">
        <ul>
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id} className="flex items-start gap-1 border-b last:border-b-0">
                <form action={markReadAction} className="min-w-0 flex-1">
                  <input type="hidden" name="id" value={n.id} />
                  {n.href ? <input type="hidden" name="href" value={n.href} /> : null}
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 py-3 text-left hover:bg-muted/60",
                      n.readAt && "opacity-60",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        ["retard", "escalade", "blocage"].includes(n.kind) && "text-danger",
                      )}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-bold">
                        {!n.readAt ? <span className="sr-only">Non lue : </span> : null}
                        {n.title}
                      </span>
                      {n.body ? <span className="text-sm text-muted-foreground">{n.body}</span> : null}
                      <span className="text-xs text-muted-foreground">
                        {tierLabels[tierOf(n.kind)]} · {formatDateTime(n.createdAt)}
                        {n.emailedAt ? " · envoyé par e-mail" : ""}
                      </span>
                    </span>
                    {!n.readAt ? (
                      <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-pen" />
                    ) : null}
                  </button>
                </form>
                {!n.archivedAt ? (
                  <form action={archiveAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      aria-label={`Classer « ${n.title} »`}
                      title="Classer"
                      className="mt-1.5 inline-flex size-tap items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink"
                    >
                      <Archive aria-hidden="true" className="size-4" />
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
          {!items.length ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {view.key === "ARCHIVE" ? "Rien d'archivé." : "Rien ici : tout est à jour."}
            </li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="Le courrier · ce qui attend votre attention"
        title="Notifications"
        description="Prioritaire : assignations, mentions, blocages, demandes. À suivre : commentaires, échéances, relances. Information : badges et félicitations, jamais comptés."
      />
      <Suspense fallback={<PageLoading />}>
        <List searchParams={searchParams as Promise<{ vue?: string }>} />
      </Suspense>
    </div>
  );
}
