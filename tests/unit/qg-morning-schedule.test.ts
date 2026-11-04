import { describe, expect, it } from "vitest";
import {
  isMorningReportDue,
  previousWorkingDay,
  reportTitle,
  reportWindow,
} from "@/features/qg/morning/rules";
import { parseDateInput } from "@/lib/dates";

const day = (s: string) => parseDateInput(s)!;
const at = (iso: string) => new Date(iso);

describe("heure du point du matin (8 h, heure de Paris)", () => {
  it("en hiver (UTC+1) : dû à partir de 7 h UTC", () => {
    // Mardi 3 novembre 2026.
    expect(isMorningReportDue(at("2026-11-03T06:59:00Z"))).toBe(false); // 07:59 à Paris
    expect(isMorningReportDue(at("2026-11-03T07:00:00Z"))).toBe(true); // 08:00 à Paris
    expect(isMorningReportDue(at("2026-11-03T16:00:00Z"))).toBe(true); // l'après-midi aussi (rattrapage)
  });

  it("en été (UTC+2) : dû à partir de 6 h UTC", () => {
    // Mardi 16 juin 2026.
    expect(isMorningReportDue(at("2026-06-16T05:59:00Z"))).toBe(false); // 07:59 à Paris
    expect(isMorningReportDue(at("2026-06-16T06:00:00Z"))).toBe(true); // 08:00 à Paris
  });

  it("le lundi qui suit le passage à l'heure d'été", () => {
    expect(isMorningReportDue(at("2026-03-30T05:59:00Z"))).toBe(false);
    expect(isMorningReportDue(at("2026-03-30T06:00:00Z"))).toBe(true);
  });

  it("jamais le week-end (jour de Paris)", () => {
    expect(isMorningReportDue(at("2026-11-07T10:00:00Z"))).toBe(false); // samedi
    expect(isMorningReportDue(at("2026-11-08T10:00:00Z"))).toBe(false); // dimanche
    // Vendredi 23 h 30 UTC = samedi 0 h 30 à Paris.
    expect(isMorningReportDue(at("2026-11-06T23:30:00Z"))).toBe(false);
    // Dimanche 23 h 30 UTC = lundi 0 h 30 à Paris : trop tôt.
    expect(isMorningReportDue(at("2026-11-08T23:30:00Z"))).toBe(false);
  });

  it("le lundi matin, dès 8 h", () => {
    expect(isMorningReportDue(at("2026-11-02T07:30:00Z"))).toBe(true);
  });
});

describe("fenêtre « depuis le dernier point »", () => {
  it("jour ouvré précédent : la veille, sauf le lundi et le week-end (vendredi)", () => {
    expect(previousWorkingDay(day("2026-11-03"))).toEqual(day("2026-11-02")); // mardi → lundi
    expect(previousWorkingDay(day("2026-11-02"))).toEqual(day("2026-10-30")); // lundi → vendredi
    expect(previousWorkingDay(day("2026-11-07"))).toEqual(day("2026-11-06")); // samedi → vendredi
    expect(previousWorkingDay(day("2026-11-08"))).toEqual(day("2026-11-06")); // dimanche → vendredi
  });

  it("mardi : de lundi minuit à mardi minuit (heure de Paris), « hier »", () => {
    const w = reportWindow(at("2026-11-03T08:00:00Z"));
    expect(w.today).toEqual(day("2026-11-03"));
    expect(w.previousDay).toEqual(day("2026-11-02"));
    expect(w.from.toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(w.since).toBe("hier");
  });

  it("lundi : depuis vendredi minuit, week-end inclus", () => {
    const w = reportWindow(at("2026-11-02T07:30:00Z"));
    expect(w.previousDay).toEqual(day("2026-10-30"));
    expect(w.from.toISOString()).toBe("2026-10-29T23:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(w.since).toBe("depuis vendredi");
  });

  it("en été, et à cheval sur le changement d'heure", () => {
    const summer = reportWindow(at("2026-06-15T06:30:00Z")); // lundi 15 juin
    expect(summer.from.toISOString()).toBe("2026-06-11T22:00:00.000Z");
    expect(summer.to.toISOString()).toBe("2026-06-14T22:00:00.000Z");
    // Lundi 26 octobre 2026 : vendredi en heure d'été, lundi en heure d'hiver.
    const change = reportWindow(at("2026-10-26T07:30:00Z"));
    expect(change.from.toISOString()).toBe("2026-10-22T22:00:00.000Z");
    expect(change.to.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("le jour de Paris compte, pas celui d'UTC", () => {
    // Lundi 2 novembre 23 h 30 UTC = mardi 3 novembre 0 h 30 à Paris.
    const w = reportWindow(at("2026-11-02T23:30:00Z"));
    expect(w.today).toEqual(day("2026-11-03"));
    expect(w.since).toBe("hier");
  });

  it("titre du point", () => {
    expect(reportTitle(day("2026-11-03"))).toBe("Le point du mardi 3 novembre");
    expect(reportTitle(day("2026-11-02"))).toBe("Le point du lundi 2 novembre");
  });
});
