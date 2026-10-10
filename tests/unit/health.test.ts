import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/health";

const fixedNow = () => new Date("2026-10-10T08:00:00.000Z");

describe("checkHealth", () => {
  it("renvoie ok quand la base répond", async () => {
    const report = await checkHealth(async () => {}, fixedNow);
    expect(report).toEqual({
      status: "ok",
      checks: { database: "up" },
      checkedAt: "2026-10-10T08:00:00.000Z",
    });
  });

  it("renvoie degraded quand la base est injoignable", async () => {
    const report = await checkHealth(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:5432 password=hunter2");
    }, fixedNow);
    expect(report.status).toBe("degraded");
    expect(report.checks.database).toBe("down");
  });

  it("n'expose aucun détail interne de l'erreur", async () => {
    const report = await checkHealth(async () => {
      throw new Error("password=hunter2");
    });
    expect(JSON.stringify(report)).not.toContain("hunter2");
  });
});
