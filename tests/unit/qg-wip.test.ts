import { describe, expect, it } from "vitest";
import {
  WIP_AUTO_REASONS,
  WIP_REASON_MIN,
  checkWipLimit,
  wipReasonOnReassign,
} from "@/features/projects/rules";

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

  it("ne s'applique qu'à l'entrée sur le bureau (« En cours » ou « Bloquée »)", () => {
    for (const to of ["A_FAIRE", "EN_REVUE", "TERMINE", "EN_ATTENTE", "ANNULE"] as const)
      expect(checkWipLimit({ ...base, to, occupied: 9 })).toEqual({ ok: true, override: false });
  });

  it("« À faire » → « Bloquée » occupe aussi une place : même contrôle qu'« En cours »", () => {
    const blocked = { ...base, to: "BLOQUE" as const };
    expect(checkWipLimit({ ...blocked, occupied: 2 })).toEqual({ ok: true, override: false });
    const r = checkWipLimit({ ...blocked, occupied: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.needsReason).toBe(true);
      expect(r.error).toMatch(/Bureau plein \(3\/3\)/);
      expect(r.error).toMatch(/bloquée occupe aussi une place/);
    }
    expect(checkWipLimit({ ...blocked, occupied: 3, reason: "Attente client" })).toEqual({
      ok: true,
      override: true,
    });
    // En cours → Bloquée : la tâche occupait déjà sa place.
    expect(checkWipLimit({ ...blocked, from: "EN_COURS", occupied: 5 }).ok).toBe(true);
    for (const from of ["EN_REVUE", "EN_ATTENTE"] as const)
      expect(checkWipLimit({ ...blocked, from, occupied: 3 }).ok).toBe(false);
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

describe("changement de responsable et limite d'en-cours", () => {
  const label = WIP_AUTO_REASONS.handoff;
  const moved = { status: "EN_COURS" as const, hasOwner: true, limit: 3, label };

  it("bureau du nouveau responsable déjà plein : motif automatique visible de tous", () => {
    expect(wipReasonOnReassign({ ...moved, occupied: 3 })).toBe("Reçue par passation au-delà de la limite");
    expect(wipReasonOnReassign({ ...moved, status: "BLOQUE", occupied: 4 })).toBe(label);
    expect(wipReasonOnReassign({ ...moved, occupied: 3, label: WIP_AUTO_REASONS.reassign })).toBe(
      "Réassignée au-delà de la limite",
    );
  });

  it("bureau avec une place libre : le motif de l'ancien responsable est effacé", () => {
    expect(wipReasonOnReassign({ ...moved, occupied: 2 })).toBeNull();
    expect(wipReasonOnReassign({ ...moved, occupied: 0 })).toBeNull();
  });

  it("une tâche qui n'occupe pas de place, ou sans responsable, n'a pas de motif", () => {
    for (const status of ["A_FAIRE", "EN_REVUE", "EN_ATTENTE", "TERMINE", "ANNULE"] as const)
      expect(wipReasonOnReassign({ ...moved, status, occupied: 9 })).toBeNull();
    expect(wipReasonOnReassign({ ...moved, hasOwner: false, occupied: 9 })).toBeNull();
  });
});
