"use client";

import { useActionState, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { FormMessages } from "@/components/forms/form-messages";
import { SelectField, TextareaField } from "@/components/forms/controls";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import {
  cancelImportAction,
  confirmImportAction,
  proposeBudgetAction,
  recordPaymentAction,
  requestDecisionAction,
  saveBillingAction,
  saveContractAction,
  saveCostAction,
  saveGovernanceAction,
  saveMappingAction,
  uploadImportAction,
  voteAction,
} from "@/app/(app)/finance/actions";
import {
  billingKindLabels,
  contractStatusLabels,
  costStatusLabels,
  pricingLabels,
} from "@/features/finance/labels";
import type { FieldDef } from "@/features/finance/import-rules";

type Opt = { value: string; label: string };
const opts = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-tap items-center gap-2 text-sm font-bold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-ink" />{" "}
      {label}
    </label>
  );
}

export function BudgetForm({
  projectId,
  lots,
  hasBudget,
}: {
  projectId: string;
  lots: Opt[];
  hasBudget: boolean;
}) {
  const [state, action] = useActionState(proposeBudgetAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      <SelectField
        name="workPackageId"
        label="Périmètre"
        defaultValue={v.workPackageId ?? ""}
        options={[{ value: "", label: "Projet entier" }, ...lots]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="revenue"
          label="Revenus prévus HT (€)"
          defaultValue={v.revenue}
          error={state.fieldErrors?.revenue}
        />
        <Field
          name="cost"
          label="Coûts prévus HT (€)"
          defaultValue={v.cost}
          error={state.fieldErrors?.cost}
        />
      </div>
      <SelectField
        name="pricingMode"
        label="Tarification"
        defaultValue={v.pricingMode ?? ""}
        options={[{ value: "", label: "Mixte / non précisée" }, ...opts(pricingLabels)]}
      />
      <TextareaField
        name="reason"
        label={hasBudget ? "Motif de la révision" : "Commentaire (facultatif)"}
        hint={
          hasBudget
            ? "Obligatoire pour une révision ; au-delà du seuil, une décision collective est demandée."
            : "Le premier budget saisi devient le budget initial de référence."
        }
        defaultValue={v.reason ?? ""}
      />
      <div>
        <SubmitButton>{hasBudget ? "Proposer la révision" : "Enregistrer le budget initial"}</SubmitButton>
      </div>
    </form>
  );
}

export type CostValues = { [key: string]: string | boolean | undefined; id?: string; rebillable?: boolean };

export function CostForm({ projectId, lots, cost }: { projectId: string; lots: Opt[]; cost?: CostValues }) {
  const [state, action] = useActionState(saveCostAction, initialFormState);
  const v = { ...cost, ...state.values } as Record<string, string | undefined>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      {cost?.id ? <input type="hidden" name="costId" value={cost.id} /> : null}
      <Field
        name="description"
        label="Description"
        defaultValue={v.description ?? ""}
        error={state.fieldErrors?.description}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Field name="supplier" label="Fournisseur" required={false} defaultValue={v.supplier ?? ""} />
        <Field name="category" label="Catégorie" required={false} defaultValue={v.category ?? ""} />
        <SelectField
          name="workPackageId"
          label="Lot"
          defaultValue={v.workPackageId ?? ""}
          options={[{ value: "", label: "Projet entier" }, ...lots]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField
          name="pricingMode"
          label="Nature"
          defaultValue={v.pricingMode ?? "FRAIS"}
          options={opts(pricingLabels)}
        />
        <Field
          name="quantity"
          label="Quantité"
          required={false}
          defaultValue={v.quantity ?? ""}
          error={state.fieldErrors?.quantity}
        />
        <Field
          name="unit"
          label="Unité"
          required={false}
          hint="jour, heure, forfait…"
          defaultValue={v.unit ?? ""}
        />
        <Field
          name="unitRate"
          label="Taux unitaire HT (€)"
          required={false}
          defaultValue={v.unitRate ?? ""}
          error={state.fieldErrors?.unitRate}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          name="amount"
          label="Montant HT (€)"
          defaultValue={v.amount ?? ""}
          error={state.fieldErrors?.amount}
        />
        <Field
          name="vatAmount"
          label="TVA (€)"
          required={false}
          defaultValue={v.vatAmount ?? ""}
          error={state.fieldErrors?.vatAmount}
        />
        <Field
          name="amountTTC"
          label="TTC (€)"
          required={false}
          defaultValue={v.amountTTC ?? ""}
          error={state.fieldErrors?.amountTTC}
        />
      </div>
      <SelectField
        name="status"
        label="Statut"
        defaultValue={v.status ?? "PREVU"}
        options={opts(costStatusLabels)}
        hint="Un coût engagé pèse sur la marge prévisionnelle dès maintenant, sans attendre le paiement."
      />
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Field
          name="committedAt"
          type="date"
          label="Engagement"
          required={false}
          defaultValue={v.committedAt ?? ""}
        />
        <Field
          name="invoiceDate"
          type="date"
          label="Facture"
          required={false}
          defaultValue={v.invoiceDate ?? ""}
        />
        <Field name="dueDate" type="date" label="Échéance" required={false} defaultValue={v.dueDate ?? ""} />
        <Field name="paidAt" type="date" label="Paiement" required={false} defaultValue={v.paidAt ?? ""} />
      </div>
      <Field
        name="documentRef"
        label="Justificatif (référence ou lien)"
        required={false}
        defaultValue={v.documentRef ?? ""}
      />
      <Check
        name="rebillable"
        label="Refacturable au client (n'est pas de la marge)"
        defaultChecked={state.values ? state.values.rebillable === "on" : cost?.rebillable}
      />
      <div>
        <SubmitButton>{cost?.id ? "Enregistrer" : "Ajouter le coût"}</SubmitButton>
      </div>
    </form>
  );
}

export function BillingForm({
  projectId,
  lots,
  billing,
}: {
  projectId: string;
  lots: Opt[];
  billing?: Partial<Record<string, string>> & { id?: string };
}) {
  const [state, action] = useActionState(saveBillingAction, initialFormState);
  const v = { ...billing, ...state.values } as Record<string, string | undefined>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      {billing?.id ? <input type="hidden" name="billingId" value={billing.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="label" label="Libellé" defaultValue={v.label ?? ""} error={state.fieldErrors?.label} />
        <SelectField
          name="kind"
          label="Type"
          defaultValue={v.kind ?? "ACOMPTE"}
          options={opts(billingKindLabels)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          name="amount"
          label="Montant HT (€)"
          defaultValue={v.amount ?? ""}
          error={state.fieldErrors?.amount}
        />
        <Field name="vatAmount" label="TVA (€)" required={false} defaultValue={v.vatAmount ?? ""} />
        <Field
          name="plannedDate"
          type="date"
          label="Date prévue"
          required={false}
          defaultValue={v.plannedDate ?? ""}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          name="status"
          label="Statut"
          defaultValue={v.status ?? "ATTENDU"}
          options={[
            { value: "ATTENDU", label: "Attendu" },
            { value: "FACTURE", label: "Facturé" },
            { value: "ANNULE", label: "Annulé" },
          ]}
          hint="Encaissé et en retard sont calculés à partir des encaissements et de la date."
        />
        <SelectField
          name="workPackageId"
          label="Lot"
          defaultValue={v.workPackageId ?? ""}
          options={[{ value: "", label: "Projet entier" }, ...lots]}
        />
        <Field
          name="invoicedAt"
          type="date"
          label="Date de facture"
          required={false}
          defaultValue={v.invoicedAt ?? ""}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="invoiceRef"
          label="Référence facture (outil externe)"
          required={false}
          defaultValue={v.invoiceRef ?? ""}
        />
        <Field
          name="invoiceUrl"
          label="Lien vers le PDF"
          required={false}
          defaultValue={v.invoiceUrl ?? ""}
          error={state.fieldErrors?.invoiceUrl}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        L&apos;outil ne génère pas de factures officielles : il suit les échéances et conserve les références.
      </p>
      <div>
        <SubmitButton>{billing?.id ? "Enregistrer" : "Ajouter l'échéance"}</SubmitButton>
      </div>
    </form>
  );
}

export function PaymentForm({
  projectId,
  billingMilestoneId,
  today,
}: {
  projectId: string;
  billingMilestoneId: string;
  today: string;
}) {
  const [state, action] = useActionState(recordPaymentAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="billingMilestoneId" value={billingMilestoneId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          name="amount"
          label="Montant encaissé (€)"
          defaultValue={v.amount}
          error={state.fieldErrors?.amount}
        />
        <Field
          name="receivedAt"
          type="date"
          label="Date d'encaissement"
          defaultValue={v.receivedAt ?? today}
          error={state.fieldErrors?.receivedAt}
        />
        <Field name="reference" label="Référence bancaire" required={false} defaultValue={v.reference} />
      </div>
      <div>
        <SubmitButton>Enregistrer l&apos;encaissement</SubmitButton>
      </div>
    </form>
  );
}

export function ContractForm({
  clients,
  projects,
  contract,
}: {
  clients: Opt[];
  projects: Opt[];
  contract?: Partial<Record<string, string>> & { id?: string };
}) {
  const [state, action] = useActionState(saveContractAction, initialFormState);
  const v = { ...contract, ...state.values } as Record<string, string | undefined>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {contract?.id ? <input type="hidden" name="contractId" value={contract.id} /> : null}
      <Field name="label" label="Libellé" defaultValue={v.label ?? ""} error={state.fieldErrors?.label} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          name="clientId"
          label="Client"
          defaultValue={v.clientId ?? ""}
          error={state.fieldErrors?.clientId}
          options={[{ value: "", label: "Choisir…" }, ...clients]}
        />
        <SelectField
          name="projectId"
          label="Projet lié (facultatif)"
          defaultValue={v.projectId ?? ""}
          options={[{ value: "", label: "Aucun" }, ...projects]}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          name="monthlyAmount"
          label="Montant mensuel HT (€)"
          defaultValue={v.monthlyAmount ?? ""}
          error={state.fieldErrors?.monthlyAmount}
        />
        <SelectField
          name="status"
          label="Statut"
          defaultValue={v.status ?? "ACTIF"}
          options={opts(contractStatusLabels)}
        />
        <Field
          name="durationMonths"
          type="number"
          label="Durée (mois)"
          required={false}
          defaultValue={v.durationMonths ?? ""}
          error={state.fieldErrors?.durationMonths}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Field
          name="startDate"
          type="date"
          label="Début"
          defaultValue={v.startDate ?? ""}
          error={state.fieldErrors?.startDate}
        />
        <Field name="endDate" type="date" label="Fin" required={false} defaultValue={v.endDate ?? ""} />
        <Field
          name="renewalDate"
          type="date"
          label="Renouvellement"
          required={false}
          defaultValue={v.renewalDate ?? ""}
        />
        <Field
          name="noticeDays"
          type="number"
          label="Préavis (jours)"
          required={false}
          defaultValue={v.noticeDays ?? ""}
          error={state.fieldErrors?.noticeDays}
        />
      </div>
      <TextareaField name="notes" label="Notes" defaultValue={v.notes ?? ""} />
      <div>
        <SubmitButton>{contract?.id ? "Enregistrer" : "Ajouter le contrat"}</SubmitButton>
      </div>
    </form>
  );
}

export function GovernanceForm({
  rules,
  associates,
}: {
  rules: {
    budgetOverrunPct: number | null;
    delayPct: number | null;
    delayMinDays: number | null;
    requiredApprovals: number;
    blocking: boolean;
  };
  associates: number;
}) {
  const [state, action] = useActionState(saveGovernanceAction, initialFormState);
  const v = state.values ?? {};
  const val = (k: keyof typeof rules) => v[k] ?? (rules[k] == null ? "" : String(rules[k]));
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <Field
        name="budgetOverrunPct"
        type="number"
        label="Dépassement de budget déclencheur (%)"
        required={false}
        hint="Vide = règle désactivée. Comparé au budget initial de référence."
        defaultValue={val("budgetOverrunPct")}
        error={state.fieldErrors?.budgetOverrunPct}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="delayPct"
          type="number"
          label="Retard majeur (% de la durée initiale)"
          required={false}
          defaultValue={val("delayPct")}
          error={state.fieldErrors?.delayPct}
        />
        <Field
          name="delayMinDays"
          type="number"
          label="et au moins (jours)"
          required={false}
          defaultValue={val("delayMinDays")}
          error={state.fieldErrors?.delayMinDays}
        />
      </div>
      <Field
        name="requiredApprovals"
        type="number"
        label={`Avis favorables requis (sur ${associates} associé${associates > 1 ? "s" : ""})`}
        hint="Règle de majorité/quorum à confirmer par les associés."
        defaultValue={val("requiredApprovals")}
        error={state.fieldErrors?.requiredApprovals}
      />
      <Check
        name="blocking"
        label="Bloquant : le changement n'est appliqué qu'après approbation"
        defaultChecked={state.values ? state.values.blocking === "on" : rules.blocking}
      />
      <div>
        <SubmitButton>Enregistrer les règles</SubmitButton>
      </div>
    </form>
  );
}

export function DecisionForm({ projects }: { projects: Opt[] }) {
  const [state, action] = useActionState(requestDecisionAction, initialFormState);
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <SelectField
        name="projectId"
        label="Projet"
        defaultValue={v.projectId ?? ""}
        error={state.fieldErrors?.projectId}
        options={[{ value: "", label: "Choisir…" }, ...projects]}
      />
      <Field name="title" label="Titre" defaultValue={v.title} error={state.fieldErrors?.title} />
      <TextareaField
        name="explanation"
        label="Changement proposé"
        defaultValue={v.explanation ?? ""}
        error={state.fieldErrors?.explanation}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextareaField name="before" label="Avant" defaultValue={v.before ?? ""} />
        <TextareaField name="after" label="Après" defaultValue={v.after ?? ""} />
      </div>
      <TextareaField
        name="consequences"
        label="Conséquences (budget, planning, équipe)"
        defaultValue={v.consequences ?? ""}
      />
      <div>
        <SubmitButton>Demander la décision</SubmitButton>
      </div>
    </form>
  );
}

export function VoteForm({ decisionId, current }: { decisionId: string; current?: string }) {
  const [state, action] = useActionState(voteAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="decisionId" value={decisionId} />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-bold">Mon avis</legend>
        {[
          ["POUR", "Pour"],
          ["CONTRE", "Contre"],
          ["ABSTENTION", "Abstention"],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-tap items-center gap-2">
            <input
              type="radio"
              name="choice"
              value={value}
              defaultChecked={(state.values?.choice ?? current) === value}
              className="size-5 accent-ink"
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      {state.fieldErrors?.choice ? <p className="text-sm text-danger">Choisissez un avis.</p> : null}
      <TextareaField
        name="comment"
        label="Commentaire (facultatif)"
        defaultValue={state.values?.comment ?? ""}
      />
      <div>
        <SubmitButton>Enregistrer mon avis</SubmitButton>
      </div>
    </form>
  );
}

export function UploadForm() {
  const [state, action] = useActionState(uploadImportAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <label htmlFor="fichier" className="text-sm font-bold">
        Fichier CSV ou Excel (.xlsx), 5 Mo maximum
      </label>
      <input
        id="fichier"
        name="file"
        type="file"
        accept=".csv,.txt,.xlsx"
        required
        className="min-h-tap rounded-lg border border-input p-2"
      />
      <p className="text-sm text-muted-foreground">
        La première ligne doit contenir les en-têtes. Rien n&apos;est importé avant votre confirmation.
      </p>
      <div>
        <SubmitButton pendingLabel="Lecture…">Lire le fichier</SubmitButton>
      </div>
    </form>
  );
}

export function MappingForm(props: {
  importId: string;
  kind: string | null;
  projectId: string | null;
  headers: string[];
  sample: string[][];
  fields: Record<"COUTS" | "ENCAISSEMENTS", FieldDef[]>;
  mapping: Record<string, number | null>;
  projects: Opt[];
}) {
  const [state, action] = useActionState(saveMappingAction, initialFormState);
  const [kind, setKind] = useState<"COUTS" | "ENCAISSEMENTS">(
    (state.values?.kind ?? props.kind ?? "COUTS") as "COUTS" | "ENCAISSEMENTS",
  );
  const columns = [
    { value: "", label: "— Ignorer —" },
    ...props.headers.map((h, i) => ({
      value: String(i),
      label: `${h || `Colonne ${i + 1}`} (ex. ${props.sample[0]?.[i] ?? "—"})`,
    })),
  ];
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="importId" value={props.importId} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="champ-kind">Type d&apos;import</Label>
          <Select
            id="champ-kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "COUTS" | "ENCAISSEMENTS")}
          >
            <option value="COUTS">Coûts / factures fournisseurs (Pennylane…)</option>
            <option value="ENCAISSEMENTS">Encaissements bancaires (Qonto…)</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            {props.kind
              ? "Détecté automatiquement d'après les en-têtes."
              : "Type non détecté : choisissez-le."}
          </p>
        </div>
        <SelectField
          name="projectId"
          label="Projet concerné"
          defaultValue={state.values?.projectId ?? props.projectId ?? ""}
          options={[{ value: "", label: "Choisir…" }, ...props.projects]}
        />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-bold">Correspondance des colonnes</legend>
        {props.fields[kind].map((f) => (
          <SelectField
            key={`${kind}-${f.key}`}
            name={`col_${f.key}`}
            label={`${f.label}${f.required ? " *" : ""}`}
            defaultValue={
              state.values?.[`col_${f.key}`] ??
              (props.mapping[f.key] != null ? String(props.mapping[f.key]) : "")
            }
            options={columns}
          />
        ))}
        <p className="text-xs text-muted-foreground">* obligatoire.</p>
      </fieldset>
      <div>
        <SubmitButton>Valider et prévisualiser</SubmitButton>
      </div>
    </form>
  );
}

export function ConfirmImportForm({
  importId,
  valid,
  duplicates,
}: {
  importId: string;
  valid: number;
  duplicates: number;
}) {
  const [state, action] = useActionState(confirmImportAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <input type="hidden" name="importId" value={importId} />
      {duplicates ? (
        <Check name="includeDuplicates" label={`Importer aussi les ${duplicates} doublon(s) potentiel(s)`} />
      ) : null}
      <Check
        name="confirm"
        label={`Je confirme l'import de ${valid} ligne(s) valide(s). Les données existantes ne sont pas modifiées.`}
      />
      <div>
        <SubmitButton pendingLabel="Import…">Confirmer l&apos;import</SubmitButton>
      </div>
    </form>
  );
}

export function CancelImportForm({ importId, draft }: { importId: string; draft: boolean }) {
  const [state, action] = useActionState(cancelImportAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessages state={state} />
      <input type="hidden" name="importId" value={importId} />
      <Field name="reason" label={draft ? "Motif de l'abandon" : "Motif de l'annulation"} />
      <p className="text-sm text-muted-foreground">
        {draft
          ? "Le brouillon est abandonné ; rien n'a été importé."
          : "Les lignes importées sont archivées (annulation logique), jamais supprimées."}
      </p>
      <div>
        <SubmitButton variant="destructive">{draft ? "Abandonner" : "Annuler l'import"}</SubmitButton>
      </div>
    </form>
  );
}
