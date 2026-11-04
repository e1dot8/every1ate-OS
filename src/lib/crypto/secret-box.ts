import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Coffre à secrets (AES-256-GCM) pour les données sensibles stockées en base
 * (ex. clé personnelle CallMeBot). Format : `v1:<iv>:<tag>:<chiffré>` en base64url.
 * - IV aléatoire de 12 octets à chaque chiffrement ;
 * - étiquette d'authentification de 16 octets : un texte altéré est refusé ;
 * - `context` facultatif (données associées) : lie le secret à son usage (ex. l'utilisateur),
 *   un chiffré recopié ailleurs ne s'ouvre pas.
 * Module pur (aucune variable d'environnement) : la clé est toujours fournie par l'appelant.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
/** Contexte HKDF dédié : la clé dérivée ne sert à rien d'autre que ce coffre. */
const HKDF_INFO = "every1ate-os/secret-box/v1";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

function assertKey(key: Buffer) {
  if (key.length !== KEY_BYTES) throw new SecretBoxError("Clé de chiffrement invalide (32 octets attendus).");
}

const b64 = (data: Buffer) => data.toString("base64url");

function fromB64(part: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) throw new SecretBoxError("Secret chiffré illisible.");
  return Buffer.from(part, "base64url");
}

/** Chiffre `plaintext` ; le résultat est sûr à stocker en base. */
export function sealSecret(plaintext: string, key: Buffer, context = ""): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join(":");
}

/** Déchiffre ; lève `SecretBoxError` si le texte est altéré, mal formé ou si la clé ne correspond pas. */
export function openSecret(sealed: string, key: Buffer, context = ""): string {
  assertKey(key);
  const parts = sealed.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new SecretBoxError("Secret chiffré illisible.");
  const iv = fromB64(parts[1]);
  const tag = fromB64(parts[2]);
  const ciphertext = fromB64(parts[3]);
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES)
    throw new SecretBoxError("Secret chiffré illisible.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Jamais de détail : ni la clé, ni le contenu.
    throw new SecretBoxError("Secret chiffré altéré ou clé différente.");
  }
}

/** Vrai si la valeur a le format d'un secret chiffré par ce module. */
export function isSealed(value: string): boolean {
  return /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]*$/.test(value);
}

/**
 * Clé du coffre : `SECRETS_KEY` (32 octets en base64) si fournie, sinon dérivée de
 * `BETTER_AUTH_SECRET` par HKDF-SHA256 avec un contexte dédié.
 */
export function deriveSecretsKey(input: { secretsKey?: string | null; authSecret: string }): Buffer {
  if (input.secretsKey) {
    const key = Buffer.from(input.secretsKey.trim().replace(/-/g, "+").replace(/_/g, "/"), "base64");
    assertKey(key);
    return key;
  }
  if (!input.authSecret) throw new SecretBoxError("Aucun secret disponible pour dériver la clé.");
  return Buffer.from(hkdfSync("sha256", input.authSecret, "", HKDF_INFO, KEY_BYTES));
}
