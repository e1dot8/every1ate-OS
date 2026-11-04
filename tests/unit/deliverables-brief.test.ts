import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import { buildBrief, type BriefInput } from "@/features/brief/rules";

const empty: BriefInput = {
  overdueTasks: [],
  dueToday: [],
  blocked: [],
  followUps: [],
  meetings: [],
  decisions: [],
  lateBilling: [],
  renewals: [],
};

describe("brief du jour : livrables", () => {
  it("livrable en retard (urgent), à livrer aujourd'hui, points de checklist confiés", () => {
    const b = buildBrief({
      ...empty,
      meetings: [{ id: "e1", title: "Point hebdo", time: "09:30" }],
      lateDeliverables: [
        { id: "l1", title: "Teaser", project: "Campagne", dueDate: parseDateInput("2026-11-02")! },
      ],
      deliverablesDueToday: [{ id: "l2", title: "Carrousel lancement", project: "Campagne" }],
      checkItemsDue: [
        { deliverableId: "l3", deliverable: "Reel coulisses", label: "Sous-titres", late: false },
        { deliverableId: "l3", deliverable: "Reel coulisses", label: "Dérushage", late: true },
      ],
    });
    expect(b.summary).toBe("2 points urgents sur 5.");
    expect(b.items[0]).toMatchObject({
      kind: "livrable-retard",
      severity: 3,
      title: "Livrable en retard : Teaser",
      detail: "Campagne",
      href: "/livrables/l1",
    });
    expect(b.items.find((i) => i.href === "/livrables/l2")).toMatchObject({
      severity: 2,
      title: "À livrer aujourd'hui : Carrousel lancement",
    });
    expect(b.items.filter((i) => i.kind === "checklist").map((i) => [i.title, i.severity])).toEqual([
      ["Checklist en retard : Dérushage", 3],
      ["Checklist du jour : Sous-titres", 2],
    ]);
    expect(b.items.at(-1)!.kind).toBe("reunion");
  });

  it("sans livrable : brief inchangé", () => {
    expect(buildBrief(empty).summary).toBe("Rien d'urgent aujourd'hui.");
  });
});
