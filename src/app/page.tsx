import Link from "next/link";
import { Suspense } from "react";
import { FoundationStatus, FoundationStatusFallback } from "@/components/foundation/foundation-status";
import { Annotation } from "@/components/ui/annotation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const roadmap = [
  {
    lot: 1,
    title: "Design system et authentification",
    detail: "Connexion des trois associés avec MFA, permissions serveur, audit.",
  },
  {
    lot: 2,
    title: "Projets, lots et tâches",
    detail: "Phases, statuts, responsables, modèles, dépendances.",
  },
  { lot: 3, title: "Roadmap et suivi du temps", detail: "Gantt, chronomètre, priorités, alertes de retard." },
  { lot: 4, title: "CRM", detail: "Pipeline, relances, conversion en projet." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Badge variant="highlight">Socle technique · lot 0</Badge>
        <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">
          La cuisine de l&apos;agence <span className="highlight">se met en place</span>.
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Every1.ate OS réunira projets, CRM, finance, temps et calendrier dans une seule source de vérité. Ce
          socle valide le déploiement, la base de données et le design system.
        </p>
        <Annotation>{"// aucune donnée métier à ce stade"}</Annotation>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>État du socle</CardTitle>
          <CardDescription>Contrôle effectué en direct à chaque chargement.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FoundationStatusFallback />}>
            <FoundationStatus />
          </Suspense>
        </CardContent>
      </Card>

      <section aria-labelledby="prochains-lots" className="flex flex-col gap-4">
        <h2 id="prochains-lots" className="text-xl font-bold">
          Prochains lots
        </h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {roadmap.map((step) => (
            <li key={step.lot}>
              <Card className="h-full gap-2">
                <p className="font-annotation text-sm text-pen-strong">Lot {step.lot}</p>
                <p className="font-bold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.detail}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <div>
        <Button asChild variant="outline">
          <Link href="/design">Voir le design system</Link>
        </Button>
      </div>
    </div>
  );
}
