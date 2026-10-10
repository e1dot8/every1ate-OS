"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, Files, Layers, Plus, X } from "lucide-react";
import { Annotation } from "@/components/ui/annotation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, Textarea } from "@/components/ui/select";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { formatDay, parseDateInput, toDateInput } from "@/lib/dates";
import { TEMPLATES, planTemplate } from "@/features/projects/templates";
import { createProjectAction } from "@/app/(app)/projets/actions";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };
type DraftTask = {
  key: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  after: string | null;
  keep: boolean;
};
type DraftLot = { key: string; name: string; keep: boolean; tasks: DraftTask[] };

let seq = 0;
const nextKey = () => `k${++seq}`;

export function ProjectWizard({
  associates,
  clients,
  currentUserId,
  today,
  initial,
  opportunityId,
}: {
  associates: Opt[];
  clients: Opt[];
  currentUserId: string;
  today: string;
  /** Préremplissage (conversion depuis le CRM). */
  initial?: { name: string; clientId: string; description: string };
  opportunityId?: string;
}) {
  const [step, setStep] = useState(1);
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [info, setInfo] = useState({
    name: initial?.name ?? "",
    clientId: initial?.clientId ?? "",
    newClientName: "",
    ownerId: currentUserId,
    startDate: today,
    description: initial?.description ?? "",
  });
  const [lots, setLots] = useState<DraftLot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, action] = useActionState(createProjectAction, initialFormState);

  const plan = useMemo(() => {
    const start = parseDateInput(info.startDate);
    const tpl = TEMPLATES.find((t) => t.key === templateKey)!;
    return start ? planTemplate(tpl, start) : null;
  }, [templateKey, info.startDate]);

  function goToStructure() {
    if (!info.name.trim()) return setError("Indiquez le nom du projet.");
    if (!info.ownerId) return setError("Choisissez le responsable global.");
    if (!plan) return setError("Indiquez une date de début valide.");
    setError(null);
    setLots(
      plan.lots.map((l) => ({
        key: nextKey(),
        name: l.name,
        keep: true,
        tasks: l.tasks.map((t) => ({
          key: nextKey(),
          title: t.title,
          startDate: toDateInput(t.startDate),
          dueDate: toDateInput(t.dueDate),
          after: t.after ?? null,
          keep: true,
        })),
      })),
    );
    setStep(3);
  }

  const payload = JSON.stringify({
    ...info,
    clientId: info.clientId && info.clientId !== "__new" ? info.clientId : null,
    newClientName: info.clientId === "__new" ? info.newClientName : null,
    templateKey,
    plannedEndDate: null,
    opportunityId: opportunityId ?? null,
    lots: (lots ?? [])
      .filter((l) => l.keep && l.name.trim())
      .map((l) => ({
        name: l.name,
        tasks: l.tasks
          .filter((t) => t.keep && t.title.trim())
          .map(({ title, startDate, dueDate, after }) => ({ title, startDate, dueDate, after })),
      })),
  });

  const update = (lotKey: string, fn: (l: DraftLot) => DraftLot) =>
    setLots((all) => all!.map((l) => (l.key === lotKey ? fn(l) : l)));

  return (
    <div className="flex flex-col gap-6">
      <p className="font-annotation text-sm text-pen-strong">
        {opportunityId ? "Conversion en projet" : "Nouveau projet"} · étape {step}/3
      </p>

      {step === 1 ? (
        <section className="flex flex-col gap-5" aria-labelledby="titre-etape">
          <header className="flex flex-col gap-1.5">
            <h1 id="titre-etape" className="text-3xl font-bold tracking-tight md:text-4xl">
              Choisir un modèle
            </h1>
            <p className="text-muted-foreground">
              Lots, tâches types, durées et checklist de clôture sont créés pour vous.
            </p>
          </header>
          <div role="radiogroup" aria-label="Modèle" className="grid gap-3 md:grid-cols-2">
            {TEMPLATES.map((t) => {
              const tasks = t.lots.reduce((n, l) => n + l.tasks.length, 0);
              const selected = templateKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplateKey(t.key)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left",
                    selected && "border-2 border-ink",
                  )}
                >
                  <span className="flex items-center gap-2 font-bold">
                    {t.lots.length ? (
                      <Layers aria-hidden="true" className="size-5" />
                    ) : (
                      <Files aria-hidden="true" className="size-5" />
                    )}
                    <span className="flex-1">{t.name}</span>
                    {selected ? <CheckCircle2 aria-hidden="true" className="size-5 text-pen" /> : null}
                  </span>
                  <Annotation>
                    {t.lots.length ? `${t.lots.length} lots · ${tasks} tâches` : "Aucun lot"}
                  </Annotation>
                  <span className="text-sm text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>
          <div>
            <Button type="button" onClick={() => setStep(2)}>
              Continuer
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-5" aria-labelledby="titre-etape">
          <h1 id="titre-etape" className="text-3xl font-bold tracking-tight md:text-4xl">
            Informations
          </h1>
          {error ? <FormAlert tone="danger" title={error} /> : null}
          <Card className="max-w-2xl">
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-name">Nom du projet</Label>
              <Input
                id="w-name"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-client">Client</Label>
              <Select
                id="w-client"
                value={info.clientId}
                onChange={(e) => setInfo({ ...info, clientId: e.target.value })}
              >
                <option value="">Aucun client</option>
                {clients.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
                <option value="__new">+ Nouveau client…</option>
              </Select>
              {info.clientId === "__new" ? (
                <Input
                  aria-label="Nom du nouveau client"
                  placeholder="Nom du client"
                  value={info.newClientName}
                  onChange={(e) => setInfo({ ...info, newClientName: e.target.value })}
                />
              ) : null}
              <p className="text-sm text-muted-foreground">Fiche client complète dans le CRM.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-owner">Responsable global</Label>
              <Select
                id="w-owner"
                value={info.ownerId}
                onChange={(e) => setInfo({ ...info, ownerId: e.target.value })}
              >
                {associates.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
              <p className="text-sm text-muted-foreground">
                Obligatoire. Remplaçable ensuite, avec motif journalisé.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-start">Date de début</Label>
              <Input
                id="w-start"
                type="date"
                value={info.startDate}
                onChange={(e) => setInfo({ ...info, startDate: e.target.value })}
              />
              {plan && plan.lots.length ? (
                <p className="text-sm text-muted-foreground">
                  Fin prévue calculée : {formatDay(plan.plannedEnd)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-desc">Description (facultatif)</Label>
              <Textarea
                id="w-desc"
                rows={3}
                value={info.description}
                onChange={(e) => setInfo({ ...info, description: e.target.value })}
              />
            </div>
          </Card>
          <div className="flex gap-3">
            <Button type="button" onClick={goToStructure}>
              Voir la structure
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Retour
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 && lots ? (
        <form action={action} className="flex flex-col gap-5" aria-labelledby="titre-etape">
          <header className="flex flex-col gap-1.5">
            <h1 id="titre-etape" className="text-3xl font-bold tracking-tight md:text-4xl">
              Structure du projet
            </h1>
            <p className="text-muted-foreground">
              Retirez, ajoutez ou renommez avant de créer. Dates calculées depuis le{" "}
              {formatDay(parseDateInput(info.startDate))}.
            </p>
          </header>
          {state.status === "error" && state.message ? (
            <FormAlert tone="danger" title={state.message} />
          ) : null}
          {lots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Projet vierge : vous ajouterez lots et tâches depuis la fiche projet.
            </p>
          ) : null}
          {lots.map((lot) => (
            <Card key={lot.key} className={cn("gap-1", !lot.keep && "opacity-50")}>
              <div className="flex items-center gap-2">
                <Layers aria-hidden="true" className="size-5 shrink-0" />
                <Input
                  aria-label="Nom du lot"
                  value={lot.name}
                  disabled={!lot.keep}
                  onChange={(e) => update(lot.key, (l) => ({ ...l, name: e.target.value }))}
                  className="font-bold"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={lot.keep ? `Retirer le lot ${lot.name}` : `Rétablir le lot ${lot.name}`}
                  onClick={() => update(lot.key, (l) => ({ ...l, keep: !l.keep }))}
                >
                  {lot.keep ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </Button>
              </div>
              {lot.keep ? (
                <ul className="flex flex-col">
                  {lot.tasks.map((t) => (
                    <li
                      key={t.key}
                      className={cn("flex items-center gap-2 py-1 pl-7", !t.keep && "opacity-50")}
                    >
                      <Input
                        aria-label="Titre de la tâche"
                        value={t.title}
                        disabled={!t.keep}
                        onChange={(e) =>
                          update(lot.key, (l) => ({
                            ...l,
                            tasks: l.tasks.map((x) =>
                              x.key === t.key ? { ...x, title: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <span className="hidden w-28 shrink-0 font-annotation text-xs text-muted-foreground md:inline">
                        {t.startDate
                          ? `${formatDay(parseDateInput(t.startDate))} → ${formatDay(parseDateInput(t.dueDate))}`
                          : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t.keep ? `Retirer ${t.title}` : `Rétablir ${t.title}`}
                        onClick={() =>
                          update(lot.key, (l) => ({
                            ...l,
                            tasks: l.tasks.map((x) => (x.key === t.key ? { ...x, keep: !x.keep } : x)),
                          }))
                        }
                      >
                        {t.keep ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
                      </Button>
                    </li>
                  ))}
                  <li className="pl-7">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-pen-strong"
                      onClick={() =>
                        update(lot.key, (l) => ({
                          ...l,
                          tasks: [
                            ...l.tasks,
                            {
                              key: nextKey(),
                              title: "Nouvelle tâche",
                              startDate: null,
                              dueDate: null,
                              after: null,
                              keep: true,
                            },
                          ],
                        }))
                      }
                    >
                      <Plus aria-hidden="true" /> Ajouter une tâche
                    </Button>
                  </li>
                </ul>
              ) : null}
            </Card>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLots([...lots, { key: nextKey(), name: "Nouveau lot", keep: true, tasks: [] }])
              }
            >
              <Plus aria-hidden="true" /> Ajouter un lot
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            La checklist de clôture (6 points) est créée avec le projet.
          </p>
          <input type="hidden" name="payload" value={payload} />
          <div className="flex gap-3">
            <SubmitButton pendingLabel="Création…">Créer le projet</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Retour
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
