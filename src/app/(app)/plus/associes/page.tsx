import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { resendInvitationAction } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Associés" };

async function Members() {
  await requireUser();
  const db = getDb();
  const now = new Date();
  const [users, invitations] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } }),
    db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, expiresAt: true },
    }),
  ]);
  const memberEmails = new Set(users.map((u) => u.email));
  const pending = invitations.filter((i) => !memberEmails.has(i.email));

  return (
    <Card className="gap-0 py-1">
      <ul aria-label="Associés">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{user.name}</span>
              <span className="truncate text-sm text-muted-foreground">{user.email}</span>
            </div>
            <StatusBadge tone="success" label="Actif" />
          </li>
        ))}
        {pending.map((invitation) => {
          const expired = invitation.expiresAt <= now;
          return (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{invitation.name}</span>
                <span className="truncate text-sm text-muted-foreground">{invitation.email}</span>
              </div>
              <StatusBadge
                tone={expired ? "danger" : "warning"}
                label={expired ? "Invitation expirée" : "Invitation envoyée"}
              />
              <form action={resendInvitationAction}>
                <input type="hidden" name="invitationId" value={invitation.id} />
                <SubmitButton variant="ghost" pendingLabel="Envoi…">
                  Renvoyer
                </SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumb="Plus › Associés"
        title="Associés"
        description="Les associés ont des droits équivalents."
      />
      <Suspense fallback={<PageLoading />}>
        <Members />
      </Suspense>
      <Card className="md:max-w-lg">
        <CardHeader>
          <CardTitle>Inviter un associé</CardTitle>
          <CardDescription>
            Le lien reçu par e-mail est valable 72 heures. Chaque invitation est journalisée.
          </CardDescription>
        </CardHeader>
        <InviteForm />
      </Card>
    </div>
  );
}
