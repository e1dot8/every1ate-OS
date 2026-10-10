import { describe, expect, it } from "vitest";
import {
  buildIcs,
  findConflicts,
  foldLine,
  localDay,
  parseDriveUrl,
  utcToLocalInput,
  viewFor,
  zonedToUtc,
} from "@/features/calendar/rules";

describe("fuseau Europe/Paris", () => {
  it("heure d'été et d'hiver", () => {
    expect(zonedToUtc("2026-07-14T10:00")!.toISOString()).toBe("2026-07-14T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01T10:00")!.toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
  it("heure inexistante (29 mars 2026, 02:30) décalée après le saut", () => {
    expect(zonedToUtc("2026-03-29T02:30")!.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
  it("heure ambiguë (25 oct. 2026, 02:30) : première occurrence", () => {
    expect(zonedToUtc("2026-10-25T02:30")!.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
  it("aller-retour et jour local", () => {
    const d = zonedToUtc("2026-10-12T23:30")!;
    expect(utcToLocalInput(d)).toBe("2026-10-12T23:30");
    expect(localDay(d)).toBe("2026-10-12");
    expect(zonedToUtc("2026-02-30T10:00")).toBeNull();
    expect(zonedToUtc("demain")).toBeNull();
  });
});

describe("conflits et visibilité", () => {
  const at = (s: string) => new Date(s);
  const a = {
    id: "a",
    startsAt: at("2026-10-12T08:00Z"),
    endsAt: at("2026-10-12T09:00Z"),
    people: ["johan", "pierre"],
  };
  it("chevauchement partageant une personne", () => {
    const others = [
      { id: "b", startsAt: at("2026-10-12T08:30Z"), endsAt: at("2026-10-12T10:00Z"), people: ["pierre"] },
      { id: "c", startsAt: at("2026-10-12T08:30Z"), endsAt: at("2026-10-12T10:00Z"), people: ["charles"] },
      { id: "d", startsAt: at("2026-10-12T09:00Z"), endsAt: at("2026-10-12T10:00Z"), people: ["johan"] },
    ];
    expect(findConflicts(a, others).map((x) => x.id)).toEqual(["b"]);
  });
  it("les détails privés ne sont pas partagés par défaut", () => {
    const e = {
      ownerId: "johan",
      attendeeIds: ["pierre"],
      visibility: "OCCUPE" as const,
      title: "RDV médecin",
      description: "x",
      location: "y",
    };
    expect(viewFor(e, "charles")).toMatchObject({
      title: "Occupé",
      description: null,
      location: null,
      busyOnly: true,
    });
    expect(viewFor(e, "pierre").title).toBe("RDV médecin");
    expect(viewFor({ ...e, visibility: "PARTAGE" }, "charles").title).toBe("RDV médecin");
  });
});

describe("ICS", () => {
  it("échappe, horodate en UTC et utilise CRLF", () => {
    const ics = buildIcs("Johan · Every1.ate", [
      {
        uid: "e1@every1ate-os",
        start: new Date("2026-10-12T08:00:00Z"),
        end: new Date("2026-10-12T09:00:00Z"),
        summary: "Brief, client; V2",
        description: "Ligne 1\nLigne 2",
        updated: new Date("2026-10-10T10:00:00Z"),
      },
      {
        uid: "t1@every1ate-os",
        start: new Date("2026-10-15T00:00:00Z"),
        end: new Date("2026-10-16T00:00:00Z"),
        allDay: true,
        summary: "Échéance",
        updated: new Date("2026-10-10T10:00:00Z"),
      },
    ]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261012T080000Z\r\n");
    expect(ics).toContain("SUMMARY:Brief\\, client\; V2\r\n");
    expect(ics).toContain("DESCRIPTION:Ligne 1\\nLigne 2\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("replie les lignes longues à 75 octets", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(60)}`);
    for (const part of folded.split("\r\n"))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("liens Google Drive", () => {
  it.each([
    ["https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing", "1AbCdEfGhIjKlMnOp", "DOCUMENT"],
    ["https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQ/edit", "1AbCdEfGhIjKlMnOpQ", "DOCUMENT"],
    ["https://docs.google.com/spreadsheets/u/0/d/1AbCdEfGhIjKlMnOpQ/edit", "1AbCdEfGhIjKlMnOpQ", "DOCUMENT"],
    ["https://drive.google.com/drive/folders/1FolderIdXYZ123", "1FolderIdXYZ123", "DOSSIER"],
    ["https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp", "1AbCdEfGhIjKlMnOp", "DOCUMENT"],
  ])("%s", (url, id, kind) => expect(parseDriveUrl(url)).toEqual({ externalId: id, kind }));
  it("refuse les autres domaines et le http", () => {
    expect(parseDriveUrl("https://drive.google.com.evil.test/file/d/1AbCdEfGhIjKlMnOp")).toBeNull();
    expect(parseDriveUrl("http://drive.google.com/file/d/1AbCdEfGhIjKlMnOp")).toBeNull();
    expect(parseDriveUrl("pas un lien")).toBeNull();
  });
});
