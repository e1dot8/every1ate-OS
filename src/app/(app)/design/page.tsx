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
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { ROOM_ICONS } from "@/features/maison/room-icons";
import { DEFAULT_AVATAR } from "@/features/maison/cosmetics";
import { ROOMS } from "@/features/maison/rooms";

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
        <p className="text-muted-foreground">
          Tokens, composants et règles d&apos;Every1.ate OS (lot 0, révisé au lot G7).
        </p>
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

      <Section id="principes" title="Principes (lot G7)">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            [
              "80 / 20",
              "80 % interface fonctionnelle, 20 % univers et personnalité. Un garde-fou, pas une règle comptable.",
            ],
            [
              "Trois niveaux",
              "1. Le cockpit (par défaut) · 2. La maison (explorer) · 3. Les outils spécialisés.",
            ],
            [
              "La gamification au bon moment",
              "À la clôture d'une tâche, à l'obtention d'un badge, dans le profil, au bureau commun. Jamais un panneau permanent.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="border-t pt-3">
              <p className="font-bold">{t}</p>
              <p className="text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="usages-couleur" title="Usages de la couleur">
        <ul className="flex flex-col text-sm">
          {[
            [
              "bg-background border",
              "Fond blanc cassé",
              "Le fond de l'application ; les surfaces de travail restent blanches.",
            ],
            ["bg-ink", "Encre", "Textes, titres et zones importantes."],
            [
              "bg-highlight",
              "Jaune signature",
              "L'action prioritaire de l'écran, la sélection, les réussites. Jamais décoratif.",
            ],
            ["bg-pen", "Rouge stylo", "Annotations et alertes importantes, ponctuellement."],
          ].map(([cls, name, use]) => (
            <li key={name} className="flex items-center gap-3 border-b py-2">
              <span className={`size-6 shrink-0 rounded-sm ${cls}`} aria-hidden="true" />
              <b className="w-36 shrink-0">{name}</b>
              <span className="text-muted-foreground">{use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="editorial" title="Titres éditoriaux">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
            Bienvenue à la maison,
          </p>
          <p className="text-6xl leading-none font-bold tracking-[-0.04em]">Johan.</p>
          <p className="font-annotation text-sm text-pen-strong">une annotation, rarement.</p>
          <p className="text-sm text-muted-foreground">Texte fonctionnel : lisible, sobre, sans effet.</p>
        </div>
      </Section>

      <Section id="action-prioritaire" title="Action prioritaire et surfaces">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="highlight">Action prioritaire (une par écran)</Button>
          <Button>Action principale</Button>
          <Button variant="outline">Secondaire</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <b>Carte</b> : filet fin, coins de 8 px, aucune ombre. Peu de cartes par écran.
          </div>
          <div className="border-t pt-3 text-sm">
            <b>Séparation</b> : un filet suffit souvent, sans carte.
          </div>
        </div>
      </Section>

      <Section id="univers" title="Les détails de l'univers">
        <div className="flex flex-wrap items-center gap-4">
          {(["s2", "s4", "s6"] as const).map((skin, i) => (
            <BrigadeAvatar
              key={skin}
              size={56}
              look={{
                ...DEFAULT_AVATAR,
                skin,
                hat: ["toque", "bonnet", "casquette"][i],
                accessory: ["aucun", "lunettes", "moustache"][i],
              }}
            />
          ))}
          {ROOMS.map((r) => {
            const Icon = ROOM_ICONS[r.key];
            return (
              <span
                key={r.key}
                className="inline-flex items-center gap-2 rounded-md border bg-paper px-2.5 py-1.5 text-xs font-bold"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-sm bg-muted">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                {r.name}
              </span>
            );
          })}
        </div>
        <div className="inline-flex w-fit items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-paper">
          Tâche terminée. <b className="text-highlight">+25 XP</b>
        </div>
        <p className="text-sm text-muted-foreground">
          Avatars, icônes de pièces, badges et petites célébrations : la personnalité vit dans les détails et
          ne rivalise jamais avec le contenu.
        </p>
      </Section>
    </div>
  );
}
