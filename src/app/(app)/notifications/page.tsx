import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Handshake,
  MessageSquare,
  OctagonAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { listNotifications } from "@/features/notifications/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { markReadAction } from "./actions";

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
};

async function List() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      {unread ? (
        <form action={markReadAction}>
          <input type="hidden" name="id" value="all" />
          <SubmitButton variant="outline">Tout marquer comme lu ({unread})</SubmitButton>
        </form>
      ) : null}
      <Card className="gap-0 py-1">
        <ul>
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id} className="border-b last:border-b-0">
                <form action={markReadAction}>
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
                        {formatDateTime(n.createdAt)}
                        {n.emailedAt ? " · envoyé par e-mail" : ""}
                      </span>
                    </span>
                    {!n.readAt ? (
                      <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-pen" />
                    ) : null}
                  </button>
                </form>
              </li>
            );
          })}
          {!items.length ? (
            <li className="py-6 text-center text-sm text-muted-foreground">Aucune notification.</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        description="Assignations, échéances, retards (escalade au responsable global après 48 h), blocages, commentaires."
      />
      <Suspense fallback={<PageLoading />}>
        <List />
      </Suspense>
    </div>
  );
}
