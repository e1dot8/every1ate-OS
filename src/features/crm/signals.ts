/** Opportunités détectées (pures, sans IA) : clients dormants, renouvellements, suites à proposer. */
import { addDays, daysBetween } from "@/lib/dates";

export type Signal = {
  kind: "dormant" | "renouvellement" | "suite";
  title: string;
  detail: string;
  href: string;
  date: Date | null;
};

export function commercialSignals(input: {
  today: Date;
  clients: {
    id: string;
    name: string;
    lastActivityAt: Date | null;
    openOpportunities: number;
    activeProjects: number;
    everWorked: boolean;
  }[];
  contracts: {
    id: string;
    label: string;
    clientName: string;
    status: string;
    renewalDate: Date | null;
    endDate: Date | null;
    noticeDays: number | null;
  }[];
  closedProjects: {
    id: string;
    name: string;
    clientId: string | null;
    clientName: string | null;
    closedAt: Date;
    satisfaction: number | null;
    marginRate: number | null;
  }[];
}): Signal[] {
  const { today } = input;
  const out: Signal[] = [];
  for (const c of input.clients) {
    if (!c.everWorked || c.openOpportunities || c.activeProjects) continue;
    if (c.lastActivityAt && daysBetween(c.lastActivityAt, today) >= 180)
      out.push({
        kind: "dormant",
        title: `Relancer ${c.name}`,
        detail: `Aucune activité depuis ${Math.round(daysBetween(c.lastActivityAt, today) / 30)} mois.`,
        href: `/crm/clients/${c.id}`,
        date: c.lastActivityAt,
      });
  }
  for (const k of input.contracts) {
    if (k.status !== "ACTIF") continue;
    const ref = k.renewalDate ?? k.endDate;
    if (!ref) continue;
    const notice = k.noticeDays ? addDays(ref, -k.noticeDays) : ref;
    const days = daysBetween(today, notice);
    if (days >= 0 && days <= 60)
      out.push({
        kind: "renouvellement",
        title: `Renouvellement : ${k.label}`,
        detail: `${k.clientName} · ${k.noticeDays ? `préavis à donner avant le ${notice.toISOString().slice(0, 10)}` : `échéance le ${ref.toISOString().slice(0, 10)}`}`,
        href: `/finance/contrats/${k.id}`,
        date: notice,
      });
  }
  const busy = new Set(input.clients.filter((c) => c.openOpportunities || c.activeProjects).map((c) => c.id));
  for (const p of input.closedProjects) {
    if (!p.clientId || busy.has(p.clientId)) continue;
    const recent = daysBetween(p.closedAt, today) <= 120;
    const good = (p.satisfaction ?? 0) >= 4 || (p.marginRate ?? -1) >= 25;
    if (recent && good)
      out.push({
        kind: "suite",
        title: `Proposer une suite à ${p.clientName}`,
        detail: `« ${p.name} » clôturé${p.satisfaction ? `, satisfaction ${p.satisfaction}/5` : ""}${p.marginRate != null ? `, marge ${p.marginRate} %` : ""}.`,
        href: `/crm/opportunites/nouvelle?client=${p.clientId}`,
        date: p.closedAt,
      });
  }
  const order = { renouvellement: 0, suite: 1, dormant: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
