import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon espace" };

const upcoming = [
  { title: "Mes tâches prioritaires", empty: "Vos tâches apparaîtront ici.", lot: 2 },
  { title: "Échéances à venir", empty: "Aucune échéance pour l'instant.", lot: 2 },
  { title: "Temps suivi cette semaine", empty: "Le chronomètre arrive bientôt.", lot: 3 },
];

function todayInParis(now = new Date()) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function Greeting() {
  const user = await requireUser();
  return <PageHeader title={`Bonjour ${user.name}`} description={todayInParis()} />;
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<PageLoading />}>
        <Greeting />
      </Suspense>
      <section aria-label="Mon espace" className="grid gap-4 md:grid-cols-3">
        {upcoming.map((block) => (
          <Card key={block.title} className="gap-2">
            <CardHeader>
              <CardTitle>{block.title}</CardTitle>
              <CardDescription>{block.empty}</CardDescription>
            </CardHeader>
            <p className="font-annotation text-sm text-pen-strong">{`// disponible au lot ${block.lot}`}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
