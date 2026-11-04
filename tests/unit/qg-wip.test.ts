import { describe, expect, it } from "vitest";
import { WIP_REASON_MIN, checkWipLimit } from "@/features/projects/rules";

const base = { from: "A_FAIRE" as const, to: "EN_COURS" as const, hasOwner: true, limit: 3 };

describe("limite de tâches en cours (bureau à N places)", () => {
  it("accepte tant qu'il reste une place", () => {
    expect(checkWipLimit({ ...base, occupied: 2 })).toEqual({ ok: true, override: false });
  });

  it("refuse une 4e tâche sans motif, avec un message clair", () => {
    const r = checkWipLimit({ ...base, occupied: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.needsReason).toBe(true);
      expect(r.error).toMatch(/Bureau plein \(3\/3\)/);
      expect(r.error).toMatch(/motif/);
    }
  });

  it("refuse un motif trop court", () => {
    const r = checkWipLimit({ ...base, occupied: 3, reason: " ok " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(new RegExp(`${WIP_REASON_MIN} caractères`));
  });

  it("accepte le dépassement avec un motif d'au moins 5 caractères", () => {
    expect(checkWipLimit({ ...base, occupied: 3, reason: "Urgence client" })).toEqual({
      ok: true,
      override: true,
    });
    expect(checkWipLimit({ ...base, occupied: 7, reason: "12345" }).ok).toBe(true);
  });

  it("ne s'applique qu'au passage « En cours »", () => {
    for (const to of ["A_FAIRE", "EN_REVUE", "TERMINE", "EN_ATTENTE", "BLOQUE", "ANNULE"] as const)
      expect(checkWipLimit({ ...base, to, occupied: 9 })).toEqual({ ok: true, override: false });
  });

  it("une tâche qui occupe déjà une place (bloquée qui reprend) n'est pas refusée", () => {
    expect(checkWipLimit({ ...base, from: "BLOQUE", occupied: 5 }).ok).toBe(true);
    expect(checkWipLimit({ ...base, from: "EN_COURS", occupied: 5 }).ok).toBe(true);
  });

  it("une tâche sans responsable n'occupe aucun bureau", () => {
    expect(checkWipLimit({ ...base, hasOwner: false, occupied: 10 }).ok).toBe(true);
  });

  it("respecte la limite réglée (1 à 10)", () => {
    expect(checkWipLimit({ ...base, limit: 1, occupied: 1 }).ok).toBe(false);
    expect(checkWipLimit({ ...base, limit: 10, occupied: 9 }).ok).toBe(true);
  });
});
