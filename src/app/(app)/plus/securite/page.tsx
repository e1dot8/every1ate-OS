import type { Metadata } from "next";
import { Suspense } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { describeDevice, formatLastActive, isMobileDevice } from "@/lib/auth/devices";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { revokeOtherSessionsAction, revokeSessionAction } from "../actions";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Sécurité" };

async function Devices() {
  const user = await requireUser();
  const sessions = await getDb().session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userAgent: true, updatedAt: true },
  });
  const others = sessions.filter((s) => s.id !== user.sessionId);

  return (
    <Card className="gap-1">
      <CardHeader className="mb-2">
        <CardTitle>Appareils connectés</CardTitle>
        <CardDescription>Déconnectez un appareil perdu ou que vous n&apos;utilisez plus.</CardDescription>
      </CardHeader>
      <ul className="flex flex-col" aria-label="Appareils connectés">
        {sessions.map((session) => {
          const Icon = isMobileDevice(session.userAgent) ? Smartphone : Monitor;
          const current = session.id === user.sessionId;
          return (
            <li
              key={session.id}
              className="flex items-center gap-3 border-b py-3 last:border-b-0"
              data-testid="session-row"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{describeDevice(session.userAgent)}</span>
                <span className="text-sm text-muted-foreground">
                  {current ? "actif maintenant" : formatLastActive(session.updatedAt)}
                </span>
              </div>
              {current ? (
                <StatusBadge tone="success" label="Cet appareil" />
              ) : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <SubmitButton variant="ghost" pendingLabel="…">
                    Déconnecter
                  </SubmitButton>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 ? (
        <form action={revokeOtherSessionsAction} className="pt-3">
          <SubmitButton variant="destructive" pendingLabel="Déconnexion…">
            Déconnecter les autres appareils
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader crumb="Plus › Sécurité" title="Sécurité" />
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Mot de passe</CardTitle>
            <CardDescription>Le changer déconnecte vos autres appareils.</CardDescription>
          </CardHeader>
          <ChangePasswordForm />
        </Card>
        <Suspense fallback={<PageLoading />}>
          <Devices />
        </Suspense>
      </div>
    </div>
  );
}
