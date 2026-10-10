import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { FeedForm } from "@/features/calendar/components/feed-form";
import { getFeed } from "@/features/calendar/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { deleteFeedAction } from "../actions";

export const metadata: Metadata = { title: "Abonnement calendrier" };

async function Feed() {
  const user = await requireUser();
  const feed = await getFeed(user.id);
  return (
    <>
      <Card className="max-w-2xl gap-3">
        <CardTitle>Mon lien d&apos;abonnement</CardTitle>
        {feed ? (
          <p className="text-sm" data-testid="feed-status">
            Lien actif depuis le {formatDateTime(feed.createdAt)} ·{" "}
            {feed.lastAccessAt
              ? `dernière lecture par votre agenda : ${formatDateTime(feed.lastAccessAt)} (${feed.accessCount} au total)`
              : "pas encore lu par un agenda"}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun lien actif.</p>
        )}
        <FeedForm exists={!!feed} includeTasks={feed?.includeTasks ?? true} />
        {feed ? (
          <form action={deleteFeedAction}>
            <SubmitButton variant="ghost">Désactiver le lien</SubmitButton>
          </form>
        ) : null}
      </Card>
      <Card className="max-w-2xl gap-2 text-sm">
        <CardTitle>Ajouter à votre agenda</CardTitle>
        <p>
          <b>Google Agenda</b> (ordinateur) : Autres agendas → « + » → « À partir de l&apos;URL » → collez le
          lien.
        </p>
        <p>
          <b>Apple Calendrier</b> : Fichier → Nouvel abonnement → collez le lien. Sur iPhone : Réglages →
          Calendrier → Comptes → Ajouter un calendrier avec abonnement.
        </p>
        <CardTitle className="mt-2">Limites (à connaître)</CardTitle>
        <ul className="list-disc pl-5">
          <li>
            Lecture seule : un événement modifié dans Google ou Apple ne revient pas dans Every1.ate OS.
          </li>
          <li>
            Délai : Google relit les abonnements environ toutes les 8 à 24 h ; Apple selon votre réglage (5
            min à 1 semaine).
          </li>
          <li>
            Le lien est personnel et secret : toute personne qui le possède voit vos événements. Renouvelez-le
            en cas de doute.
          </li>
          <li>
            La synchronisation bidirectionnelle (API Google Calendar) n&apos;est pas encore disponible : elle
            sera étudiée après validation technique.
          </li>
        </ul>
      </Card>
    </>
  );
}

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/calendrier">Calendrier</BackLink>
      <PageHeader
        title="Google Agenda et Apple Calendrier"
        description="Abonnement ICS personnel, en lecture seule."
      />
      <Suspense fallback={<PageLoading />}>
        <Feed />
      </Suspense>
    </div>
  );
}
