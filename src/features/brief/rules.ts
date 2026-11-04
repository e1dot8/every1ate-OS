/**
 * Brief du jour (pur, sans IA) : les actions qui comptent aujourd'hui, classées.
 * Sert à Mon espace et au récapitulatif e-mail optionnel.
 */
export type BriefItem = { kind: string; severity: 1 | 2 | 3; title: string; detail?: string; href: string };

export type BriefInput = {
  overdueTasks: { id: string; title: string; dueDate: Date; project: string }[];
  dueToday: { id: string; title: string; project: string }[];
  blocked: { id: string; title: string; reason: string | null }[];
  followUps: { id: string; title: string; nextAction: string | null; late: boolean }[];
  meetings: { id: string; title: string; time: string }[];
  decisions: { id: string; title: string }[];
  lateBilling: { projectId: string; label: string; project: string }[];
  renewals: { href: string; title: string }[];
  /** Livrables dont je suis responsable, échéance dépassée (V1.2). */
  lateDeliverables?: { id: string; title: string; project: string; dueDate: Date }[];
  /** Livrables dont je suis responsable, à livrer aujourd'hui. */
  deliverablesDueToday?: { id: string; title: string; project: string }[];
  /** Points de checklist qui me sont confiés, dus aujourd'hui (ou déjà en retard). */
  checkItemsDue?: { deliverableId: string; deliverable: string; label: string; late: boolean }[];
};

export function buildBrief(i: BriefInput) {
  const items: BriefItem[] = [];
  for (const t of i.overdueTasks)
    items.push({
      kind: "retard",
      severity: 3,
      title: `En retard : ${t.title}`,
      detail: t.project,
      href: `/taches/${t.id}`,
    });
  for (const d of i.decisions)
    items.push({
      kind: "decision",
      severity: 3,
      title: `Votre avis est attendu : ${d.title}`,
      href: `/gouvernance/${d.id}`,
    });
  for (const b of i.lateBilling)
    items.push({
      kind: "facturation",
      severity: 3,
      title: `Encaissement en retard : ${b.label}`,
      detail: b.project,
      href: `/projets/${b.projectId}?onglet=finance`,
    });
  for (const t of i.blocked)
    items.push({
      kind: "blocage",
      severity: 2,
      title: `Bloquée : ${t.title}`,
      detail: t.reason ?? undefined,
      href: `/taches/${t.id}`,
    });
  for (const f of i.followUps)
    items.push({
      kind: "relance",
      severity: f.late ? 3 : 2,
      title: `Relance : ${f.title}`,
      detail: f.nextAction ?? undefined,
      href: `/crm/opportunites/${f.id}`,
    });
  for (const m of i.meetings)
    items.push({
      kind: "reunion",
      severity: 1,
      title: `${m.time} · ${m.title}`,
      href: `/calendrier/${m.id}`,
    });
  for (const t of i.dueToday)
    items.push({
      kind: "echeance",
      severity: 2,
      title: `À rendre aujourd'hui : ${t.title}`,
      detail: t.project,
      href: `/taches/${t.id}`,
    });
  for (const r of i.renewals)
    items.push({ kind: "renouvellement", severity: 1, title: r.title, href: r.href });
  for (const d of i.lateDeliverables ?? [])
    items.push({
      kind: "livrable-retard",
      severity: 3,
      title: `Livrable en retard : ${d.title}`,
      detail: d.project,
      href: `/livrables/${d.id}`,
    });
  for (const d of i.deliverablesDueToday ?? [])
    items.push({
      kind: "livrable",
      severity: 2,
      title: `À livrer aujourd'hui : ${d.title}`,
      detail: d.project,
      href: `/livrables/${d.id}`,
    });
  for (const c of i.checkItemsDue ?? [])
    items.push({
      kind: "checklist",
      severity: c.late ? 3 : 2,
      title: `${c.late ? "Checklist en retard" : "Checklist du jour"} : ${c.label}`,
      detail: c.deliverable,
      href: `/livrables/${c.deliverableId}`,
    });
  items.sort((a, b) => b.severity - a.severity);
  const urgent = items.filter((x) => x.severity === 3).length;
  const summary = !items.length
    ? "Rien d'urgent aujourd'hui."
    : urgent
      ? `${urgent} point${urgent > 1 ? "s" : ""} urgent${urgent > 1 ? "s" : ""} sur ${items.length}.`
      : `${items.length} point${items.length > 1 ? "s" : ""} pour aujourd'hui, rien d'urgent.`;
  return { items, summary, urgent };
}
