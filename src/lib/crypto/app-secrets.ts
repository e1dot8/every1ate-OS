import "server-only";
import { getServerEnv } from "@/lib/env";
import { deriveSecretsKey, openSecret, sealSecret } from "@/lib/crypto/secret-box";

/** Chiffrement des secrets de l'application avec la clé du serveur (jamais exposée au navigateur). */
let cachedKey: Buffer | undefined;

function appKey(): Buffer {
  if (!cachedKey) {
    const env = getServerEnv();
    cachedKey = deriveSecretsKey({ secretsKey: env.SECRETS_KEY, authSecret: env.BETTER_AUTH_SECRET });
  }
  return cachedKey;
}

export function sealAppSecret(plaintext: string, context: string): string {
  return sealSecret(plaintext, appKey(), context);
}

export function openAppSecret(sealed: string, context: string): string {
  return openSecret(sealed, appKey(), context);
}
