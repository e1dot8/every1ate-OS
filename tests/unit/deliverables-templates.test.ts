import { describe, expect, it } from "vitest";
import { FORMATS, WORK_STAGES } from "@/features/deliverables/rules";
import { CHECKLIST_TEMPLATES, checklistTemplate, templateItems } from "@/features/deliverables/templates";

describe("checklists types", () => {
  it("chaque format a au moins un point par étape de travail, sans doublon ni libellé vide", () => {
    for (const format of FORMATS) {
      const template = CHECKLIST_TEMPLATES[format];
      for (const stage of WORK_STAGES) {
        const labels = template[stage];
        expect(labels.length, `${format} / ${stage}`).toBeGreaterThan(0);
        expect(new Set(labels).size, `${format} / ${stage}`).toBe(labels.length);
        for (const label of labels) {
          expect(label.trim()).toBe(label);
          expect(label.length).toBeGreaterThan(2);
          expect(label.length).toBeLessThanOrEqual(200);
        }
      }
      // « Livré » est l'état final : jamais de checklist.
      expect(Object.keys(template)).not.toContain("LIVRE");
    }
  });

  it("la vidéo suit le parcours d'une agence de contenu", () => {
    const video = checklistTemplate("VIDEO");
    expect(video.PREPARATION).toContain("Brief validé avec le client");
    expect(video.CREATION).toContain("Script rédigé");
    expect(video.CREATION).toContain("Concept validé par le client");
    expect(video.PRODUCTION).toContain("Rushes sauvegardés (double copie)");
    expect(video.MONTAGE).toEqual(expect.arrayContaining(["Dérushage", "Montage V1", "Sous-titres"]));
    expect(video.LIVRAISON).toEqual(
      expect.arrayContaining(["Exports aux bons formats", "Validation client", "Publication programmée"]),
    );
  });

  it("la photo passe par la sélection et les retouches, le print par le BAT", () => {
    expect(checklistTemplate("PHOTO").MONTAGE).toContain("Retouches");
    expect(checklistTemplate("PRINT").MONTAGE).toContain("BAT signé par le client");
  });

  it("templateItems numérote les positions par étape, dans l'ordre des étapes", () => {
    const items = templateItems("POST");
    const total = WORK_STAGES.reduce((n, s) => n + checklistTemplate("POST")[s].length, 0);
    expect(items).toHaveLength(total);
    expect(items[0]).toEqual({ stage: "PREPARATION", label: "Brief validé avec le client", position: 0 });
    for (const stage of WORK_STAGES) {
      const positions = items.filter((i) => i.stage === stage).map((i) => i.position);
      expect(positions).toEqual(positions.map((_, i) => i));
    }
    const order = items.map((i) => WORK_STAGES.indexOf(i.stage as (typeof WORK_STAGES)[number]));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
