import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Annotation } from "@/components/ui/annotation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Design system" };

const swatches = [
  { name: "Encre", token: "--ink", className: "bg-ink", usage: "Texte, actions principales" },
  { name: "Papier", token: "--paper", className: "bg-paper border", usage: "Fond" },
  { name: "Crème", token: "--cream", className: "bg-cream", usage: "Surfaces secondaires" },
  { name: "Stylo", token: "--pen", className: "bg-pen", usage: "Accents, annotations, focus" },
  { name: "Stylo foncé", token: "--pen-strong", className: "bg-pen-strong", usage: "Texte d'alerte" },
  { name: "Surligneur", token: "--highlight", className: "bg-highlight", usage: "Mise en avant éditoriale" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Page réservée aux associés connectés. */
async function Gate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}

export default function DesignSystemPage() {
  return (
    <Suspense>
      <Gate>
        <DesignSystem />
      </Gate>
    </Suspense>
  );
}

function DesignSystem() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Design system</h1>
        <p className="text-muted-foreground">Tokens et composants de base d&apos;Every1.ate OS (lot 0).</p>
      </header>

      <Section id="couleurs" title="Couleurs">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {swatches.map((swatch) => (
            <li key={swatch.token} className="flex flex-col gap-2">
              <span aria-hidden="true" className={`h-16 rounded-lg ${swatch.className}`} />
              <span className="text-sm font-bold">{swatch.name}</span>
              <code className="font-mono text-xs text-muted-foreground">{swatch.token}</code>
              <span className="text-xs text-muted-foreground">{swatch.usage}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="typographie" title="Typographie">
        <Card>
          <p className="text-3xl font-bold tracking-tight">Arimo — Titre 1</p>
          <p className="text-xl font-bold">Arimo — Titre 2</p>
          <p className="max-w-prose">
            Arimo — corps de texte. Lisible sur mobile, utilisé pour l&apos;interface, les formulaires et les
            tableaux. Une <span className="highlight">échéance importante</span> peut être surlignée.
          </p>
          <Annotation>Courier Prime — annotation éditoriale courte, jamais de long paragraphe.</Annotation>
        </Card>
      </Section>

      <Section id="boutons" title="Boutons">
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus aria-hidden="true" /> Créer
          </Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Secondaire</Button>
          <Button variant="secondary">Crème</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="destructive">Supprimer</Button>
          <Button variant="link">
            Lien <ArrowRight aria-hidden="true" />
          </Button>
          <Button disabled>Désactivé</Button>
        </div>
      </Section>

      <Section id="statuts" title="Statuts">
        <p className="text-sm text-muted-foreground">
          Couleur + pictogramme + texte : jamais la couleur seule.
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success" label="Terminé" />
          <StatusBadge tone="info" label="En cours" />
          <StatusBadge tone="warning" label="En attente" />
          <StatusBadge tone="danger" label="Bloqué" />
          <Badge variant="highlight">Échéance J-2</Badge>
          <Badge variant="outline">La cuisson</Badge>
        </div>
      </Section>

      <Section id="formulaires" title="Formulaires">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Exemple de champ</CardTitle>
            <CardDescription>Démonstration visuelle, aucune donnée n&apos;est envoyée.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-nom">Nom du projet</Label>
              <Input id="demo-nom" placeholder="Campagne printemps" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-erreur">Budget initial (€ HT)</Label>
              <Input
                id="demo-erreur"
                aria-invalid="true"
                aria-describedby="demo-erreur-msg"
                defaultValue="abc"
              />
              <p id="demo-erreur-msg" className="text-sm text-danger">
                Saisissez un montant numérique.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button">Enregistrer</Button>
          </CardFooter>
        </Card>
      </Section>
    </div>
  );
}
