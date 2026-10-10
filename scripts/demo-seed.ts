/**
 * Données de démonstration FICTIVES (preview, captures, formation). Base locale uniquement.
 *   DATABASE_URL=postgresql://…@localhost:5432/every1ate_demo pnpm demo:seed
 * Mot de passe des trois comptes de démonstration : affiché à la fin.
 */
import "dotenv/config";
import { addDays, todayDate } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { acceptInvitation, createInvitation } from "@/lib/auth/invitations";
import { zonedToUtc } from "@/features/calendar/rules";
import { addFile } from "@/features/documents/service";
import { changeStage, saveClient, saveContact, saveOpportunity, setNextAction } from "@/features/crm/service";
import { saveGovernance, vote } from "@/features/finance/governance";
import {
  proposeBudget,
  recordPayment,
  saveBilling,
  saveContract,
  saveCost,
} from "@/features/finance/service";
import { saveEvent } from "@/features/calendar/service";
import { runScheduledScan } from "@/features/notifications/service";
import { addComment, saveMilestone } from "@/features/planning/service";
import { changeTaskStatus, createProject, saveTask } from "@/features/projects/service";
import { TEMPLATES, planTemplate } from "@/features/projects/templates";
import { addManualEntry } from "@/features/time/service";

const PASSWORD = "Demo-Every1ate-2026!";
const db = getDb();
const today = todayDate();
const day = (n: number) => addDays(today, n);
const at = (n: number, hhmm: string) => zonedToUtc(`${day(n).toISOString().slice(0, 10)}T${hhmm}`)!;

async function associate(first: string) {
  const email = `${first.toLowerCase()}@demo.every1ate.test`;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const inv = await createInvitation({ email, name: first, actor: null });
  if (!inv.ok) throw new Error(`invitation ${first}`);
  const token = new URL(inv.url).pathname.split("/").pop()!;
  const ok = await acceptInvitation({ token, password: PASSWORD });
  if (!ok.ok) throw new Error(`activation ${first} : ${ok.error}`);
  return db.user.findUniqueOrThrow({ where: { email } });
}

async function project(
  name: string,
  templateKey: string,
  start: Date,
  owner: { id: string },
  clientId: string,
) {
  const tpl = TEMPLATES.find((t) => t.key === templateKey)!;
  const plan = planTemplate(tpl, start);
  const r = await createProject(
    {
      name,
      clientId,
      ownerId: owner.id,
      templateKey,
      startDate: start,
      lots: plan.lots.map((l) => ({
        name: l.name,
        tasks: l.tasks.map((t) => ({
          title: t.title,
          startDate: t.startDate,
          dueDate: t.dueDate,
          after: t.after,
        })),
      })),
    },
    owner,
  );
  if (!r.ok) throw new Error(r.error);
  return r.data.id;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    console.error("Refusé : les données de démonstration ne s'installent que sur une base locale.");
    process.exit(1);
  }
  if (await db.project.count()) {
    console.error(
      "Refusé : la base contient déjà des projets. Utilisez une base dédiée (ex. every1ate_demo).",
    );
    process.exit(1);
  }

  const johan = await associate("Johan");
  const charles = await associate("Charles");
  const pierre = await associate("Pierre");

  // ─── CRM ──────────────────────────────────────────────────────────────────
  const client = async (name: string, sector: string, contact: [string, string, string]) => {
    const c = await saveClient(
      null,
      {
        name,
        website: `https://${name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
        sector,
        address: "Paris",
        notes: null,
      },
      johan,
    );
    if (!c.ok) throw new Error(c.error);
    await saveContact(
      c.data.id,
      null,
      {
        firstName: contact[0],
        lastName: contact[1],
        role: contact[2],
        email: `${contact[0].toLowerCase()}@${name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
        phone: null,
        notes: null,
      },
      johan,
    );
    return c.data.id;
  };
  const solene = await client("Maison Solène", "Mode", ["Claire", "Dumas", "Directrice marketing"]);
  const brume = await client("Atelier Brume", "Cosmétique", ["Hugo", "Marin", "Fondateur"]);
  const lumen = await client("Café Lumen", "Restauration", ["Inès", "Roy", "Gérante"]);
  const nord = await client("Studio Nord", "Musique", ["Léo", "Garnier", "Label manager"]);
  const opp = async (
    title: string,
    clientId: string,
    owner: { id: string },
    amount: number,
    stage: Parameters<typeof changeStage>[1],
    next?: [string, number],
  ) => {
    const o = await saveOpportunity(
      null,
      {
        title,
        clientId,
        contactId: null,
        ownerId: owner.id,
        source: "RECOMMANDATION",
        amountCents: amount * 100,
        probability: null,
        expectedCloseDate: day(30),
        nextAction: null,
        nextActionDate: null,
      },
      owner,
    );
    if (!o.ok) throw new Error(o.error);
    if (stage !== "A_CONTACTER")
      await changeStage(
        o.data.id,
        stage,
        { lossReason: stage === "PERDU" ? "Budget reporté à l'an prochain" : null, note: null },
        owner,
      );
    if (next) await setNextAction(o.data.id, { nextAction: next[0], nextActionDate: day(next[1]) }, owner);
    return o.data.id;
  };
  await opp("Lancement gamme solaire", brume, charles, 28000, "PROPOSITION_ENVOYEE", [
    "Relancer sur la proposition V2",
    -2,
  ]);
  await opp("Identité visuelle boutique", solene, johan, 12500, "QUALIFICATION", ["Atelier de cadrage", 3]);
  await opp("Série de portraits", nord, pierre, 8000, "PREMIER_ECHANGE", ["Envoyer les références", 1]);
  await opp("Menu digital", lumen, charles, 4500, "NEGOCIATION", ["Valider le périmètre", 5]);
  await opp("Pop-up store été", solene, johan, 18000, "A_CONTACTER");
  await opp("Packaging coffret", brume, charles, 9000, "PERDU");
  const won = await opp("Clip « Nuit claire »", nord, pierre, 32000, "GAGNE");

  // ─── Projets ──────────────────────────────────────────────────────────────
  const p1 = await project(
    "Campagne printemps — Maison Solène",
    "campagne-creative",
    day(-20),
    johan,
    solene,
  );
  const p2 = await project("Clip « Nuit claire »", "production-audiovisuelle", day(-6), pierre, nord);
  const p3 = await project("Stratégie de marque — Café Lumen", "conseil-strategie", day(-35), charles, lumen);
  await db.opportunity.update({ where: { id: won }, data: { projectId: p2 } });
  await db.project.updateMany({ where: { id: { in: [p1, p2, p3] } }, data: { status: "ACTIF" } });
  await db.project.update({ where: { id: p1 }, data: { phase: "CUISSON" } });
  await db.project.update({ where: { id: p2 }, data: { phase: "PREPARATION" } });
  await db.project.update({ where: { id: p3 }, data: { phase: "DRESSAGE" } });

  const tasksOf = (projectId: string) =>
    db.task.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  const people = [johan, charles, pierre];
  for (const [i, pid] of [p1, p2, p3].entries()) {
    const tasks = await tasksOf(pid);
    for (const [j, t] of tasks.entries()) {
      const owner = people[(i + j) % 3];
      await db.task.update({
        where: { id: t.id },
        data: {
          ownerId: owner.id,
          estimatedMinutes: 120 + (j % 4) * 60,
          impact: j % 3 === 0 ? "FORT" : "MOYEN",
        },
      });
      if (t.dueDate && t.dueDate < day(-3))
        await changeTaskStatus(t.id, "TERMINE", { reason: null, nextAction: null, reviewDate: null }, owner);
      else if (t.startDate && t.startDate <= today)
        await changeTaskStatus(t.id, "EN_COURS", { reason: null, nextAction: null, reviewDate: null }, owner);
    }
  }
  const p1Tasks = await tasksOf(p1);
  const blocked = p1Tasks.find((t) => t.status === "EN_COURS");
  if (blocked)
    await changeTaskStatus(
      blocked.id,
      "BLOQUE",
      {
        reason: "En attente des visuels produits du client",
        nextAction: "Relancer Claire",
        reviewDate: day(2),
      },
      johan,
    );
  const late = p1Tasks.find((t) => t.status === "A_FAIRE");
  if (late) await db.task.update({ where: { id: late.id }, data: { dueDate: day(-4), startDate: day(-8) } });
  const extra = await saveTask(
    p1,
    null,
    {
      title: "Préparer la réunion de lancement",
      description: "Ordre du jour, planning, budget.",
      workPackageId: null,
      ownerId: johan.id,
      contributorIds: [charles.id],
      priority: "HAUTE",
      impact: "FORT",
      startDate: today,
      dueDate: day(1),
      estimatedMinutes: 90,
    },
    charles,
  );
  if (extra.ok)
    await addComment(extra.data.id, "J'ai ajouté le budget prévisionnel dans le dossier Drive.", charles);
  await saveMilestone(
    p1,
    null,
    { name: "Validation des visuels", date: day(6), workPackageId: null, reached: false },
    johan,
  );
  await saveMilestone(
    p2,
    null,
    { name: "Tournage", date: day(12), workPackageId: null, reached: false },
    pierre,
  );

  // Temps
  for (const [n, who] of people.entries()) {
    const tasks = (await tasksOf([p1, p2, p3][n])).slice(0, 4);
    for (const [k, t] of tasks.entries())
      await addManualEntry(
        {
          taskId: t.id,
          date: day(-k),
          minutes: 60 + k * 45,
          comment: k === 0 ? "Atelier avec le client" : null,
        },
        who,
      );
  }

  // ─── Finance ──────────────────────────────────────────────────────────────
  await proposeBudget(
    p1,
    { workPackageId: null, revenue: 4500000, cost: 2600000, pricingMode: "FORFAIT", reason: null },
    johan,
  );
  await proposeBudget(
    p2,
    { workPackageId: null, revenue: 3200000, cost: 1900000, pricingMode: null, reason: null },
    pierre,
  );
  await proposeBudget(
    p3,
    { workPackageId: null, revenue: 1500000, cost: 300000, pricingMode: "TEMPS", reason: null },
    charles,
  );
  const cost = (
    pid: string,
    by: { id: string },
    description: string,
    supplier: string,
    amount: number,
    status: "PREVU" | "ENGAGE" | "FACTURE" | "PAYE",
    rebillable = false,
  ) =>
    saveCost(
      pid,
      null,
      {
        workPackageId: null,
        supplier,
        description,
        category: "Production",
        pricingMode: "FRAIS",
        quantity: null,
        unit: null,
        unitRate: null,
        amount: amount * 100,
        vatAmount: amount * 20,
        amountTTC: amount * 120,
        status,
        committedAt: day(-10),
        invoiceDate: status === "FACTURE" || status === "PAYE" ? day(-8) : null,
        dueDate: day(20),
        paidAt: status === "PAYE" ? day(-2) : null,
        documentRef: null,
        rebillable,
      },
      by,
    );
  await cost(p1, johan, "Shooting studio (2 jours)", "Studio Lux", 6800, "PAYE");
  await cost(p1, johan, "Stylisme et décor", "Atelier Fil", 4200, "FACTURE");
  await cost(p1, johan, "Achat d'espace Instagram", "Meta", 9000, "ENGAGE", true);
  await cost(p1, johan, "Retouches photo", "Pixel & Co", 2500, "PREVU");
  await cost(p2, pierre, "Location caméra et optiques", "Loueur Paris", 5400, "ENGAGE");
  await cost(p2, pierre, "Équipe technique", "Collectif Plan", 7600, "PREVU");
  const bill = async (
    pid: string,
    by: { id: string },
    label: string,
    kind: "ACOMPTE" | "INTERMEDIAIRE" | "SOLDE",
    amount: number,
    d: number,
    status: "ATTENDU" | "FACTURE",
    ref?: string,
  ) => {
    const b = await saveBilling(
      pid,
      null,
      {
        workPackageId: null,
        label,
        kind,
        plannedDate: day(d),
        amount: amount * 100,
        vatAmount: amount * 20,
        status,
        invoiceRef: ref ?? null,
        invoiceUrl: null,
        invoicedAt: status === "FACTURE" ? day(d) : null,
      },
      by,
    );
    if (!b.ok) throw new Error(b.error);
    return b.data.id;
  };
  const a1 = await bill(p1, johan, "Acompte 30 %", "ACOMPTE", 13500, -18, "FACTURE", "FA-2026-041");
  await recordPayment(
    p1,
    { billingMilestoneId: a1, amount: 1350000, receivedAt: day(-10), reference: "VIR SOLENE" },
    johan,
  );
  const a2 = await bill(
    p1,
    johan,
    "Livraison des visuels",
    "INTERMEDIAIRE",
    18000,
    -2,
    "FACTURE",
    "FA-2026-052",
  );
  await recordPayment(
    p1,
    { billingMilestoneId: a2, amount: 600000, receivedAt: day(-1), reference: "VIR SOLENE" },
    johan,
  );
  await bill(p1, johan, "Solde", "SOLDE", 13500, 25, "ATTENDU");
  const b1 = await bill(p2, pierre, "Acompte 40 %", "ACOMPTE", 12800, -4, "FACTURE", "FA-2026-055");
  await recordPayment(
    p2,
    { billingMilestoneId: b1, amount: 1280000, receivedAt: day(-2), reference: "VIR NORD" },
    pierre,
  );
  await bill(p2, pierre, "Solde", "SOLDE", 19200, 30, "ATTENDU");
  await bill(p3, charles, "Atelier stratégie", "INTERMEDIAIRE", 7500, -12, "ATTENDU");
  await saveContract(
    null,
    {
      clientId: lumen,
      projectId: p3,
      label: "Community management Café Lumen",
      monthlyAmount: 180000,
      startDate: day(-90),
      endDate: null,
      durationMonths: 12,
      status: "ACTIF",
      renewalDate: day(275),
      noticeDays: 30,
      notes: null,
    },
    charles,
  );
  await saveContract(
    null,
    {
      clientId: solene,
      projectId: null,
      label: "Social ads Maison Solène",
      monthlyAmount: 120000,
      startDate: day(-30),
      endDate: null,
      durationMonths: 6,
      status: "ACTIF",
      renewalDate: day(150),
      noticeDays: 30,
      notes: null,
    },
    johan,
  );

  // Gouvernance : seuil fictif pour la démonstration.
  await saveGovernance(
    { budgetOverrunPct: 10, delayPct: 25, delayMinDays: 7, requiredApprovals: 2, blocking: true },
    johan,
  );
  const rev = await proposeBudget(
    p2,
    {
      workPackageId: null,
      revenue: 3200000,
      cost: 2250000,
      pricingMode: null,
      reason: "Une journée de tournage supplémentaire",
    },
    pierre,
  );
  if (rev.ok && rev.data.pendingDecision)
    await vote(rev.data.pendingDecision, "POUR", "D'accord si le client valide le planning.", pierre);

  // ─── Calendrier et documents ─────────────────────────────────────────────
  const ev = (
    title: string,
    d: number,
    from: string,
    to: string,
    owner: { id: string },
    attendees: { id: string }[],
    extra: Partial<Parameters<typeof saveEvent>[1]> = {},
  ) =>
    saveEvent(
      null,
      {
        title,
        description: null,
        location: null,
        startsAt: at(d, from),
        endsAt: at(d, to),
        allDay: false,
        visibility: "PARTAGE",
        attendeeIds: attendees.map((a) => a.id),
        projectId: null,
        clientId: null,
        opportunityId: null,
        ...extra,
      },
      null,
      false,
      owner,
    );
  await ev("Point hebdo associés", 0, "09:30", "10:15", johan, [charles, pierre], { location: "Bureau" });
  await ev("Revue des visuels avec Maison Solène", 1, "14:00", "15:30", johan, [charles], {
    projectId: p1,
    clientId: solene,
    location: "Visio",
  });
  await ev("Repérages clip", 2, "10:00", "13:00", pierre, [], {
    projectId: p2,
    clientId: nord,
    location: "Pantin",
  });
  await ev("Rendez-vous banque", 1, "11:00", "12:00", charles, [], { visibility: "OCCUPE" });
  await ev("Présentation stratégie Café Lumen", 3, "16:00", "17:00", charles, [johan], {
    projectId: p3,
    clientId: lumen,
  });
  await addFile(
    {
      projectId: p1,
      title: "Brief créatif — printemps",
      url: "https://docs.google.com/document/d/1DemoBriefPrintemps2026/edit",
      kind: null,
      ownerLabel: "Johan",
      documentDate: day(-20),
    },
    johan,
  );
  await addFile(
    {
      projectId: p1,
      title: "Dossier visuels",
      url: "https://drive.google.com/drive/folders/1DemoDossierVisuels",
      kind: null,
      ownerLabel: "Charles",
      documentDate: null,
    },
    charles,
  );
  await addFile(
    {
      projectId: p2,
      title: "Scénario v3",
      url: "https://docs.google.com/document/d/1DemoScenarioNuitClaire/edit",
      kind: null,
      ownerLabel: "Pierre",
      documentDate: day(-3),
    },
    pierre,
  );

  await runScheduledScan();
  console.log("Données de démonstration créées.");
  console.log(`Comptes : johan@ / charles@ / pierre@demo.every1ate.test — mot de passe : ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
