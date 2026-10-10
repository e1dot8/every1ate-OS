import { describe, expect, it } from "vitest";
import { emailFingerprint } from "@/lib/audit/audit";
import { describeDevice, formatLastActive, isMobileDevice } from "@/lib/auth/devices";
import { hashInvitationToken } from "@/lib/auth/invitations";
import { LOGIN_MAX_FAILURES, decideThrottle } from "@/lib/auth/login-throttle";
import { invitationEmail, resetPasswordEmail } from "@/lib/email/templates";
import { keptValues } from "@/lib/forms";
import { acceptInvitationSchema, inviteSchema, safeNextPath, signInSchema } from "@/lib/validation/auth";

describe("limitation des tentatives", () => {
  it("bloque à partir de 5 échecs", () => {
    expect(LOGIN_MAX_FAILURES).toBe(5);
    expect(decideThrottle(4).blocked).toBe(false);
    expect(decideThrottle(5).blocked).toBe(true);
  });

  it("l'empreinte d'e-mail ignore la casse et les espaces, et ne contient pas l'adresse", () => {
    const a = emailFingerprint("Johan@Example.com ");
    expect(a).toBe(emailFingerprint("johan@example.com"));
    expect(a).not.toContain("johan");
    expect(a).toHaveLength(32);
  });
});

describe("redirection après connexion", () => {
  it.each([
    [undefined, "/"],
    ["/plus/securite", "/plus/securite"],
    ["//exemple-malveillant.test", "/"],
    ["/\\exemple-malveillant.test", "/"],
    ["https://exemple-malveillant.test", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("schémas de validation", () => {
  it("normalise l'e-mail de connexion", () => {
    expect(signInSchema.parse({ email: "  Johan@Example.COM ", password: "x" }).email).toBe(
      "johan@example.com",
    );
  });

  it("exige deux saisies identiques", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "t",
      password: "Recette-Cuisson-2026!",
      confirm: "autre",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirm"]);
  });

  it("refuse une invitation sans prénom", () => {
    expect(inviteSchema.safeParse({ name: "  ", email: "a@b.fr" }).success).toBe(false);
  });
});

describe("formulaires", () => {
  it("ne renvoie jamais les champs secrets", () => {
    const data = new FormData();
    for (const [k, v] of Object.entries({
      email: "a@b.fr",
      password: "p",
      confirm: "p",
      current: "c",
      token: "t",
      name: "Lou",
    })) {
      data.set(k, v);
    }
    expect(keptValues(data)).toEqual({ email: "a@b.fr", name: "Lou" });
  });
});

describe("invitations", () => {
  it("le jeton est stocké sous forme d'empreinte SHA-256", () => {
    const hash = hashInvitationToken("jeton-secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("jeton-secret");
  });

  it("l'e-mail d'invitation contient le lien et sa durée de validité", () => {
    const mail = invitationEmail({
      to: "a@b.fr",
      name: "Pierre",
      inviterName: "Johan",
      url: "https://os.test/invitation/abc",
    });
    expect(mail.text).toContain("https://os.test/invitation/abc");
    expect(mail.text).toContain("72 heures");
    expect(mail.text).toContain("Johan vous invite");
  });

  it("l'e-mail de réinitialisation indique la validité d'1 heure", () => {
    expect(resetPasswordEmail({ to: "a@b.fr", name: "Lou", url: "https://os.test/r" }).text).toContain(
      "1 heure",
    );
  });
});

describe("appareils", () => {
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const macChrome =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
  const edge =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0";

  it.each([
    [iphone, "iPhone · Safari"],
    [macChrome, "Mac · Chrome"],
    [edge, "Windows · Edge"],
    [null, "Appareil inconnu"],
  ])("décrit %s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });

  it("reconnaît un mobile", () => {
    expect(isMobileDevice(iphone)).toBe(true);
    expect(isMobileDevice(macChrome)).toBe(false);
  });

  it("formate la dernière activité", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(formatLastActive(new Date("2026-10-10T11:58:00Z"), now)).toBe("actif maintenant");
    expect(formatLastActive(new Date("2026-10-10T10:00:00Z"), now)).toBe("il y a 2 heures");
    expect(formatLastActive(new Date("2026-10-05T12:00:00Z"), now)).toBe("il y a 5 jours");
  });
});
